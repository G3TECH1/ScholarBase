const studentSubjects = {
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

const studentSchema = {
  residenceEnum: ["Day", "Boarding"],
  class: ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"],
  Department: ["Not in senior class", "Science", "Art", "Commercial"],
  gender: ["Male", "Female", "Other"],
  post: [
    "Senior Prefect Boy", "Senior Prefect Girl", "Assistant Senior Prefect Boy",
    "Assistant Senior Prefect Girl", "Chapel Prefect", "Food Prefect",
    "Labour Prefect", "Band Prefect", "Computer Lab Prefect", "Not a Prefect"
  ]
};

function ValidateStudentData(data) {
  if (!data.Firstname || data.Firstname.trim() === "") return "Student First Name is required";
  if (!data.Lastname || data.Lastname.trim() === "") return "Student Last Name is required";
  if (!data.age || isNaN(data.age)) return "Age must be a valid number";
  if (!data.Class || !studentSchema.class.includes(data.Class)) return "Invalid Class Selected";
  if (!data.department || !studentSchema.Department.includes(data.department)) return "Invalid Department Selected";
  if (!data.residence || !studentSchema.residenceEnum.includes(data.residence)) return "Invalid Residence Selected";
  return null;
}

module.exports = { studentSchema, ValidateStudentData, studentSubjects };