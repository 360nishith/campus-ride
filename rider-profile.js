const currentUserKey = "campusRideCurrentUser";
const studentVerificationKey = "campusRideStudentVerifications";
const riderRidesKey = "campusRideRiderRides";

// ========== Utility Functions ==========

function getJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch (error) {
    return fallback;
  }
}

function getCurrentUser() {
  const user = getJson(currentUserKey, null);
  if (user && user.role === "rider") {
    return user;
  }
  return null;
}

function getRiderVerification(email) {
  const verifications = getJson(studentVerificationKey, {});
  return verifications[email] || null;
}

function saveRiderVerification(email, details) {
  const verifications = getJson(studentVerificationKey, {});
  verifications[email] = {
    ...verifications[email],
    ...details,
  };
  localStorage.setItem(studentVerificationKey, JSON.stringify(verifications));
}

function getRiderRides(email) {
  const allRides = getJson(riderRidesKey, []);
  return allRides.filter((ride) => ride.riderEmail === email);
}

function redirectToLogin() {
  window.location.href = "login-rider.html";
}

function logout() {
  localStorage.removeItem(currentUserKey);
  redirectToLogin();
}

function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : "R";
}

function formatYearDisplay(year) {
  const yearMap = {
    "1": "1st year",
    "2": "2nd year",
    "3": "3rd year",
    "4": "4th year",
  };
  return yearMap[year] || year;
}

// ========== Load Profile ==========

function loadProfile() {
  const user = getCurrentUser();
  if (!user) {
    redirectToLogin();
    return;
  }

  const verification = getRiderVerification(user.email);
  if (!verification) {
    alert("Profile data not found");
    window.location.href = "rider-landing.html";
    return;
  }

  // Display basic info
  const name = verification.name || user.name || "Rider";
  document.querySelector("[data-rider-name]").textContent = name;
  document.querySelector("[data-rider-email]").textContent = user.email;
  document.querySelector("[data-initial]").textContent = getInitial(name);

  // Display joined date
  const joinedDate = new Date(user.loggedInAt || Date.now()).toLocaleDateString();
  document.querySelector("[data-joined-date]").textContent = `Joined on ${joinedDate}`;

  // Display academic info
  document.querySelector("[data-usn]").textContent = verification.usn || "-";
  document.querySelector("[data-branch]").textContent = verification.branch || "-";
  document.querySelector("[data-year]").textContent = formatYearDisplay(verification.year) || "-";

  // Display contact info
  document.querySelector("[data-phone]").textContent = verification.phone || "-";
  document.querySelector("[data-upi]").textContent = verification.upiId || "-";

  // Load statistics
  const rides = getRiderRides(user.email);
  document.querySelector("[data-total-rides]").textContent = rides.length;

  const completedRides = rides.filter((r) => r.status === "completed").length;
  document.querySelector("[data-completed-rides]").textContent = completedRides;

  const totalRevenue = rides.reduce((total, ride) => {
    const seatsBooked = ride.seatsBooked || 0;
    const distance = ride.estimatedDistance || 0;
    const revenue = seatsBooked * distance * ride.costPerKm;
    return total + revenue;
  }, 0);
  document.querySelector("[data-rider-revenue]").textContent = `₹${totalRevenue.toFixed(2)}`;

  // Pre-fill edit form
  const form = document.getElementById("edit-profile-form");
  form.querySelector('input[name="name"]').value = verification.name || "";
  form.querySelector('input[name="phone"]').value = verification.phone || "";
  form.querySelector('input[name="upiId"]').value = verification.upiId || "";
  form.querySelector('input[name="branch"]').value = verification.branch || "";
  form.querySelector('select[name="year"]').value = verification.year || "";
}

// ========== Modal Functions ==========

function openEditModal() {
  const modal = document.getElementById("edit-profile-modal");
  modal.setAttribute("aria-hidden", "false");
}

function closeEditModal() {
  const modal = document.getElementById("edit-profile-modal");
  modal.setAttribute("aria-hidden", "true");
}

// ========== Event Handlers ==========

function handleEditSubmit(event) {
  event.preventDefault();

  const user = getCurrentUser();
  if (!user) {
    redirectToLogin();
    return;
  }

  const form = event.target;
  const formData = {
    name: form.querySelector('input[name="name"]').value.trim(),
    phone: form.querySelector('input[name="phone"]').value.trim(),
    upiId: form.querySelector('input[name="upiId"]').value.trim(),
    branch: form.querySelector('input[name="branch"]').value.trim(),
    year: form.querySelector('select[name="year"]').value.trim(),
  };

  // Validate
  if (!formData.name || !formData.phone || !formData.upiId || !formData.branch || !formData.year) {
    const errorElement = form.querySelector("[data-edit-error]");
    errorElement.textContent = "Please fill in all fields";
    return;
  }

  if (!/^[0-9]{10}$/.test(formData.phone)) {
    const errorElement = form.querySelector("[data-edit-error]");
    errorElement.textContent = "Phone number must be 10 digits";
    return;
  }

  if (!/^[a-z0-9._-]{2,256}@[a-z0-9.-]{2,64}$/i.test(formData.upiId)) {
    const errorElement = form.querySelector("[data-edit-error]");
    errorElement.textContent = "Enter a valid UPI ID (e.g., name@bank)";
    return;
  }

  try {
    // Update verification data
    saveRiderVerification(user.email, formData);

    // Update current user if name changed
    const currentUser = getJson(currentUserKey, {});
    if (formData.name !== currentUser.name) {
      currentUser.name = formData.name;
      localStorage.setItem(currentUserKey, JSON.stringify(currentUser));
    }

    closeEditModal();
    alert("Profile updated successfully!");
    loadProfile();
  } catch (error) {
    console.error("Error saving profile:", error);
    const errorElement = form.querySelector("[data-edit-error]");
    errorElement.textContent = "Failed to update profile. Please try again.";
  }
}

function handleDeleteProfile() {
  const user = getCurrentUser();
  if (!user) {
    redirectToLogin();
    return;
  }

  const confirmation = confirm(
    "Are you sure you want to delete your account? This action cannot be undone. All your rides and data will be permanently deleted."
  );

  if (!confirmation) {
    return;
  }

  const doubleConfirm = confirm(
    `Type your email "${user.email}" to confirm account deletion.`
  );

  if (!doubleConfirm) {
    return;
  }

  // Prompt for email confirmation
  const enteredEmail = prompt(`Confirm by typing your email: ${user.email}`);
  if (enteredEmail !== user.email) {
    alert("Email does not match. Account deletion cancelled.");
    return;
  }

  try {
    // Remove from verification
    const verifications = getJson(studentVerificationKey, {});
    delete verifications[user.email];
    localStorage.setItem(studentVerificationKey, JSON.stringify(verifications));

    // Remove user account
    localStorage.removeItem(currentUserKey);

    // Remove all rider rides
    const allRides = getJson(riderRidesKey, []);
    const filteredRides = allRides.filter((ride) => ride.riderEmail !== user.email);
    localStorage.setItem(riderRidesKey, JSON.stringify(filteredRides));

    alert("Account deleted successfully. Redirecting to home page...");
    window.location.href = "index.html";
  } catch (error) {
    console.error("Error deleting account:", error);
    alert("Failed to delete account. Please try again.");
  }
}

function handleLogout() {
  if (confirm("Are you sure you want to logout?")) {
    logout();
  }
}

// ========== Initialization ==========

document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();
  if (!user) {
    redirectToLogin();
    return;
  }

  loadProfile();

  // Edit button
  document.getElementById("edit-profile-btn").addEventListener("click", openEditModal);

  // Delete button
  document.getElementById("delete-profile-btn").addEventListener("click", handleDeleteProfile);

  // Logout button
  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  // Edit form
  const editForm = document.getElementById("edit-profile-form");
  editForm.addEventListener("submit", handleEditSubmit);

  // Modal close
  const modalCloseBtn = document.querySelector(".modal-close-btn");
  modalCloseBtn.addEventListener("click", closeEditModal);

  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  modalCancelBtn.addEventListener("click", closeEditModal);

  // Close on outside click
  const modal = document.getElementById("edit-profile-modal");
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeEditModal();
    }
  });

  // Clear errors on input
  editForm.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", () => {
      editForm.querySelector("[data-edit-error]").textContent = "";
    });
  });
});
