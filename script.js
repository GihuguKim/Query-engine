/**
 * GYANNA'S SOFTWARE ENGINEERING STUDIO // PROJECT 09
 * Full-Stack Client-Side Relational Database & SQL Query Engine
 * Target: Pearson Edexcel IAL IT Unit 1 (Databases) & Unit 2 (Systems)
 */

// 1. DEFAULT RELATIONAL SCHEMA (3NF NORMALIZED SAMPLE DATASET)
const defaultDatabase = {
  tbl_Student: [
    { StudentID: 101, FirstName: "Gyanna", LastName: "Kimana", YearGroup: 12, HouseGroup: "Kilimanjaro" },
    { StudentID: 102, FirstName: "Alex", LastName: "Morgan", YearGroup: 12, HouseGroup: "Everest" },
    { StudentID: 103, FirstName: "Marcus", LastName: "Goffman", YearGroup: 11, HouseGroup: "Kilimanjaro" },
    { StudentID: 104, FirstName: "David", LastName: "Smith", YearGroup: 12, HouseGroup: "Mont Blanc" }
  ],
  tbl_Course: [
    { CourseID: "IT12", CourseTitle: "A-Level Information Technology", TeacherName: "Mr. Reynolds", Credits: 15 },
    { CourseID: "PM01", CourseTitle: "Pure Mathematics 1", TeacherName: "Dr. Zamurred", Credits: 20 },
    { CourseID: "PM02", CourseTitle: "Pure Mathematics 2", TeacherName: "Dr. Bicen", Credits: 20 },
    { CourseID: "EN01", CourseTitle: "IAL English Language Unit 1", TeacherName: "Ms. Kadaga", Credits: 10 }
  ],
  tbl_Enrollment: [
    { StudentID: 101, CourseID: "IT12", EnrollmentDate: "2026-09-10", GradeMark: 98 },
    { StudentID: 101, CourseID: "PM01", EnrollmentDate: "2026-09-10", GradeMark: 95 },
    { StudentID: 101, CourseID: "PM02", EnrollmentDate: "2026-10-15", GradeMark: 94 },
    { StudentID: 102, CourseID: "IT12", EnrollmentDate: "2026-09-12", GradeMark: 82 },
    { StudentID: 103, CourseID: "EN01", EnrollmentDate: "2026-09-15", GradeMark: 78 },
    { StudentID: 104, CourseID: "IT12", EnrollmentDate: "2026-09-10", GradeMark: 92 }
  ]
};

// 2. ACTIVE DATABASE STATE
let db = {};
let activeInspectorTable = 'tbl_Student';

// 3. DOM REFERENCES
const sqlInput = document.getElementById('sql-input');
const queryError = document.getElementById('query-error');
const executionTimeEl = document.getElementById('query-execution-time');
const resultsThead = document.getElementById('results-thead');
const resultsTbody = document.getElementById('results-tbody');
const resultsCountLabel = document.getElementById('results-count-label');
const rawTableDisplay = document.getElementById('raw-table-display');
const erdCanvas = document.getElementById('erdCanvas');
const erdCtx = erdCanvas.getContext('2d');

// 4. STORAGE PERSISTENCE ENGINE
function initDatabase() {
  const stored = localStorage.getItem('gyannaRDBMS_Database');
  if (stored) {
    try {
      db = JSON.parse(stored);
    } catch (e) {
      console.error("Database rehydration error:", e);
      db = JSON.parse(JSON.stringify(defaultDatabase));
    }
  } else {
    db = JSON.parse(JSON.stringify(defaultDatabase));
    persistDatabase();
  }
}

function persistDatabase() {
  localStorage.setItem('gyannaRDBMS_Database', JSON.stringify(db));
}

function resetDatabaseToDefault() {
  db = JSON.parse(JSON.stringify(defaultDatabase));
  persistDatabase();
  renderRawTable(activeInspectorTable);
  renderERD();
  loadQueryPreset('all_students');
  executeUserQuery();
}

// 5. RELATIONAL SQL PARSER & EXECUTION MACHINE
/**
 * Supports IAL IT Unit 1 & Unit 2 Syntax:
 * - SELECT col1, col2, ... FROM table
 * - INNER JOIN tableB ON tableA.FK = tableB.PK
 * - WHERE col = val / col >= val / col LIKE 'G%'
 * - ORDER BY col [ASC | DESC]
 */
function parseAndRunSQL(queryString) {
  const cleanSQL = queryString.trim().replace(/;$/, '');
  if (!cleanSQL) throw new Error("Empty query string.");

  // Regex token extraction
  const selectRegex = /SELECT\s+(.+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+INNER\s+JOIN\s+([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_.]+)\s*=\s*([a-zA-Z0-9_.]+))?(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+([a-zA-Z0-9_.]+)(?:\s+(ASC|DESC))?)?$/i;
  
  const match = cleanSQL.match(selectRegex);
  if (!match) {
    throw new Error("Syntax Error: Unsupported SQL clause structure. Ensure clauses follow: SELECT ... FROM ... [INNER JOIN ... ON ...] [WHERE ...] [ORDER BY ...]");
  }

  const selectColsRaw = match[1].trim();
  const primaryTable = match[2].trim();
  const joinTable = match[3] ? match[3].trim() : null;
  const joinKeyA = match[4] ? match[4].trim() : null;
  const joinKeyB = match[5] ? match[5].trim() : null;
  const whereClause = match[6] ? match[6].trim() : null;
  const orderCol = match[7] ? match[7].trim() : null;
  const orderDir = match[8] ? match[8].toUpperCase() : 'ASC';

  // 1. Verify Primary Table
  if (!db[primaryTable]) {
    throw new Error(`Table Error: Table '${primaryTable}' does not exist in relational schema.`);
  }

  let dataset = JSON.parse(JSON.stringify(db[primaryTable]));

  // 2. Execute Relational INNER JOIN
  if (joinTable) {
    if (!db[joinTable]) {
      throw new Error(`Join Error: Table '${joinTable}' does not exist.`);
    }

    const joinedDataset = [];
    const tableBData = db[joinTable];

    // Helper: Strip table prefixes (e.g. tbl_Student.StudentID -> StudentID)
    const fieldA = joinKeyA.includes('.') ? joinKeyA.split('.')[1] : joinKeyA;
    const fieldB = joinKeyB.includes('.') ? joinKeyB.split('.')[1] : joinKeyB;

    dataset.forEach(rowA => {
      tableBData.forEach(rowB => {
        if (String(rowA[fieldA]) === String(rowB[fieldB])) {
          joinedDataset.push({ ...rowA, ...rowB });
        }
      });
    });

    dataset = joinedDataset;
  }

  // 3. Execute WHERE Filter
  if (whereClause) {
    dataset = dataset.filter(row => evaluateWhere(row, whereClause));
  }

  // 4. Execute ORDER BY Sort
  if (orderCol) {
    const sortField = orderCol.includes('.') ? orderCol.split('.')[1] : orderCol;
    dataset.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return orderDir === 'DESC' ? valB - valA : valA - valB;
      }
      return orderDir === 'DESC'
        ? String(valB).localeCompare(String(valA))
        : String(valA).localeCompare(String(valB));
    });
  }

  // 5. Column Projection (SELECT)
  if (selectColsRaw !== '*') {
    const requestedCols = selectColsRaw.split(',').map(c => c.trim().replace(/^[a-zA-Z0-9_]+\./, ''));
    dataset = dataset.map(row => {
      const projected = {};
      requestedCols.forEach(col => {
        if (row.hasOwnProperty(col)) {
          projected[col] = row[col];
        }
      });
      return projected;
    });
  }

  return dataset;
}

// Helper: Where clause evaluator
function evaluateWhere(row, whereClause) {
  // Pattern 1: LIKE '%...'
  const likeMatch = whereClause.match(/([a-zA-Z0-9_.]+)\s+LIKE\s+'(.*?)'/i);
  if (likeMatch) {
    const field = likeMatch[1].includes('.') ? likeMatch[1].split('.')[1] : likeMatch[1];
    const pattern = likeMatch[2];
    const val = String(row[field] || '');
    if (pattern.startsWith('%') && pattern.endsWith('%')) {
      return val.toLowerCase().includes(pattern.slice(1, -1).toLowerCase());
    } else if (pattern.endsWith('%')) {
      return val.toLowerCase().startsWith(pattern.slice(0, -1).toLowerCase());
    } else if (pattern.startsWith('%')) {
      return val.toLowerCase().endsWith(pattern.slice(1).toLowerCase());
    }
    return val.toLowerCase() === pattern.toLowerCase();
  }

  // Pattern 2: Numeric & String Relational Operators (=, >=, <=, >, <, <>)
  const opMatch = whereClause.match(/([a-zA-Z0-9_.]+)\s*(=|>=|<=|>|<|<>|!=)\s*(.+)/);
  if (opMatch) {
    const field = opMatch[1].includes('.') ? opMatch[1].split('.')[1] : opMatch[1];
    const op = opMatch[2];
    let target = opMatch[3].trim().replace(/^['"]|['"]$/g, '');
    let cellVal = row[field];

    if (!isNaN(Number(target)) && typeof cellVal === 'number') {
      target = Number(target);
    }

    if (op === '=' || op === '==') return cellVal == target;
    if (op === '<>' || op === '!=') return cellVal != target;
    if (op === '>=') return cellVal >= target;
    if (op === '<=') return cellVal <= target;
    if (op === '>') return cellVal > target;
    if (op === '<') return cellVal < target;
  }

  return true;
}

// 6. QUERY EXECUTION TRIGGER
function executeUserQuery() {
  const query = sqlInput.value;
  queryError.textContent = '';

  const startTime = performance.now();
  try {
    const results = parseAndRunSQL(query);
    const duration = (performance.now() - startTime).toFixed(2);
    executionTimeEl.textContent = `Execution: ${duration} ms`;

    renderResultsTable(results);
  } catch (err) {
    queryError.textContent = err.message;
    resultsThead.innerHTML = `<tr><th>Error</th></tr>`;
    resultsTbody.innerHTML = `<tr><td class="text-rose text-center py-4">${escapeHtml(err.message)}</td></tr>`;
    resultsCountLabel.textContent = "Query failed";
  }
}

// 7. RENDER RESULTS TABLE
function renderResultsTable(data) {
  resultsThead.innerHTML = '';
  resultsTbody.innerHTML = '';

  if (!data || data.length === 0) {
    resultsCountLabel.textContent = "0 records returned";
    resultsThead.innerHTML = `<tr><th>Query Result</th></tr>`;
    resultsTbody.innerHTML = `<tr><td class="text-muted text-center py-4">No matching records found.</td></tr>`;
    return;
  }

  resultsCountLabel.textContent = `${data.length} record${data.length === 1 ? '' : 's'} returned`;

  // Headers
  const columns = Object.keys(data[0]);
  const trHead = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col;
    trHead.appendChild(th);
  });
  resultsThead.appendChild(trHead);

  // Rows
  data.forEach(row => {
    const tr = document.createElement('tr');
    columns.forEach(col => {
      const td = document.createElement('td');
      td.textContent = row[col] !== undefined ? row[col] : 'NULL';
      tr.appendChild(td);
    });
    resultsTbody.appendChild(tr);
  });
}

// 8. RAW DATA TABLE INSPECTOR
function renderRawTable(tableName) {
  rawTableDisplay.innerHTML = '';
  const rows = db[tableName];
  if (!rows || rows.length === 0) return;

  const cols = Object.keys(rows[0]);
  
  // Header
  let headHtml = '<thead><tr>';
  cols.forEach(c => {
    const isPK = (c === 'StudentID' && tableName !== 'tbl_Enrollment') || 
                 (c === 'CourseID' && tableName !== 'tbl_Enrollment') ||
                 (tableName === 'tbl_Enrollment' && (c === 'StudentID' || c === 'CourseID'));
    const isFK = tableName === 'tbl_Enrollment' && (c === 'StudentID' || c === 'CourseID');
    
    headHtml += `<th>${c} ${isPK ? '<span class="pk-tag">PK</span>' : ''}${isFK ? '<span class="fk-tag">FK</span>' : ''}</th>`;
  });
  headHtml += '</tr></thead>';

  // Body
  let bodyHtml = '<tbody>';
  rows.forEach(r => {
    bodyHtml += '<tr>';
    cols.forEach(c => {
      bodyHtml += `<td>${r[c]}</td>`;
    });
    bodyHtml += '</tr>';
  });
  bodyHtml += '</tbody>';

  rawTableDisplay.innerHTML = headHtml + bodyHtml;
}

function switchTableTab(tableName) {
  activeInspectorTable = tableName;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.table === tableName);
  });
  renderRawTable(tableName);
}

// 9. INTERACTIVE ERD CANVAS RENDERER
function renderERD() {
  const w = erdCanvas.width;
  const h = erdCanvas.height;
  erdCtx.clearRect(0, 0, w, h);

  // Entity Boxes Configurations
  const entities = [
    { name: "tbl_Student", x: 60, y: 35, width: 260, height: 180, pk: "StudentID", fields: ["FirstName", "LastName", "YearGroup", "HouseGroup"] },
    { name: "tbl_Enrollment", x: 440, y: 45, width: 260, height: 160, pk: "StudentID (FK) + CourseID (FK)", fields: ["EnrollmentDate", "GradeMark"] },
    { name: "tbl_Course", x: 820, y: 35, width: 260, height: 180, pk: "CourseID", fields: ["CourseTitle", "TeacherName", "Credits"] }
  ];

  // 1. Draw Connecting Cardinality Lines
  erdCtx.save();
  erdCtx.strokeStyle = '#6366f1';
  erdCtx.lineWidth = 2.5;

  // Student to Enrollment (1 to M)
  erdCtx.beginPath();
  erdCtx.moveTo(320, 125);
  erdCtx.lineTo(440, 125);
  erdCtx.stroke();

  // Enrollment to Course (M to 1)
  erdCtx.beginPath();
  erdCtx.moveTo(700, 125);
  erdCtx.lineTo(820, 125);
  erdCtx.stroke();

  // Cardinality Tags
  erdCtx.fillStyle = '#fbbf24';
  erdCtx.font = 'bold 13px "JetBrains Mono", monospace';
  erdCtx.fillText("1", 335, 115);
  erdCtx.fillText("M", 420, 115);

  erdCtx.fillText("M", 715, 115);
  erdCtx.fillText("1", 800, 115);
  erdCtx.restore();

  // 2. Draw Entity Rectangles & Attributes
  entities.forEach(ent => {
    erdCtx.save();
    // Glass card background
    erdCtx.fillStyle = '#0f172a';
    erdCtx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    erdCtx.lineWidth = 1.5;
    erdCtx.beginPath();
    erdCtx.roundRect(ent.x, ent.y, ent.width, ent.height, 10);
    erdCtx.fill();
    erdCtx.stroke();

    // Entity Header Banner
    erdCtx.fillStyle = '#1e1b4b';
    erdCtx.beginPath();
    erdCtx.roundRect(ent.x, ent.y, ent.width, 36, [10, 10, 0, 0]);
    erdCtx.fill();

    erdCtx.fillStyle = '#ffffff';
    erdCtx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    erdCtx.fillText(ent.name, ent.x + 14, ent.y + 23);

    // Primary Key (Highlighted Amber)
    erdCtx.fillStyle = '#fbbf24';
    erdCtx.font = 'bold 12px "JetBrains Mono", monospace';
    erdCtx.fillText(`🔑 ${ent.pk}`, ent.x + 14, ent.y + 60);

    // Separator line
    erdCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    erdCtx.beginPath();
    erdCtx.moveTo(ent.x + 10, ent.y + 72);
    erdCtx.lineTo(ent.x + ent.width - 10, ent.y + 72);
    erdCtx.stroke();

    // Attributes List
    erdCtx.fillStyle = '#94a3b8';
    erdCtx.font = '12px "JetBrains Mono", monospace';
    ent.fields.forEach((f, i) => {
      erdCtx.fillText(`• ${f}`, ent.x + 14, ent.y + 96 + (i * 22));
    });
    erdCtx.restore();
  });
}

// 10. PRESET SHORTCUT QUERIES (IAL EXAM SCENARIOS)
function loadQueryPreset(presetKey) {
  if (presetKey === 'all_students') {
    sqlInput.value = "SELECT FirstName, LastName, YearGroup, HouseGroup\nFROM tbl_Student\nWHERE YearGroup = 12\nORDER BY LastName ASC;";
  } else if (presetKey === 'high_credits') {
    sqlInput.value = "SELECT CourseTitle, TeacherName, Credits\nFROM tbl_Course\nWHERE Credits >= 15\nORDER BY Credits DESC;";
  } else if (presetKey === 'join_enrollments') {
    sqlInput.value = "SELECT tbl_Student.FirstName, tbl_Student.LastName, tbl_Course.CourseTitle, tbl_Enrollment.GradeMark\nFROM tbl_Enrollment\nINNER JOIN tbl_Student ON tbl_Enrollment.StudentID = tbl_Student.StudentID\nWHERE tbl_Enrollment.GradeMark >= 90\nORDER BY tbl_Enrollment.GradeMark DESC;";
  } else if (presetKey === 'like_filter') {
    sqlInput.value = "SELECT StudentID, FirstName, LastName, HouseGroup\nFROM tbl_Student\nWHERE LastName LIKE 'G%' \nORDER BY FirstName ASC;";
  }
  executeUserQuery();
}

// 11. EXPORT RESULTS AS JSON
function exportResultsAsJSON() {
  const query = sqlInput.value;
  try {
    const data = parseAndRunSQL(query);
    const jsonStr = JSON.stringify(data, null, 2);
    
    // Copy to clipboard
    const tempArea = document.createElement('textarea');
    tempArea.value = jsonStr;
    document.body.appendChild(tempArea);
    tempArea.select();
    document.execCommand('copy');
    document.body.removeChild(tempArea);

    const original = resultsCountLabel.textContent;
    resultsCountLabel.textContent = "✓ Results Copied to Clipboard as JSON!";
    setTimeout(() => { resultsCountLabel.textContent = original; }, 2500);
  } catch (e) {
    alert("Cannot export: " + e.message);
  }
}

// 12. SHORTCUT LISTENER (Ctrl + Enter to Execute)
sqlInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    executeUserQuery();
  }
});

// Helper: String sanitizer
function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// 13. INITIALIZATION
initDatabase();
renderRawTable(activeInspectorTable);
renderERD();
loadQueryPreset('all_students');