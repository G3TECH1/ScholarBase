document.documentElement.classList.add("js-motion");

const currentPage = window.location.pathname.split("/").pop() || "index.html";

document.querySelectorAll(".navbar .nav-link").forEach((link) => {
  const linkPage = new URL(link.href, window.location.href).pathname.split("/").pop();
  if (linkPage === currentPage) {
    link.setAttribute("aria-current", "page");
  }
});

document.querySelectorAll("[data-current-year]").forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

const revealItems = document.querySelectorAll("[data-reveal]");

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

document.querySelectorAll("[data-contact-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    const values = new FormData(form);
    const subject = `ScholarBase enquiry from ${values.get("school")}`;
    const body = [
      `Name: ${values.get("name")}`,
      `Email: ${values.get("email")}`,
      `School: ${values.get("school")}`,
      `Interested in: ${values.get("interest")}`,
      "",
      `Message: ${values.get("message") || "No additional message"}`
    ].join("\n");
    const recipient = form.dataset.contactEmail;
    const status = form.querySelector(".form-note");

    if (!recipient) {
      status.textContent = "Please email support@g3tech.com to send your enquiry.";
      return;
    }

    status.textContent = "Your email app should open with the enquiry details. Please send the email to complete your request.";
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
});
