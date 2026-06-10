const currentUserKey = "campusRideCurrentUser";
const studentVerificationKey = "campusRideStudentVerifications";

const form = document.querySelector("[data-passenger-onboarding]");
const emailInput = form.querySelector('input[name="email"]');
const errorMessage = form.querySelector("[data-onboarding-error]");
const successMessage = form.querySelector("[data-onboarding-success]");

function getJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch (error) {
    return fallback;
  }
}

function getCurrentEmail() {
  const params = new URLSearchParams(window.location.search);
  const emailFromUrl = params.get("email");
  const currentUser = getJson(currentUserKey, {});
  return (emailFromUrl || currentUser.email || "").trim().toLowerCase();
}

function getVerifications() {
  return getJson(studentVerificationKey, {});
}

function saveVerification(email, details) {
  const verifications = getVerifications();

  verifications[email] = {
    ...verifications[email],
    ...details,
    collegeIdCollected: true,
    sourceRole: "passenger",
    verifiedAt: new Date().toISOString(),
  };

  localStorage.setItem(studentVerificationKey, JSON.stringify(verifications));
}

const email = getCurrentEmail();
const existingVerification = getVerifications()[email];

if (!email) {
  errorMessage.textContent = "Login before passenger onboarding.";
  form.querySelector("button").disabled = true;
} else if (existingVerification?.collegeIdCollected) {
  window.location.href = "passenger-landing.html";
} else {
  emailInput.value = email;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMessage.textContent = "";
  successMessage.textContent = "";

  if (!form.checkValidity()) {
    errorMessage.textContent = "Complete all passenger details and upload both ID photos.";
    form.reportValidity();
    return;
  }

  const formData = new FormData(form);
  const idFront = formData.get("idFront");
  const idBack = formData.get("idBack");

  saveVerification(email, {
    name: formData.get("name").trim(),
    usn: formData.get("usn").trim().toUpperCase(),
    branch: formData.get("branch").trim().toUpperCase(),
    year: formData.get("year"),
    phone: formData.get("phone").trim(),
    pickup: formData.get("pickup").trim(),
    collegeIdFiles: {
      front: idFront.name,
      back: idBack.name,
    },
  });

  successMessage.textContent = "Passenger onboarding completed.";
  window.setTimeout(() => {
    window.location.href = "passenger-landing.html";
  }, 700);
});
