const { queryDB } = require("../config/dbDriver");
const crypto = require("crypto");

// Import official studentSubjects schema
let studentSubjects;
try {
  studentSubjects = require("../model/studentDB").studentSubjects;
} catch (e) {
  // Fallback in case path varies
  studentSubjects = {
    "Not in senior class": [
      "Math", "English", "Lit-in-English", "Basic-Tech", "Basic-Science",
      "ICT", "Music", "French", "Yoruba", "Fine Art", "Civic Education", "National Security"
    ],
    Science: [
      "Math", "English", "Biology", "Chemistry", "Agric", "DPR",
      "Physics", "Further Maths", "Food & Nuts", "Technical Drawing", "Civic Education", "Economics"
    ],
    Art: [
      "Math", "English", "Government", "Dyeing & Bleaching", "Literature",
      "Food & Nuts", "CRS", "Civic Education", "Economics", "History"
    ],
    Commercial: [
      "Math", "English", "Accounting", "Commerce", "Economics",
      "Civic Education", "Further Maths", "Food & Nuts", "DPR", "Agric"
    ]
  };
}

function generatePasskey() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Checks if a subject is valid for a given student's class & department 
 * based on the official studentSubjects schema.
 */
function isSubjectAllowedForStudent(subjectName, studentClass, department) {
  if (!subjectName) return false;

  const subClean = subjectName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cls = (studentClass || "").toUpperCase().trim();

  // JSS classes automatically use "Not in senior class" schema
  let deptKey = department;
  if (cls.startsWith("JSS") || !deptKey || deptKey === "Not in senior class") {
    deptKey = "Not in senior class";
  }

  const allowedList = studentSubjects[deptKey] || studentSubjects["Not in senior class"];

  // Match subject name flexibly
  return allowedList.some((allowed) => {
    const allowedClean = allowed.toLowerCase().replace(/[^a-z0-9]/g, "");
    return allowedClean === subClean || subClean.includes(allowedClean) || allowedClean.includes(subClean);
  });
}

// Admin adding new teacher
const addTeacher = async (req, res) => {
  try {
    const { name, subjects, classes, departments, isClassTeacher, classTeacherClasses } = req.body;
    if (!name || !subjects)
      throw new Error("Teacher name and subjects are required!");

    const passkey = generatePasskey();
    const hashedPasskey = crypto
      .createHash("sha256")
      .update(passkey)
      .digest("hex");

    const teacherId = `T${Date.now().toString().slice(-4)}`;
    const subjectArray = Array.isArray(subjects)
      ? subjects
      : subjects.split(",").map((s) => s.trim());
    const classesArray = Array.isArray(classes)
      ? classes
      : classes ? [classes] : [];
    const classTeacherFlag = Boolean(isClassTeacher || (Array.isArray(classTeacherClasses) && classTeacherClasses.length > 0));
    const classTeacherClassList = Array.isArray(classTeacherClasses)
      ? classTeacherClasses
      : classTeacherClasses ? [classTeacherClasses] : [];

    // Format selected departments (default to all if none specified)
    const deptArray = Array.isArray(departments)
      ? departments
      : departments ? [departments] : ["Not in senior class", "Science", "Art", "Commercial"];

    const teacherData = JSON.stringify({
      name,
      passkey: hashedPasskey,
      subjects: subjectArray,
      classes: classesArray,
      departments: deptArray,
      isClassTeacher: classTeacherFlag,
      classTeacherClasses: classTeacherFlag ? classTeacherClassList : [],
    });

    await queryDB(`SET teacher:${teacherId} ${teacherData}`);
    await queryDB(`LOG_ACTIVITY "Added Teacher ${name}"`);

    // 2. SYNC: Attach subjects ONLY to matching students (Class AND Department match)
    const rawStudentKeys = await queryDB("KEYS student:*");
    const sKeys = rawStudentKeys ? rawStudentKeys.split(",") : [];
    const upperClasses = classesArray.map(c => c.trim().toUpperCase());

    for (let sk of sKeys) {
      if (!sk.trim()) continue;
      const rawS = await queryDB(`GET ${sk}`);
      if (rawS && rawS !== "NULL") {
        let student = JSON.parse(rawS);
        
        const matchesClass = student.Class && upperClasses.includes(student.Class.trim().toUpperCase());
        const matchesDept = deptArray.includes(student.department);

        // BOTH Class AND Department must match before syncing subjects
        if (matchesClass && matchesDept) {
          if (!student.assignedSubjects) student.assignedSubjects = [];
          
          let modified = false;
          for (let sub of subjectArray) {
            // Validate subject against student department/class schema
            if (isSubjectAllowedForStudent(sub, student.Class, student.department)) {
              const exists = student.assignedSubjects.some(
                s => s.title.toLowerCase().trim() === sub.toLowerCase().trim()
              );
              if (!exists) {
                student.assignedSubjects.push({ title: sub, TestScore: 0, examScore: 0 });
                modified = true;
              }
            }
          }
          if (modified) {
            await queryDB(`SET ${sk} ${JSON.stringify(student)}`);
          }
        }
      }
    }

    req.session.success = `✓ Teacher ${name} added! Assigned Passkey: ${passkey} (Write this down, it is now encrypted!)`;
    res.redirect("/admin");
  } catch (err) {
    req.session.error = err.message;
    res.redirect("/admin");
  }
};


const canTeacherSubmitRemark = (teacherSession, student) => {
  if (!teacherSession || !teacherSession.isClassTeacher) return false;
  if (!student || !student.Class) return false;

  const classTeacherClasses = Array.isArray(teacherSession.classTeacherClasses)
    ? teacherSession.classTeacherClasses
    : [];

  return classTeacherClasses.length > 0
    ? classTeacherClasses.includes(student.Class)
    : teacherSession.classes && teacherSession.classes.includes(student.Class);
};

const saveStudentRemarks = async (req, res) => {
  try {
    const {
      studentId,
      remarkType,
      remark,
      teacherRemark,
      principalRemark,
      daysPresent,
      totalDays,
      remarkScope,
    } = req.body;
    const teacherSession = req.session.teacherSession || null;
    const role = req.session.role || null;
    const isPrincipal = role === "principal";
    const isAdmin = role === "admin";

    if (remarkType === "principalRemark" || principalRemark !== undefined) {
      if (!isPrincipal && !isAdmin) {
        throw new Error("Only the principal or admin can approve or finalise remarks.");
      }

      const principalRemarkText = remark || principalRemark || "";
      const studentIdsForApproval = studentId ? [studentId] : [];

      for (const currentStudentId of studentIdsForApproval) {
        const rawS = await queryDB(`GET student:${currentStudentId}`);
        if (!rawS || rawS === "NULL") continue;

        let student = JSON.parse(rawS);
        student.principalRemark = principalRemarkText.trim();
        student.remarkStatus = "approved";
        student.pendingPrincipalReview = false;
        student.remarksApprovedBy = isPrincipal ? "Principal" : "Admin";
        student.approvedAt = new Date().toISOString();
        await queryDB(`SET student:${currentStudentId} ${JSON.stringify(student)}`);
      }

      req.session.notice = `Principal approval recorded.`;
      req.session.success = "Remarks updated successfully.";
      if (isPrincipal) return res.redirect("/principal");
      if (isAdmin) return res.redirect("/admin");
      return teacherSession ? res.redirect("/teacher") : res.redirect("/admin");
    }

    if (remarkType === "teacherRemark" || teacherRemark !== undefined) {
      const allowedClasses = Array.isArray(teacherSession?.classTeacherClasses)
        ? teacherSession.classTeacherClasses
        : [];

      if (!isPrincipal && !isAdmin && !teacherSession?.isClassTeacher) {
        throw new Error("Only a class teacher, admin, or principal can submit a class remark.");
      }

      const rawKeys = await queryDB("KEYS student:*");
      const studentKeys = rawKeys ? rawKeys.split(",") : [];
      const targetStudentIds = [];

      if (remarkScope === "student" && studentId) {
        targetStudentIds.push(studentId);
      } else if (remarkScope === "all") {
        const classFilter = allowedClasses.length > 0 ? allowedClasses : (teacherSession?.classes || []);

        for (const key of studentKeys) {
          if (!key.trim()) continue;
          const rawS = await queryDB(`GET ${key}`);
          if (!rawS || rawS === "NULL") continue;
          const student = JSON.parse(rawS);
          if (student.Class && classFilter.includes(student.Class)) {
            targetStudentIds.push(student.id || key.split(":")[1]);
          }
        }
      } else {
        targetStudentIds.push(studentId);
      }

      if (!targetStudentIds.length) {
        throw new Error("No student records matched that remark scope.");
      }

      const teacherRemarkText = (remark || teacherRemark || "").trim();
      if (!teacherRemarkText) {
        throw new Error("A remark is required before saving.");
      }

      for (const currentStudentId of [...new Set(targetStudentIds)]) {
        const rawS = await queryDB(`GET student:${currentStudentId}`);
        if (!rawS || rawS === "NULL") continue;

        let student = JSON.parse(rawS);
        const canSubmit = isPrincipal || isAdmin || canTeacherSubmitRemark(teacherSession, student);
        if (!canSubmit) {
          continue;
        }

        student.teacherRemark = teacherRemarkText;
        student.remarkStatus = "pending";
        student.remarkSubmittedBy = teacherSession?.name || (isAdmin ? "Admin" : "Principal");
        student.pendingPrincipalReview = true;
        student.principalRemark = student.principalRemark || "";
        await queryDB(`SET student:${currentStudentId} ${JSON.stringify(student)}`);
      }

      req.session.notice = `Remark submitted to ${targetStudentIds.length} student(s). Waiting for principal approval.`;
      req.session.success = `Remarks saved successfully.`;
      if (isPrincipal) return res.redirect("/principal");
      if (isAdmin) return res.redirect("/admin");
      return teacherSession ? res.redirect("/teacher") : res.redirect("/admin");
    }

    throw new Error("Remark request is missing a valid type.");
  } catch (err) {
    req.session.error = err.message;
    if (req.session.teacherSession) {
      return res.redirect("/teacher");
    }
    res.redirect("/admin");
  }
};



// Mobile Teacher Portal View
const renderTeacherPortal = async (req, res) => {
  try {
    if (req.session.teacherSession) {
      res.render("teacher-portal.ejs", {
        authorizedTeacher: req.session.teacherSession,
        matchedStudents: req.session.teacherStudents || [],
        remarkStudents: req.session.teacherRemarkStudents || req.session.teacherStudents || [],
      });
    } else {
      res.render("teacher-portal.ejs", {
        authorizedTeacher: null,
        matchedStudents: [],
        remarkStudents: [],
        teacherData: null,
      });
    }
  } catch (err) {
    res.render("teacher-portal.ejs", {
      error: err.message,
      authorizedTeacher: null,
      matchedStudents: [],
      remarkStudents: [],
      teacherData: null,
    });
  }
};

// Mobile Teacher Login via Passkey
const verifyTeacherPasskey = async (req, res) => {
  try {
    const { passkey, subjects, classes } = req.body;

    if (!passkey) throw new Error("Passkey is required");

    const hashedInput = crypto
      .createHash("sha256")
      .update(passkey.trim())
      .digest("hex");

    const rawTeacherKeys = await queryDB("KEYS teacher:*");
    const tKeys = rawTeacherKeys ? rawTeacherKeys.split(",") : [];

    let matchedTeacher = null;
    for (let tk of tKeys) {
      if (!tk.trim()) continue;
      const rawT = await queryDB(`GET ${tk}`);
      if (rawT && rawT !== "NULL") {
        const tObj = JSON.parse(rawT);
        if (tObj.passkey === hashedInput) {
          matchedTeacher = tObj;
          break;
        }
      }
    }

    if (!matchedTeacher) throw new Error("Invalid 6-Digit Teacher Passkey!");

    const selectedSubjects = subjects
      ? Array.isArray(subjects) ? subjects : [subjects]
      : matchedTeacher.subjects || [];

    const selectedClasses = classes
      ? Array.isArray(classes) ? classes : [classes]
      : matchedTeacher.classes || [];

    for (let sel of selectedSubjects) {
      if (!matchedTeacher.subjects.includes(sel)) {
        throw new Error(`Unauthorized: You are not assigned to teach ${sel}`);
      }
    }

    for (let sel of selectedClasses) {
      if (!matchedTeacher.classes.includes(sel)) {
        throw new Error(`Unauthorized: You are not assigned to class ${sel}`);
      }
    }

    const classTeacherClasses = Array.isArray(matchedTeacher.classTeacherClasses)
      ? matchedTeacher.classTeacherClasses
      : [];
    const classTeacherFlag = Boolean(matchedTeacher.isClassTeacher || classTeacherClasses.length > 0);
    const teacherRemarkClasses = classTeacherFlag && classTeacherClasses.length > 0 ? classTeacherClasses : selectedClasses;

    req.session.teacherSession = {
      name: matchedTeacher.name,
      passkey,
      subjects: selectedSubjects,
      classes: selectedClasses,
      isClassTeacher: classTeacherFlag,
      classTeacherClasses,
      remarkClasses: teacherRemarkClasses,
    };

    const rawKeys = await queryDB("KEYS student:*");
    const keysArray = rawKeys ? rawKeys.split(",") : [];
    let students = [];
    let remarkStudents = [];

    const upperSelectedClasses = selectedClasses.map((c) => c.trim().toUpperCase());
    const upperRemarkClasses = teacherRemarkClasses.map((c) => c.trim().toUpperCase());

    for (let key of keysArray) {
      if (!key.trim()) continue;
      const rawS = await queryDB(`GET ${key}`);
      if (rawS && rawS !== "NULL") {
        const sObj = JSON.parse(rawS);
        sObj.id = key.split(":")[1];

        if (sObj.Class && upperSelectedClasses.includes(sObj.Class.trim().toUpperCase())) {
          if (!sObj.assignedSubjects) sObj.assignedSubjects = [];
          
          let modified = false;
          // Ensure subject exists on student record ONLY if allowed by schema
          for (let selSub of selectedSubjects) {
            if (isSubjectAllowedForStudent(selSub, sObj.Class, sObj.department)) {
              let subExists = sObj.assignedSubjects.find(s => s.title.toLowerCase().trim() === selSub.toLowerCase().trim());
              if (!subExists) {
                sObj.assignedSubjects.push({ title: selSub, TestScore: 0, examScore: 0 });
                modified = true;
              }
            }
          }

          if (modified) {
            await queryDB(`SET ${key} ${JSON.stringify(sObj)}`);
          }

          students.push(sObj);
        }

        if (sObj.Class && upperRemarkClasses.includes(sObj.Class.trim().toUpperCase())) {
          remarkStudents.push(sObj);
        }
      }
    }
    req.session.teacherStudents = students;
    req.session.teacherRemarkStudents = remarkStudents;
    req.session.success = `Welcome ${matchedTeacher.name}! Access granted for subjects: ${selectedSubjects.join(", ")} in classes: ${selectedClasses.join(", ")}`;
    res.redirect("/teacher");
  } catch (err) {
    req.session.error = err.message;
    res.redirect("/teacher");
  }
};

// API: Get teacher info by passkey
const getTeacherByPasskey = async (req, res) => {
  try {
    const { passkey } = req.body;
    if (!passkey) return res.status(400).json({ error: "Passkey required" });

    const hashedInput = crypto
      .createHash("sha256")
      .update(passkey.trim())
      .digest("hex");

    const rawTeacherKeys = await queryDB("KEYS teacher:*");
    const tKeys = rawTeacherKeys ? rawTeacherKeys.split(",") : [];

    for (let tk of tKeys) {
      if (!tk.trim()) continue;
      const rawT = await queryDB(`GET ${tk}`);
      if (rawT && rawT !== "NULL") {
        const tObj = JSON.parse(rawT);
        if (tObj.passkey === hashedInput) {
          return res.json({
            success: true,
            name: tObj.name,
            subjects: tObj.subjects || [],
            classes: tObj.classes || [],
            isClassTeacher: Boolean(tObj.isClassTeacher || (Array.isArray(tObj.classTeacherClasses) && tObj.classTeacherClasses.length > 0)),
            classTeacherClasses: Array.isArray(tObj.classTeacherClasses) ? tObj.classTeacherClasses : [],
          });
        }
      }
    }

    res.status(401).json({ error: "Invalid passkey" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Teacher saving grades via SECURE_SET
const saveTeacherGrades = async (req, res) => {
  try {
    const { studentId, passkey, subjectName, testScore, examScore } = req.body;
    if (!studentId || !passkey || !subjectName)
      throw new Error("Missing grading authorization info");

    const rawS = await queryDB(`GET student:${studentId}`);
    if (!rawS || rawS === "NULL") throw new Error("Student record not found");

    let studentObj = JSON.parse(rawS);
    let targetSub = (studentObj.assignedSubjects || []).find(
      (s) => s.title === subjectName,
    );

    if (!targetSub) {
      targetSub = { title: subjectName, TestScore: 0, examScore: 0 };
      studentObj.assignedSubjects.push(targetSub);
    }

    targetSub.TestScore = Number(testScore || 0);
    targetSub.examScore = Number(examScore || 0);

    const updatedData = JSON.stringify(studentObj);
    const cmd = `SECURE_SET ${passkey} ${subjectName} student:${studentId} ${updatedData}`;
    const dbResponse = await queryDB(cmd);

    if (dbResponse.startsWith("ERROR")) {
      throw new Error(dbResponse);
    }

    // UPDATE SESSION MEMORY
    if (req.session.teacherStudents) {
      const sessionStudent = req.session.teacherStudents.find(s => s.id === studentId);
      if (sessionStudent) {
        let sSub = (sessionStudent.assignedSubjects || []).find(s => s.title === subjectName);
        if (sSub) {
          sSub.TestScore = Number(testScore || 0);
          sSub.examScore = Number(examScore || 0);
        }
      }
    }

    // AJAX Handler Response
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.json({
        success: true,
        message: `✓ Grade saved for ${studentObj.Firstname} ${studentObj.Lastname}`
      });
    }

    req.session.success = `✓ Grade saved for student ${studentObj.Firstname} ${studentObj.Lastname}`;
    res.redirect("/teacher");
  } catch (err) {
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.status(400).json({ success: false, error: err.message });
    }
    req.session.error = `Failed to save grade: ${err.message}`;
    res.redirect("/teacher");
  }
};

// DELETE TEACHER
const deleteTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body;
    if (!teacherId) throw new Error("Teacher ID is required");

    const resp = await queryDB(`DELETE teacher:${teacherId}`);

    if (resp.startsWith("OK")) {
      req.session.success = `✓ Teacher profile permanently deleted.`;
    } else {
      throw new Error(resp);
    }
    res.redirect("/admin");
  } catch (err) {
    req.session.error = `Deletion failed: ${err.message}`;
    res.redirect("/admin");
  }
};

module.exports = {
  addTeacher,
  renderTeacherPortal,
  verifyTeacherPasskey,
  getTeacherByPasskey,
  saveTeacherGrades,
  saveStudentRemarks,
  deleteTeacher,
  isSubjectAllowedForStudent
};