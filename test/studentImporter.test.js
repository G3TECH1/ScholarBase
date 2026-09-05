const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeStudentRow, buildStudentRecordFromRow } = require('../model/studentImporter');

test('normalizeStudentRow maps common Excel headers and keeps optional fields flexible', () => {
  const row = {
    'First Name': 'Ada',
    'Last Name': 'Lovelace',
    Class: 'JSS2',
    Department: 'Science',
    residence: 'Boarding',
    position: 'Not a Prefect',
    age: '15'
  };

  const normalized = normalizeStudentRow(row);

  assert.equal(normalized.Firstname, 'Ada');
  assert.equal(normalized.Lastname, 'Lovelace');
  assert.equal(normalized.Class, 'JSS2');
  assert.equal(normalized.department, 'Science');
  assert.equal(normalized.residence, 'Boarding');
  assert.equal(normalized.post, 'Not a Prefect');
  assert.equal(normalized.age, 15);
});

test('buildStudentRecordFromRow preserves missing optional values without crashing', () => {
  const row = {
    'First Name': 'John',
    'Last Name': 'Doe',
    Class: 'SS1'
  };

  const record = buildStudentRecordFromRow(row);

  assert.equal(record.Firstname, 'John');
  assert.equal(record.Lastname, 'Doe');
  assert.equal(record.Class, 'SS1');
  assert.equal(record.department || '', '');
  assert.equal(record.post || 'Not a Prefect', 'Not a Prefect');
  assert.equal(record.residence || '', '');
});
