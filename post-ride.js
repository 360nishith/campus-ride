const currentUserKey = "campusRideCurrentUser";
const riderRidesKey = "campusRideRiderRides";

// ========== Utility Functions ==========

function getCurrentUser() {
  try {
    const user = JSON.parse(localStorage.getItem(currentUserKey));
    if (user && user.role === "rider") {
      return user;
    }
  } catch (error) {
    console.error("Error getting current user:", error);
  }
  return null;
}

function redirectToLogin() {
  window.location.href = "login-rider.html";
}

function redirectToRiderDashboard() {
  window.location.href = "rider-landing.html";
}

function generateId() {
  return `ride_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getAllRides() {
  try {
    return JSON.parse(localStorage.getItem(riderRidesKey)) || [];
  } catch (error) {
    console.error("Error getting rides:", error);
    return [];
  }
}

function saveRide(ride) {
  const allRides = getAllRides();
  allRides.push(ride);
  localStorage.setItem(riderRidesKey, JSON.stringify(allRides));
}

// ========== Form Validation ==========

function validateForm(formData) {
  const errors = {};

  if (!formData.startLocation.trim()) {
    errors.start = "Start location is required";
  }

  if (!formData.destinationLocation.trim()) {
    errors.destination = "Destination location is required";
  }

  if (formData.startLocation.trim() === formData.destinationLocation.trim()) {
    errors.destination = "Start and destination cannot be the same";
  }

  if (!formData.seatsAvailable || formData.seatsAvailable < 1 || formData.seatsAvailable > 7) {
    errors.seats = "Seats must be between 1 and 7";
  }

  if (!formData.costPerKm || formData.costPerKm < 0) {
    errors.cost = "Cost per km must be a valid positive number";
  }

  return errors;
}

function clearErrors() {
  document.querySelectorAll(".form-error").forEach((el) => {
    el.textContent = "";
  });
}

function displayErrors(errors) {
  clearErrors();
  Object.keys(errors).forEach((field) => {
    const errorElement = document.querySelector(`[data-${field}-error]`);
    if (errorElement) {
      errorElement.textContent = errors[field];
    }
  });
}

// ========== Event Handlers ==========

function handleFormSubmit(event) {
  event.preventDefault();

  const user = getCurrentUser();
  if (!user) {
    redirectToLogin();
    return;
  }

  const form = event.target;
  const formData = {
    startLocation: form.querySelector('input[name="startLocation"]').value.trim(),
    destinationLocation: form.querySelector('input[name="destinationLocation"]').value.trim(),
    via: form.querySelector('input[name="via"]').value.trim(),
    seatsAvailable: parseInt(form.querySelector('input[name="seatsAvailable"]').value) || 0,
    costPerKm: parseFloat(form.querySelector('input[name="costPerKm"]').value) || 0,
  };

  // Validate
  const errors = validateForm(formData);
  if (Object.keys(errors).length > 0) {
    displayErrors(errors);
    return;
  }

  clearErrors();

  // Create ride object
  const newRide = {
    id: generateId(),
    riderEmail: user.email,
    riderName: user.name || user.email,
    startLocation: formData.startLocation,
    destinationLocation: formData.destinationLocation,
    via: formData.via,
    seatsAvailable: formData.seatsAvailable,
    seatsBooked: 0, // Initially no seats booked
    costPerKm: formData.costPerKm,
    estimatedDistance: 0, // Will be filled by Supabase/backend in future
    createdAt: new Date().toISOString(),
    status: "active",
  };

  try {
    saveRide(newRide);
    alert("Ride posted successfully!");
    redirectToRiderDashboard();
  } catch (error) {
    console.error("Error saving ride:", error);
    const submitError = document.querySelector("[data-submit-error]");
    submitError.textContent = "Failed to post ride. Please try again.";
  }
}

function handleCancel() {
  if (confirm("Discard this ride post?")) {
    redirectToRiderDashboard();
  }
}

function handleLogout() {
  if (confirm("Are you sure you want to logout?")) {
    localStorage.removeItem(currentUserKey);
    redirectToLogin();
  }
}

// ========== Initialization ==========

document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();
  if (!user) {
    redirectToLogin();
    return;
  }

  // Display user email
  document.querySelector("[data-user-email]").textContent = user.email;

  // Form submission
  const form = document.getElementById("post-ride-form");
  form.addEventListener("submit", handleFormSubmit);

  // Cancel button
  const cancelBtn = document.getElementById("cancel-btn");
  cancelBtn.addEventListener("click", handleCancel);

  // Logout button
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", handleLogout);

  // Clear errors on input
  form.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", clearErrors);
  });
});
