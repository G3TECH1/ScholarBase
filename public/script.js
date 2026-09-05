document.addEventListener("DOMContentLoaded", () => {
    // Add Student Modal controls
    const addBtn = document.getElementById("addModal");
    const addModal = document.getElementById("adding-student-modal");
    const closeBtn = document.getElementById("close-btn");

    if (addBtn && addModal) {
        addBtn.addEventListener("click", () => addModal.style.display = "flex");
    }
    if (closeBtn && addModal) {
        closeBtn.addEventListener("click", () => addModal.style.display = "none");
    }

    const importTrigger = document.getElementById("importStudentsTrigger");
    const fileInput = document.getElementById("studentFileInput");
    const submitImportBtn = document.querySelector(".submit-import-btn");

    if (importTrigger && fileInput) {
        importTrigger.addEventListener("click", () => {
            fileInput.click();
        });
    }

    if (fileInput && submitImportBtn) {
        fileInput.addEventListener("change", () => {
            if (fileInput.files && fileInput.files.length > 0) {
                submitImportBtn.style.display = "inline-flex";
            } else {
                submitImportBtn.style.display = "none";
            }
        });
    }

    // Handle alert close buttons (manual dismiss, not auto)
    const closeButtons = document.querySelectorAll(".success-msg .alert-close-btn, .alert .alert-close-btn");
    closeButtons.forEach(btn => {
        btn.addEventListener("click", function() {
            const alert = this.closest(".success-msg, .alert");
            alert.style.opacity = "0";
            alert.style.transition = "opacity 0.5s ease";
            setTimeout(() => alert.remove(), 500);
        });
    });
});
// --- MASTER KEY LOGIC (Code Updated)---
// const ADMIN_MASTER_PIN = "778899"; // Change this to your desired admin pin

// function unlockAdmin() {
//     const input = document.getElementById("master-key-input").value;
//     if (input === ADMIN_MASTER_PIN) {
//         document.getElementById("master-lock-screen").style.display = "none";
//         document.getElementById("admin-content").style.display = "block";
//     } else {
//         document.getElementById("lock-error").style.display = "block";
//         document.getElementById("master-key-input").value = "";
//     }
// }

// Allow pressing "Enter" to unlock
document.addEventListener("DOMContentLoaded", () => {
    const keyInput = document.getElementById("master-key-input");
    if(keyInput) {
        keyInput.addEventListener("keypress", function(e) {
            if (e.key === "Enter") unlockAdmin();
        });
    }
});

// --- TOGGLE PASSKEY VISIBILITY (EYE ICON) ---
function togglePasskey(btnElement) {
    const span = btnElement.previousElementSibling;
    const rawKey = span.getAttribute("data-raw");
    
    if (span.innerText === "••••••••") {
        span.innerText = rawKey; // Reveal
        btnElement.innerText = "🔒"; 
    } else {
        span.innerText = "••••••••"; // Hide
        btnElement.innerText = "👁️";
    }
}

function populateUpdateForm(id, currentClass, currentRes, currentDept) {
    document.getElementById('update-id').value = id;
    document.getElementById('update-class').value = currentClass;
    document.getElementById('update-res').value = currentRes;
    document.getElementById('update-dept').value = currentDept || 'Not in senior class';
    document.querySelector('.update').scrollIntoView({ behavior: 'smooth' });
}

function openGraduateModal(studentId, studentName) {
    document.getElementById('grad-student-id').value = studentId;
    document.getElementById('grad-student-name').innerText = studentName + " (ID: " + studentId + ")";
    document.getElementById('graduateModal').style.display = 'flex';
}