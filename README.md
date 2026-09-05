# ScholarBase Desktop Edition (V1.0)

ScholarBase is an offline-first desktop school management system designed to streamline school administrative operations, teacher grading workflows, principal oversight, and student report sheet generation without requiring an active internet connection.

---

## 📌 The Problem ScholarBase Solves

Many educational institutions struggle with traditional paper-based record keeping or unreliable web-only applications:

* **Internet Dependence:** Cloud-only software becomes unusable in areas with unstable or non-existent internet connections.
* **Manual Record Bottlenecks:** Calculating student grades, term averages, and class positions by hand leads to errors and delays in issuing report cards.
* **Lack of Data Privacy & Control:** Offline environments often lack structured access control, leading to unauthorized grade modifications or lost records.

ScholarBase addresses these challenges by combining a local desktop runtime with encrypted local storage and role-based workflows, ensuring fast and reliable operations completely offline.

---

## ✨ Key Features

### 1. Administrative Control Panel
* **Student Lifecycle Management:** Add, edit, promote, archive, or delete student profiles.
* **Teacher Management:** Register staff, generate secure passkeys, and assign specific classes and subjects.
* **Spreadsheet Data Pipelines:** Ingest and export student rosters using standard Excel (`.xlsx`) and CSV spreadsheets.

### 2. Teacher Portal
* **Passkey Authentication:** Quick, secure authentication for staff members.
* **Streamlined Score Entry:** Grade entry interfaces for test and exam assessments.
* **Automated Remark Flow:** Submit subject-level and class-teacher remarks directly to the principal's review queue.

### 3. Principal Oversight & Approval Dashboard
* **Grading Completion Matrix:** Monitor class and subject grading progress in real-time.
* **Remark Review & Sign-Off:** Review, approve, or adjust teacher remarks before finalizing student reports.
* **Audit & Security:** Role-separated dashboard controls backed by emergency password recovery key handling.

### 4. Electronic Report Generation
* Automated calculation of total scores, grade averages, and performance metrics.
* Individual student report card view ready for print or digital distribution.

---

## 🚀 Future Roadmap: ScholarBase V2.0 (Cloud Edition)

We are actively developing **ScholarBase V2.0**, an enterprise-ready cloud edition designed for multi-school deployments:

* **Containerized Multi-Tenancy:** Automated Docker orchestration giving every school an isolated database instance.
* **Cloud & Cross-Device Sync:** Real-time online synchronization allowing teachers and principals to access portals from anywhere.
* **Parent & Student Portals:** Secure web access for parents to view term report cards online.

---

## 🛠 Tech Stack

* **Desktop Application Shell:** Electron.js
* **Backend Framework:** Node.js & Express.js
* **Templating Engine:** EJS with custom UI layouts
* **Database Layer:** Python SQLite Service Daemon (inter-process socket communication)
* **Build System:** PyInstaller & `electron-builder` via GitHub Actions CI/CD

---

## ⚙️ Local Development Setup

### Prerequisites
* Node.js (v18 or higher)
* Python (v3.10 or higher)

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/G3TECH1/ScholarBase.git](https://github.com/G3TECH1/ScholarBase.git)
   cd ScholarBase