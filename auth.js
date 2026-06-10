const nmamitEmailPattern = /^[^\s@]+@nmamit\.in$/;
const forms = document.querySelectorAll("[data-account-form]");

forms.forEach((form) => {
  const emailInput = form.querySelector('input[name="email"]');
  const emailError = form.querySelector("[data-email-error]");

  emailInput.addEventListener("input", () => {
    emailError.textContent = "";
    emailInput.removeAttribute("aria-invalid");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();

    if (!nmamitEmailPattern.test(email)) {
      emailError.textContent = "enter valid email address";
      emailInput.setAttribute("aria-invalid", "true");
      emailInput.focus();
      return;
    }

    emailError.textContent = "";
    emailInput.removeAttribute("aria-invalid");
    form.reset();
  });
});
