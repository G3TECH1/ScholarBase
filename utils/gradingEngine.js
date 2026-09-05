const DEFAULT_GRADING_CONFIG = {
    maxTestScore: 40,
    maxExamScore: 60,
    gradingScale: [
        { min: 70, max: 100, grade: "A", remark: "Excellent" },
        { min: 60, max: 69.9, grade: "B", remark: "Very Good" },
        { min: 50, max: 59.9, grade: "C", remark: "Credit" },
        { min: 45, max: 49.9, grade: "D", remark: "Pass" },
        { min: 40, max: 44.9, grade: "E", remark: "Fair Pass" },
        { min: 0, max: 39.9, grade: "F", remark: "Fail" },
    ]
};

// Calculates grade and performance evaluation for a single subject
function evaluateSubjectScore(testInput = 0, examInput = 0, config = DEFAULT_GRADING_CONFIG) {
    const activeConfig = config || DEFAULT_GRADING_CONFIG;
    const maxTest = Number(activeConfig.maxTestScore) || 40;
    const maxExam = Number(activeConfig.maxExamScore) || 60;
    const maxPossible = maxTest + maxExam;

    const test = Math.min(Math.max(Number(testInput) || 0, 0), maxTest);
    const exam = Math.min(Math.max(Number(examInput) || 0, 0), maxExam);
    const total = test + exam;

    // Normalize total to percentage scale (0 - 100%)
    const percentage = maxPossible > 0 ? (total / maxPossible) * 100 : 0;

    const scaleList = activeConfig.gradingScale || DEFAULT_GRADING_CONFIG.gradingScale;
    const match = scaleList.find(scale => percentage >= scale.min && percentage <= scale.max) || {
        grade: "F",
        remark: "Fail"
    };

    return {
        test,
        exam,
        total,
        percentage: Number(percentage.toFixed(1)),
        grade: match.grade,
        remark: match.remark
    };
}

// Calculates student cumulative average, averages, overall totals, and aggregate performance stats
function calculateStudentSummary(assignedSubjects = [], config = DEFAULT_GRADING_CONFIG) {
    let totalTest = 0;
    let totalExam = 0;
    let grandTotal = 0;

    const processedSubjects = assignedSubjects.map(sub => {
        const rawTest = sub.TestScore !== undefined ? sub.TestScore : sub.testScore;
        const rawExam = sub.examScore !== undefined ? sub.examScore : sub.ExamScore;

        const evalData = evaluateSubjectScore(rawTest, rawExam, config);
        totalTest += evalData.test;
        totalExam += evalData.exam;
        grandTotal += evalData.total;

        return {
            ...sub,
            ...evalData
        };
    });

    const subjectCount = processedSubjects.length || 1;

    return {
        processedSubjects,
        totalTest,
        testAvg: (totalTest / subjectCount).toFixed(1),
        totalExam,
        examAvg: (totalExam / subjectCount).toFixed(1),
        grandTotal,
        grandAvg: (grandTotal / subjectCount).toFixed(1)
    };
}

module.exports = {
    DEFAULT_GRADING_CONFIG,
    evaluateSubjectScore,
    calculateStudentSummary
};