const express = require("express");
const router = express.Router();

const { getSetupConfig, verifyPassword } = require("../config/setupWizard");
const {
  renderPrincipalDashboard,
  renderAdminDashboard,
  addingStudents,
  UpdatingStudent,
  graduateStudent,
  deleteStudent,
  saveGradingConfig,
  exportStudentsToExcel,
  importStudentsFromExcel,
  upload
} = require("../controller/studentrecord");

const {
  addTeacher,
  renderTeacherPortal,
  verifyTeacherPasskey,
  getTeacherByPasskey,
  saveTeacherGrades,
  saveStudentRemarks,
  deleteTeacher
} = require("../controller/teacherController");

const {renderReportSheet} = require("../controller/reportSheetController")
const {studentSubjects} = require("../model/studentDB")

const requireAdmin = (req, res, next) => {
  if (!req.session || req.session.role !== "admin" || !req.session.masterKey) {
    return res.redirect("/"); // Redirect unauthorized users back to login/home
  }
  
  const config = getSetupConfig();
  if (!config || !verifyPassword(req.session.masterKey, config.admin.passwordHash)) {
    return res.redirect("/");
  }
  
  next();
};

const requirePrincipal = (req, res, next) => {
  if (!req.session || req.session.role !== "principal" || !req.session.masterKey) {
    return res.redirect("/"); // Redirect unauthorized users back to login/home
  }
  
  const config = getSetupConfig();
  if (!config || !verifyPassword(req.session.masterKey, config.principal.passwordHash)) {
    return res.redirect("/");
  }
  
  next();
};

const requireAdminOrPrincipal = (req, res, next) =>{
  if (!req.session || !req.session.masterKey) {
    return res.redirect("/"); // Redirect unauthorized users back to login/home
  }
  const {role, masterKey} = req.session

  const config = getSetupConfig()
  if(!config) return res.redirect("/")
  if (role ==="admin" && verifyPassword(req.session.masterKey, config.admin.passwordHash)) {
    return next()
  }
  if (role ==="principal" && verifyPassword(req.session.masterKey, config.principal.passwordHash)) {
    return next()
  }

  return res.redirect("/")
}
// Teacher Routes (No authentication required - these are public)
router.get("/teacher", renderTeacherPortal);
router.post("/teacher/get-info", getTeacherByPasskey);
router.post("/teacher/auth", verifyTeacherPasskey);
router.post("/teacher/save-grade", saveTeacherGrades);
router.post("/save-remark", saveStudentRemarks);

// Principal Routes (Authentication required)
router.get("/principal", requirePrincipal, renderPrincipalDashboard);
router.post("/principal/grading-config", requirePrincipal,saveGradingConfig);
router.post("/principal/update-name", requirePrincipal, (req, res) => {
  const { updatePrincipalName } = require("../config/setupWizard");
  const result = updatePrincipalName(req.body.principalName);

  if (!result.success) {
    req.session.error = result.message;
    return res.redirect('/principal');
  }

  req.session.userName = result.name;
  req.session.success = `Principal name updated to ${result.name}.`;
  return res.redirect('/principal');
});
router.get("/reportsheet", requireAdminOrPrincipal,renderReportSheet)

// Admin Routes (Authentication required)
router.get("/admin", requireAdmin, renderAdminDashboard);
router.post("/admin/add-student", requireAdmin, addingStudents);
router.post("/admin/update-student", requireAdmin, UpdatingStudent);
router.post("/admin/graduate-student", requireAdmin, graduateStudent);
router.post("/admin/add-teacher", requireAdmin, addTeacher);
router.post("/admin/delete-student", requireAdmin, deleteStudent);
router.post("/admin/delete-teacher", requireAdmin, deleteTeacher);
router.get("/admin/export-students", requireAdmin, exportStudentsToExcel);
router.post("/admin/import-students", requireAdmin, upload.single('studentFile'), importStudentsFromExcel);

router.get("/clear-logs", async (req, res) => {
  const { queryDB } = require("../config/dbDriver");
  await queryDB("DELETE logs:activities");
  res.send("Activity logs cleared! You can now test adding new teachers or students.");
});
module.exports = router;