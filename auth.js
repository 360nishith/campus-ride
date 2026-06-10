const nmamitEmailPattern = /^[^\s@]+@nmamit\.in$/;
const forms = document.querySelectorAll("[data-account-form]");
const currentUserKey = "campusRideCurrentUser";
const studentVerificationKey = "campusRideStudentVerifications";

function getStudentVerifications() {
  try {
    return JSON.parse(localStorage.getItem(studentVerificationKey)) || {};
  } catch (error) {
    return {};
  }
}

function hasStudentVerification(email) {
  const verifications = getStudentVerifications();
  return Boolean(verifications[email]?.collegeIdCollected);
}

function hasRiderVerification(email) {
  const verifications = getStudentVerifications();
  return Boolean(verifications[email]?.riderOnboardingComplete);
}

function saveCurrentUser(email, role, name = "") {
  localStorage.setItem(
    currentUserKey,
    JSON.stringify({
      email,
      role,
      name,
      loggedInAt: new Date().toISOString(),
    })
  );
}

forms.forEach((form) => {
  const emailInput = form.querySelector('input[name="email"]');
  const emailError = form.querySelector("[data-email-error]");
  const mode = form.dataset.mode;
  const role = form.dataset.role;

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

    const name = form.querySelector('input[name="name"]')?.value.trim() || "";

    if (mode === "login") {
      saveCurrentUser(email, role);

      if (role === "passenger" && !hasStudentVerification(email)) {
        window.location.href = `passenger-onboarding.html?email=${encodeURIComponent(email)}`;
        return;
      }

      if (role === "rider" && !hasRiderVerification(email)) {
        window.location.href = `rider-onboarding.html?email=${encodeURIComponent(email)}`;
        return;
      }

      window.location.href = role === "passenger" ? "passenger-landing.html" : "index.html";
      return;
    }

    if (mode === "signup") {
      saveCurrentUser(email, role, name);

      if (role === "passenger") {
        window.location.href = `passenger-onboarding.html?email=${encodeURIComponent(email)}`;
        return;
      }

      if (role === "rider") {
        window.location.href = `rider-onboarding.html?email=${encodeURIComponent(email)}`;
        return;
      }
    }

    form.reset();
  });
});
