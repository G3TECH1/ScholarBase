const { studentSubjects, studentSchema } = require('./studentDB');

function normalizeKey(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const FIELD_ALIASES = {
  firstname: ['firstname', 'first name', 'first_name', 'fname', 'givenname'],
  lastname: ['lastname', 'last name', 'last_name', 'surname', 'familyname'],
  age: ['age', 'years', 'studentage'],
  gender: ['gender', 'sex'],
  residence: ['residence', 'boardingstatus', 'hostelstatus', 'residentialstatus'],
  class: ['class', 'studentclass', 'classname'],
  department: ['department', 'faculty', 'stream', 'programme', 'discipline'],
  post: ['post', 'position', 'role', 'prefectship'],
};

function normalizeStudentRow(rawRow = {}) {
  const row = {};

  for (const [key, value] of Object.entries(rawRow)) {
    if (value === undefined || value === null) continue;

    const normalizedKey = normalizeKey(key);
    let matchedField = null;

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(normalizedKey)) {
        matchedField = field;
        break;
      }
    }

    if (!matchedField) {
      const fallbackKey = normalizeKey(String(key));
      if (fallbackKey.includes('firstname')) matchedField = 'firstname';
      else if (fallbackKey.includes('lastname')) matchedField = 'lastname';
      else if (fallbackKey.includes('class')) matchedField = 'class';
      else if (fallbackKey.includes('department')) matchedField = 'department';
      else if (fallbackKey.includes('position') || fallbackKey.includes('post')) matchedField = 'post';
      else if (fallbackKey.includes('residence')) matchedField = 'residence';
      else if (fallbackKey.includes('gender')) matchedField = 'gender';
      else if (fallbackKey.includes('age')) matchedField = 'age';
    }

    if (!matchedField) continue;

    const safeValue = String(value).trim();
    let cleanValue = safeValue;

    if (matchedField === 'age') {
      const parsedAge = Number(safeValue);
      cleanValue = Number.isFinite(parsedAge) ? parsedAge : '';
    }

    row[matchedField] = cleanValue;
  }

  const firstname = row.firstname || row['first name'] || '';
  const lastname = row.lastname || row['last name'] || '';
  const studentClass = row.class || row.studentclass || '';
  const department = row.department || '';
  const residence = row.residence || '';
  const gender = row.gender || '';
  const post = row.post || row.position || '';

  return {
    Firstname: String(firstname).trim(),
    Lastname: String(lastname).trim(),
    age: row.age !== undefined && row.age !== '' ? Number(row.age) : '',
    gender: String(gender).trim(),
    residence: String(residence).trim(),
    Class: String(studentClass).trim(),
    department: String(department).trim(),
    post: String(post).trim(),
  };
}

function buildStudentRecordFromRow(rawRow = {}) {
  const normalized = normalizeStudentRow(rawRow);

  const baseDepartment = normalized.department || 'Not in senior class';
  const selectedSubjects = studentSubjects[baseDepartment] || studentSubjects['Not in senior class'];

  const record = {
    Firstname: normalized.Firstname,
    Lastname: normalized.Lastname,
    age: normalized.age || 0,
    residence: normalized.residence || '',
    gender: normalized.gender || '',
    post: normalized.post || '',
    Class: normalized.Class || '',
    department: normalized.department || '',
    assignedSubjects: (selectedSubjects || []).map((title) => ({ title, examScore: 0, TestScore: 0 })),
    history: {},
  };

  if (!record.department) {
    delete record.department;
  }

  if (!record.residence) {
    delete record.residence;
  }

  if (!record.post) {
    delete record.post;
  }

  return record;
}

function parseImportedStudentRows(rows = []) {
  return rows
    .map((row) => normalizeStudentRow(row))
    .filter((row) => row.Firstname || row.Lastname || row.Class || row.department || row.residence || row.post)
    .map((row) => buildStudentRecordFromRow(row));
}

module.exports = {
  normalizeStudentRow,
  buildStudentRecordFromRow,
  parseImportedStudentRows,
  FIELD_ALIASES,
};
