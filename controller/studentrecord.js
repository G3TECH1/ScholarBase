const { queryDB } = require("../config/dbDriver");
const multer = require("multer");
const XLSX = require("xlsx");
const { ValidateStudentData, studentSubjects } = require("../model/studentDB");
const { parseImportedStudentRows } = require("../model/studentImporter");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Helper to fetch active students
async function getAllStudentsFromDB() {
  const rawKeys = await queryDB("KEYS student:*");
  const keysArray = rawKeys ? rawKeys.split(",") : [];

  let allStudents = [];
  for (let key of keysArray) {
    if (!key.trim()) continue;
    const rawStudentData = await queryDB(`GET ${key}`);
    if (rawStudentData && rawStudentData !== "NULL") {
      const stuObj = JSON.parse(rawStudentData);
      stuObj.id = key.split(":")[1];
      allStudents.push(stuObj);
    }
  }
  return allStudents;
}

// 1. 👑 PRINCIPAL DASHBOARD (Read-only audit & grading matrix)
const renderPrincipalDashboard = async (req, res) => {
  try {
    const students = await getAllStudentsFromDB();

    let gradingConfig = {
      maxTestScore: 40,
      maxExamScore: 60,
      gradingScale: []
    };

    try {
      const rawConfig = await queryDB("GET config:grading");
      if (rawConfig && rawConfig !== "NULL") {
        const parsed = JSON.parse(rawConfig);
        if (parsed && typeof parsed === "object") {
          gradingConfig = { ...gradingConfig, ...parsed };
        }
      }
    } catch (_) {
      gradingConfig = {
        maxTestScore: 40,
        maxExamScore: 60,
        gradingScale: []
      };
    }

    // Standardized target classes
    // Standardized target classes
    const classes = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];
    let gradingMatrix = {};

    for (let c of classes) {
      const classStudents = students.filter(
        s => s.Class && s.Class.trim().toUpperCase() === c.toUpperCase()
      );
      gradingMatrix[c] = {};
      if (classStudents.length === 0) continue;

      let classSubjects = new Set();
      classStudents.forEach(s => 
        (s.assignedSubjects || []).forEach(sub => classSubjects.add(sub.title))
      );

      classSubjects.forEach(subTitle => {
        let testGradedCount = 0;
        let examGradedCount = 0;

        classStudents.forEach(s => {
          const subObj = (s.assignedSubjects || []).find(x => x.title === subTitle);
          if (subObj) {
            const testScore = Number(subObj.TestScore || subObj.testScore || 0);
            const examScore = Number(subObj.examScore || subObj.ExamScore || 0);

            if (testScore > 0) testGradedCount++;
            if (examScore > 0) examGradedCount++;
          }
        });

        const totalStudents = classStudents.length;
        const isTestComplete = (testGradedCount === totalStudents) && totalStudents > 0;
        const isExamComplete = (examGradedCount === totalStudents) && totalStudents > 0;

        gradingMatrix[c][subTitle] = {
          totalStudents,
          test: {
            status: isTestComplete ? "COMPLETE" : "PENDING",
            gradedCount: testGradedCount
          },
          exam: {
            status: isExamComplete ? "COMPLETE" : "PENDING",
            gradedCount: examGradedCount
          }
        };
      });
    }

    // FETCH TEACHERS FOR THE MODAL
    const rawTeacherKeys = await queryDB("KEYS teacher:*");
    const tKeys = rawTeacherKeys ? rawTeacherKeys.split(",") : [];
    let teachers = [];
    for (let tk of tKeys) {
      if (!tk.trim()) continue;
      const rawT = await queryDB(`GET ${tk}`);
      if (rawT && rawT !== "NULL") {
        const tObj = JSON.parse(rawT);
        tObj.id = tk.split(":")[1];
        teachers.push(tObj);
      }
    }

    let activityLogs = [];
    try {
      const rawLogs = await queryDB("GET logs:activities");
      if (rawLogs && rawLogs !== "NULL") {
        if (typeof rawLogs === "string") {
          const trimmed = rawLogs.trim();
          
          // Attempt standard JSON parse if it looks like a JSON array/object
          if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
            try {
              const parsed = JSON.parse(trimmed);
              activityLogs = Array.isArray(parsed) ? parsed : [parsed];
            } catch (_) {
              // Fallback split if standard JSON parse fails on malformed array string
              activityLogs = trimmed.slice(1, -1).split(/,\s*(?=['"])/);
            }
          } else {
            // Split raw string entries by comma preceding log prefixes
            activityLogs = trimmed.split(/,\s*(?=['"]?(?:ADMIN|TEACHER|\())/i);
            if (activityLogs.length === 1 && trimmed.includes(",")) {
              activityLogs = trimmed.split(",");
            }
          }
        } else if (Array.isArray(rawLogs)) {
          activityLogs = rawLogs;
        }

        // Sanitize and clean up quotation artifacts from each log item
        activityLogs = activityLogs.map(item => {
          let str = (typeof item === "object" && item !== null)
            ? (item.action || item.message || JSON.stringify(item))
            : String(item);

          return str
            .replace(/^["'\s\[\\]+|["'\s\]\\]+$/g, '') // strip outer quotes/brackets
            .replace(/\\"/g, '"')                       // unescape internal quotes
            .trim();
        }).filter(Boolean);
      }
    } catch (e) {
      activityLogs = [];
    }
    
    const success = req.session.success || null;
    const error = req.session.error || null;
    const principalName = req.session.userName || (require('../config/setupWizard').getSetupConfig()?.principal?.name) || 'Principal';
    delete req.session.success;
    delete req.session.error;

    res.render("principal-dashboard.ejs", {
      students,
      teachers,
      gradingMatrix,
      activityLogs,
      gradingConfig,
      success,
      error,
      principalName
    });
  } catch (err) {
    console.error("Principal Dashboard Render Error:", err);
    res.render("principal-dashboard.ejs", { 
      students: [], teachers: [], gradingMatrix: {}, activityLogs: [], success: null,
      error: `Error loading Principal view: ${err.message}` 
    });
  }
};

// 2. 🛠️ DB ADMIN DASHBOARD
const renderAdminDashboard = async (req, res) => {
  try {
    const { byclass, bydep, searchName } = req.query;
    let students = await getAllStudentsFromDB();

    if (byclass) students = students.filter(s => s.Class === byclass);
    if (bydep) students = students.filter(s => s.department === bydep);
    if (searchName) {
      const query = searchName.toLowerCase().trim();
      students = students.filter(s => 
        (s.Firstname && s.Firstname.toLowerCase().includes(query)) ||
        (s.Lastname && s.Lastname.toLowerCase().includes(query))
      );
    }
    //Get all subjects
    const allSubjects = [...new Set(Object.values(studentSubjects).flat())];
    // Fetch teachers list
    const rawTeacherKeys = await queryDB("KEYS teacher:*");
    const tKeys = rawTeacherKeys ? rawTeacherKeys.split(",") : [];
    let teachers = [];
    for (let tk of tKeys) {
      if (!tk.trim()) continue;
      const rawT = await queryDB(`GET ${tk}`);
      if (rawT && rawT !== "NULL") {
        const tObj = JSON.parse(rawT);
        tObj.id = tk.split(":")[1];
        teachers.push(tObj);
      }
    }

    res.render("admin-dashboard.ejs", { students, teachers, allSubjects });
  } catch (err) {
    req.session.error = `Error loading Admin dashboard: ${err.message}`;
    res.render("admin-dashboard.ejs", { students: [], teachers: [] });
  }
};

// 3. ➕ ADD NEW STUDENT (Admin)
const addingStudents = async (req, res) => {
  const validationError = ValidateStudentData(req.body);
  if (validationError) {
    req.session.error = validationError;
    return res.redirect("/admin");
  }

  try {
    const generateId = await queryDB("NEXT_ID");
    const { Firstname, Lastname, age, residence, gender, post, Class, department } = req.body;

    // 1. Get base subjects defined for this department/class tier
    let subjectNames = [...(studentSubjects[department] || studentSubjects["Not in senior class"])];

    // 2. Format subjects into assignedSubjects array
    let assignedSubject = subjectNames.map(title => ({ title, examScore: 0, TestScore: 0 }));

    const record = JSON.stringify({
      Firstname, Lastname, age: Number(age), residence, gender, post, Class, department,
      assignedSubjects: assignedSubject, history: {}
    });

    await queryDB(`SET student:${generateId} ${record}`);
    await queryDB(`LOG_ACTIVITY Registered new student ${Firstname} ${Lastname} into ${Class}`);

    req.session.success = `✓ Student ${Firstname} ${Lastname} registered successfully (ID: ${generateId})!`;
    res.redirect("/admin");
  } catch (err) {
    req.session.error = `Failed to add student: ${err.message}`;
    res.redirect("/admin");
  }
};

// 4. 📈 PROMOTE / UPDATE STUDENT (Admin)
const UpdatingStudent = async (req, res) => {
  try {
    const {
      id,
      Firstname,
      Lastname,
      age,
      gender,
      residence,
      department,
      post,
      Class,
    } = req.body;

    const rawData = await queryDB(`GET student:${id}`);
    if (!rawData || rawData === "NULL") throw new Error("Student not found");

    let studentObject = JSON.parse(rawData);

    if (Firstname && Firstname.trim()) studentObject.Firstname = Firstname.trim();
    if (Lastname && Lastname.trim()) studentObject.Lastname = Lastname.trim();
    if (age !== undefined && age !== "" && age !== null) studentObject.age = Number(age) || studentObject.age;
    if (gender && gender.trim()) studentObject.gender = gender.trim();
    if (post && post.trim()) studentObject.post = post.trim();

    const nextClass = Class && Class.trim() ? Class.trim() : studentObject.Class;
    const nextDepartment = department && department.trim() ? department.trim() : studentObject.department;
    const nextResidence = residence && residence.trim() ? residence.trim() : studentObject.residence;

    if (studentObject.Class !== nextClass) {
      if (!studentObject.history) studentObject.history = {};
      studentObject.history[studentObject.Class] = studentObject.assignedSubjects;

      let newSubjects = studentSubjects[nextDepartment] || studentSubjects["Not in senior class"] || [];
      studentObject.assignedSubjects = newSubjects.map(title => ({ title, examScore: 0, TestScore: 0 }));
    }

    studentObject.Class = nextClass;
    studentObject.residence = nextResidence;
    studentObject.department = nextDepartment;

    await queryDB(`SET student:${id} ${JSON.stringify(studentObject)}`);
    await queryDB(`LOG_ACTIVITY Updated Student ID ${id} details and class info`);

    req.session.success = `✓ Student ${studentObject.Firstname || "ID"} ${studentObject.Lastname || id} updated successfully.`;
    res.redirect("/admin");
  } catch (err) {
    req.session.error = err.message;
    res.redirect("/admin");
  }
};

// 5. 🎓 ARCHIVE / GRADUATE STUDENT (Admin)
const graduateStudent = async (req, res) => {
  try {
    const { studentId, departureReason } = req.body;
    if (!studentId) throw new Error("Student ID is required");

    const reason = departureReason || "Graduated SS3";
    const resp = await queryDB(`GRADUATE ${studentId} ${reason}`);

    if (resp.startsWith("OK")) {
      req.session.success = `✓ Student ID ${studentId} moved to Graduated/Archived record sheet.`;
    } else {
      throw new Error(resp);
    }
    res.redirect("/admin");
  } catch (err) {
    req.session.error = `Graduation failed: ${err.message}`;
    res.redirect("/admin");
  }
};

// 6. ❌ DELETE STUDENT (Admin)
const deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) throw new Error("Student ID is required");

    const resp = await queryDB(`DELETE student:${studentId}`);

    if (resp.startsWith("OK")) {
      req.session.success = `✓ Student (ID: ${studentId}) permanently deleted from database.`;
    } else {
      throw new Error(resp);
    }
    res.redirect("/admin");
  } catch (err) {
    req.session.error = `Deletion failed: ${err.message}`;
    res.redirect("/admin");
  }
};

// POST Handler: Principal updates School Grading System Configuration
const saveGradingConfig = async (req, res) => {
  try {
    const { maxTestScore, maxExamScore, gradeA, gradeB, gradeC, gradeD, gradeE } = req.body;

    const testMax = Number(maxTestScore) || 40;
    const examMax = Number(maxExamScore) || 60;

    const newConfig = {
      maxTestScore: testMax,
      maxExamScore: examMax,
      gradingScale: [
        { min: Number(gradeA) || 70, max: 100, grade: "A", remark: "Excellent" },
        { min: Number(gradeB) || 60, max: (Number(gradeA) || 70) - 0.1, grade: "B", remark: "Very Good" },
        { min: Number(gradeC) || 50, max: (Number(gradeB) || 60) - 0.1, grade: "C", remark: "Credit" },
        { min: Number(gradeD) || 45, max: (Number(gradeC) || 50) - 0.1, grade: "D", remark: "Pass" },
        { min: Number(gradeE) || 40, max: (Number(gradeD) || 45) - 0.1, grade: "E", remark: "Fair Pass" },
        { min: 0, max: (Number(gradeE) || 40) - 0.1, grade: "F", remark: "Fail" }
      ]
    };

    await queryDB(`SET config:grading ${JSON.stringify(newConfig)}`);
    await queryDB(`LOG_ACTIVITY "Principal updated school grading structure (Test Max: ${testMax}, Exam Max: ${examMax})"`);

    req.session.success = "✓ School grading system successfully updated!";
    res.redirect("/principal");
  } catch (err) {
    req.session.error = `Failed to update grading system: ${err.message}`;
    res.redirect("/principal");
  }
};

const exportStudentsToExcel = async (req, res) => {
  try {
    const students = await getAllStudentsFromDB();
    const exportRows = students.map((student) => ({
      ID: student.id,
      'First Name': student.Firstname || '',
      'Last Name': student.Lastname || '',
      Age: student.age || '',
      Gender: student.gender || '',
      Residence: student.residence || '',
      Class: student.Class || '',
      Department: student.department || '',
      Position: student.post || '',
    }));

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Students');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="mount-zion-students.xlsx"');
    res.send(buffer);
  } catch (err) {
    req.session.error = `Export failed: ${err.message}`;
    res.redirect('/admin');
  }
};

const importStudentsFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('Please select an Excel file to import.');
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const importRecords = parseImportedStudentRows(rows);

    if (!importRecords.length) {
      throw new Error('No student records were found in the selected file.');
    }

    let importedCount = 0;
    for (const studentRecord of importRecords) {
      if (!studentRecord.Firstname || !studentRecord.Lastname || !studentRecord.Class) {
        continue;
      }

      const generatedId = await queryDB('NEXT_ID');
      await queryDB(`SET student:${generatedId} ${JSON.stringify(studentRecord)}`);
      importedCount += 1;
    }

    if (importedCount === 0) {
      throw new Error('No valid student rows were imported. Ensure the sheet has First Name, Last Name, and Class columns.');
    }

    req.session.success = `✓ ${importedCount} student record(s) imported successfully from Excel.`;
    res.redirect('/admin');
  } catch (err) {
    req.session.error = err.message;
    res.redirect('/admin');
  }
};

module.exports = {
  renderPrincipalDashboard,
  renderAdminDashboard,
  addingStudents,
  UpdatingStudent,
  graduateStudent,
  getAllStudentsFromDB,
  deleteStudent,
  saveGradingConfig,
  exportStudentsToExcel,
  importStudentsFromExcel,
  upload,
};