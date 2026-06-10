import { supabase } from "./supabase-client.js";

// ========== Utility Functions ==========

function redirectToLogin() {
  window.location.href = "login-rider.html";
}

function redirectToRiderDashboard() {
  window.location.href = "rider-landing.html";
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

  if (
    formData.startLocation.trim() &&
    formData.destinationLocation.trim() &&
    formData.startLocation.trim().toLowerCase() ===
      formData.destinationLocation.trim().toLowerCase()
  ) {
    errors.destination = "Start and destination cannot be the same";
  }

  if (
    !formData.seatsAvailable ||
    formData.seatsAvailable < 1 ||
    formData.seatsAvailable > 7
  ) {
    errors.seats = "Seats must be between 1 and 7";
  }

  if (formData.costPerKm === null || formData.costPerKm < 0) {
    errors.cost = "Cost per km must be a valid positive number";
  }

  if (!formData.vehicleModel.trim()) {
    errors["vehicle-model"] = "Vehicle model is required";
  }

  if (!formData.vehiclePlate.trim()) {
    errors["vehicle-plate"] = "Number plate is required";
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

// ========== Initialization ==========

document.addEventListener("DOMContentLoaded", async () => {
  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirectToLogin();
    return;
  }

  // Display user email
  const emailEl = document.querySelector("[data-user-email]");
  if (emailEl) {
    emailEl.textContent = user.email;
  }

  // Form submission
  const form = document.getElementById("post-ride-form");
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = {
      startLocation: form.querySelector('input[name="startLocation"]').value,
      destinationLocation: form.querySelector(
        'input[name="destinationLocation"]'
      ).value,
      via: form.querySelector('input[name="via"]').value,
      seatsAvailable:
        parseInt(form.querySelector('input[name="seatsAvailable"]').value) || 0,
      costPerKm:
        parseFloat(form.querySelector('input[name="costPerKm"]').value),
      vehicleModel: form.querySelector('input[name="vehicleModel"]').value,
      vehiclePlate: form.querySelector('input[name="vehiclePlate"]').value,
    };

    // Handle NaN for costPerKm
    if (isNaN(formData.costPerKm)) {
      formData.costPerKm = null;
    }

    // Validate
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      displayErrors(errors);
      return;
    }

    clearErrors();

    // Parse via locations
    const viaArray = formData.via
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Disable submit button during request
    submitBtn.disabled = true;
    submitBtn.textContent = "Posting…";

    try {
      const vehicleDetails = `${formData.vehicleModel.trim()} (${formData.vehiclePlate.trim().toUpperCase()})`;

      const { error: insertError } = await supabase.from("rides").insert({
        rider_id: user.id,
        start_location: formData.startLocation.trim(),
        destination_location: formData.destinationLocation.trim(),
        via_locations: viaArray,
        seats_total: formData.seatsAvailable,
        cost_per_km: formData.costPerKm,
        vehicle_details: vehicleDetails,
      });

      if (insertError) {
        throw insertError;
      }

      alert("Ride posted successfully!");
      redirectToRiderDashboard();
    } catch (error) {
      console.error("Error saving ride:", error);
      const submitError = document.querySelector("[data-submit-error]");
      if (submitError) {
        submitError.textContent =
          error.message || "Failed to post ride. Please try again.";
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Post Ride";
    }
  });

  // Cancel button
  const cancelBtn = document.getElementById("cancel-btn");
  cancelBtn.addEventListener("click", () => {
    if (confirm("Discard this ride post?")) {
      redirectToRiderDashboard();
    }
  });

  // Logout button
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", async () => {
    if (confirm("Are you sure you want to logout?")) {
      await supabase.auth.signOut();
      redirectToLogin();
    }
  });

  // Clear errors on input
  form.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", clearErrors);
  });
});
