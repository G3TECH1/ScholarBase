const { queryDB } = require("../config/dbDriver");
const { calculateStudentSummary, DEFAULT_GRADING_CONFIG } = require("../utils/gradingEngine");

// Render Electronic Report Sheet for Admin & Principal
const renderReportSheet = async (req, res) => {
  try {
    const selectedStudentId = req.query.studentId;

    // 1. Fetch Dynamic Grading Configuration from SQLite DB
    let gradingConfig = DEFAULT_GRADING_CONFIG;
    const rawConfig = await queryDB("GET config:grading");
    if (rawConfig && rawConfig !== "NULL") {
      try {
        gradingConfig = JSON.parse(rawConfig);
      } catch (e) {
        gradingConfig = DEFAULT_GRADING_CONFIG;
      }
    }

    // 2. Fetch all students for dropdown selection
    const rawKeys = await queryDB("KEYS student:*");
    const keysArray = rawKeys ? rawKeys.split(",").filter(Boolean) : [];
    
    let studentList = [];
    let selectedStudent = null;

    for (let key of keysArray) {
      const rawData = await queryDB(`GET ${key}`);
      if (rawData && rawData !== "NULL") {
        const studentObj = JSON.parse(rawData);
        studentObj.id = key.replace("student:", "");
        studentList.push(studentObj);

        if (selectedStudentId && studentObj.id === selectedStudentId) {
          selectedStudent = studentObj;
        }
      }
    }

    if (!selectedStudent && studentList.length > 0) {
      selectedStudent = studentList[0];
    }

    // 3. Process Dynamic Grades & Summary Statistics
    let academicSummary = null;
    if (selectedStudent) {
      academicSummary = calculateStudentSummary(selectedStudent.assignedSubjects || [], gradingConfig);
    }

    res.render("report-sheet.ejs", {
      studentList,
      selectedStudent,
      academicSummary,
      gradingConfig,
      userRole: req.session.userRole || "Admin/Principal"
    });
  } catch (err) {
    res.status(500).send("Error loading report sheet: " + err.message);
  }
};

module.exports = { renderReportSheet };