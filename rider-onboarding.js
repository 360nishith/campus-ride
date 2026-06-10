const currentUserKey = "campusRideCurrentUser";
const studentVerificationKey = "campusRideStudentVerifications";

const form = document.querySelector("[data-rider-onboarding]");
const emailInput = form.querySelector('input[name="email"]');
const collegeIdSection = form.querySelector("[data-college-id-section]");
const collegeIdInputs = collegeIdSection.querySelectorAll('input[type="file"]');
const existingIdMessage = form.querySelector("[data-existing-id-message]");
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

function fillExistingDetails(verification, currentUser) {
  const sharedFields = ["name", "usn", "branch", "year", "phone"];

  sharedFields.forEach((field) => {
    const input = form.elements[field];
    const value = verification?.[field] || (field === "name" ? currentUser.name : "");

    if (input && value) {
      input.value = value;
    }
  });
}

function saveRiderVerification(email, details) {
  const verifications = getVerifications();
  const existing = verifications[email] || {};

  verifications[email] = {
    ...existing,
    ...details,
    collegeIdCollected: true,
    riderOnboardingComplete: true,
    riderVerifiedAt: new Date().toISOString(),
  };

  localStorage.setItem(studentVerificationKey, JSON.stringify(verifications));
}

const email = getCurrentEmail();
const currentUser = getJson(currentUserKey, {});
const existingVerification = getVerifications()[email];
const collegeIdAlreadyCollected = Boolean(existingVerification?.collegeIdCollected);

if (!email) {
  errorMessage.textContent = "Login before rider onboarding.";
  form.querySelector("button").disabled = true;
} else if (existingVerification?.riderOnboardingComplete) {
  window.location.href = "index.html";
} else {
  emailInput.value = email;
  fillExistingDetails(existingVerification, currentUser);

  if (collegeIdAlreadyCollected) {
    collegeIdSection.hidden = true;
    collegeIdInputs.forEach((input) => {
      input.required = false;
    });
    existingIdMessage.textContent =
      "College ID already collected during passenger onboarding. No need to upload it again.";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  errorMessage.textContent = "";
  successMessage.textContent = "";

  if (!form.checkValidity()) {
    errorMessage.textContent = collegeIdAlreadyCollected
      ? "Complete all rider details and upload both driving licence photos."
      : "Complete all rider details and upload the driving licence and college ID photos.";
    form.reportValidity();
    return;
  }

  const formData = new FormData(form);
  const upiId = formData.get("upiId").trim().toLowerCase();

  if (!/^[a-z0-9._-]{2,256}@[a-z0-9.-]{2,64}$/i.test(upiId)) {
    errorMessage.textContent = "Enter a valid UPI ID, for example name@bank.";
    form.elements.upiId.focus();
    return;
  }

  const details = {
    name: formData.get("name").trim(),
    usn: formData.get("usn").trim().toUpperCase(),
    branch: formData.get("branch").trim().toUpperCase(),
    year: formData.get("year"),
    phone: formData.get("phone").trim(),
    upiId,
    drivingLicenseFiles: {
      front: formData.get("dlFront").name,
      back: formData.get("dlBack").name,
    },
  };

  if (!collegeIdAlreadyCollected) {
    details.collegeIdFiles = {
      front: formData.get("idFront").name,
      back: formData.get("idBack").name,
    };
    details.sourceRole = "rider";
    details.verifiedAt = new Date().toISOString();
  }

  saveRiderVerification(email, details);

  successMessage.textContent = "Rider onboarding completed.";
  window.setTimeout(() => {
    window.location.href = "index.html";
  }, 700);
});
