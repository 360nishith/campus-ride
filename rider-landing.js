const currentUserKey = "campusRideCurrentUser";
const riderRidesKey = "campusRideRiderRides";
const passengerApplicationsKey = "campusRideApplications";

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

function logout() {
  localStorage.removeItem(currentUserKey);
  redirectToLogin();
}

function getAllRides() {
  try {
    return JSON.parse(localStorage.getItem(riderRidesKey)) || [];
  } catch (error) {
    console.error("Error getting rides:", error);
    return [];
  }
}

function getRiderRides(email) {
  const allRides = getAllRides();
  return allRides.filter((ride) => ride.riderEmail === email);
}

function saveRide(ride) {
  const allRides = getAllRides();
  const existingIndex = allRides.findIndex((r) => r.id === ride.id);

  if (existingIndex >= 0) {
    allRides[existingIndex] = ride;
  } else {
    allRides.push(ride);
  }

  localStorage.setItem(riderRidesKey, JSON.stringify(allRides));
}

function deleteRide(rideId) {
  const allRides = getAllRides();
  const filtered = allRides.filter((ride) => ride.id !== rideId);
  localStorage.setItem(riderRidesKey, JSON.stringify(filtered));
}

function getApplicationsForRider(riderEmail) {
  try {
    const allApplications = JSON.parse(localStorage.getItem(passengerApplicationsKey)) || [];
    return allApplications.filter((app) => app.riderEmail === riderEmail);
  } catch (error) {
    console.error("Error getting applications:", error);
    return [];
  }
}

function calculateTotalRevenue(rides) {
  return rides.reduce((total, ride) => {
    const seatsBooked = ride.seatsBooked || 0;
    const distance = ride.estimatedDistance || 0;
    const revenue = seatsBooked * distance * ride.costPerKm;
    return total + revenue;
  }, 0);
}

// ========== Render Functions ==========

function renderRides(rides) {
  const rideList = document.querySelector("[data-active-ride-list]");
  const rideCount = document.querySelector("[data-active-ride-count]");

  rideCount.textContent = `${rides.length} ride${rides.length !== 1 ? "s" : ""}`;

  if (rides.length === 0) {
    rideList.innerHTML = '<p class="empty-state">No rides posted yet. Click "Post a Ride" to get started.</p>';
    return;
  }

  rideList.innerHTML = rides.map((ride) => createRideCard(ride)).join("");

  // Attach event listeners
  rideList.querySelectorAll(".edit-ride-btn").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.rideId));
  });

  rideList.querySelectorAll(".delete-ride-btn").forEach((btn) => {
    btn.addEventListener("click", () => confirmDeleteRide(btn.dataset.rideId));
  });
}

function createRideCard(ride) {
  const seatsBooked = ride.seatsBooked || 0;
  const revenue = (seatsBooked * (ride.estimatedDistance || 0) * ride.costPerKm).toFixed(2);

  return `
    <div class="ride-card" data-ride-id="${ride.id}">
      <div class="ride-card-header">
        <div class="ride-route">
          <span class="location-label">From</span>
          <p class="location-name">${ride.startLocation}</p>
          <span class="location-label">To</span>
          <p class="location-name">${ride.destinationLocation}</p>
        </div>
        <div class="ride-actions">
          <button class="edit-ride-btn" data-ride-id="${ride.id}" title="Edit ride">
            ✎ Edit
          </button>
          <button class="delete-ride-btn" data-ride-id="${ride.id}" title="Delete ride">
            🗑 Delete
          </button>
        </div>
      </div>

      <div class="ride-card-details">
        ${ride.via ? `<p><strong>Via:</strong> ${ride.via}</p>` : ""}
        <p><strong>Seats Available:</strong> ${ride.seatsAvailable - seatsBooked}/${ride.seatsAvailable}</p>
        <p><strong>Cost per km:</strong> ₹${ride.costPerKm}/km</p>
        <p><strong>Revenue from this ride:</strong> ₹${revenue}</p>
        <p class="ride-date"><small>Posted on ${new Date(ride.createdAt).toLocaleDateString()}</small></p>
      </div>
    </div>
  `;
}

function renderApplications(applications) {
  const applicationsList = document.querySelector("[data-applications-list]");
  const applicationCount = document.querySelector("[data-application-count]");

  applicationCount.textContent = `${applications.length} request${applications.length !== 1 ? "s" : ""}`;

  if (applications.length === 0) {
    applicationsList.innerHTML = '<p class="empty-state">No passenger applications yet.</p>';
    return;
  }

  applicationsList.innerHTML = applications.map((app) => createApplicationCard(app)).join("");
}

function createApplicationCard(application) {
  const ride = getAllRides().find((r) => r.id === application.rideId);
  if (!ride) return "";

  return `
    <div class="application-card">
      <div class="application-header">
        <div>
          <p class="passenger-name"><strong>${application.passengerName}</strong></p>
          <p class="passenger-email">${application.passengerEmail}</p>
        </div>
        <span class="status-badge status-${application.status}">${application.status}</span>
      </div>

      <div class="application-details">
        <p><strong>Ride:</strong> ${ride.startLocation} → ${ride.destinationLocation}</p>
        <p><strong>Seats Requested:</strong> ${application.seatsRequested}</p>
        <p><strong>Estimated Fare:</strong> ₹${(application.seatsRequested * (ride.estimatedDistance || 0) * ride.costPerKm).toFixed(2)}</p>
        <p class="application-date"><small>Applied on ${new Date(application.appliedAt).toLocaleDateString()}</small></p>
      </div>

      <div class="application-actions">
        <button class="accept-app-btn" data-app-id="${application.id}" title="Accept application">
          ✓ Accept
        </button>
        <button class="reject-app-btn" data-app-id="${application.id}" title="Reject application">
          ✕ Reject
        </button>
      </div>
    </div>
  `;
}

function updateRevenue() {
  const user = getCurrentUser();
  if (!user) return;

  const rides = getRiderRides(user.email);
  const totalRevenue = calculateTotalRevenue(rides);
  const revenueDisplay = document.querySelector("[data-total-revenue]");
  revenueDisplay.textContent = `₹${totalRevenue.toFixed(2)}`;
}

// ========== Modal Functions ==========

function openEditModal(rideId) {
  const user = getCurrentUser();
  if (!user) return;

  const ride = getAllRides().find((r) => r.id === rideId && r.riderEmail === user.email);
  if (!ride) {
    alert("Ride not found");
    return;
  }

  const form = document.getElementById("edit-ride-form");
  form.querySelector('input[name="rideId"]').value = ride.id;
  form.querySelector('input[name="startLocation"]').value = ride.startLocation;
  form.querySelector('input[name="destinationLocation"]').value = ride.destinationLocation;
  form.querySelector('input[name="via"]').value = ride.via || "";
  form.querySelector('input[name="seatsAvailable"]').value = ride.seatsAvailable;
  form.querySelector('input[name="costPerKm"]').value = ride.costPerKm;

  const modal = document.getElementById("edit-ride-modal");
  modal.setAttribute("aria-hidden", "false");
}

function closeEditModal() {
  const modal = document.getElementById("edit-ride-modal");
  modal.setAttribute("aria-hidden", "true");
}

function confirmDeleteRide(rideId) {
  const user = getCurrentUser();
  if (!user) return;

  const ride = getAllRides().find((r) => r.id === rideId && r.riderEmail === user.email);
  if (!ride) {
    alert("Ride not found");
    return;
  }

  if (confirm(`Delete ride from ${ride.startLocation} to ${ride.destinationLocation}?`)) {
    deleteRide(rideId);
    loadDashboard();
  }
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
  const rideId = form.querySelector('input[name="rideId"]').value;
  const updatedRide = {
    startLocation: form.querySelector('input[name="startLocation"]').value.trim(),
    destinationLocation: form.querySelector('input[name="destinationLocation"]').value.trim(),
    via: form.querySelector('input[name="via"]').value.trim(),
    seatsAvailable: parseInt(form.querySelector('input[name="seatsAvailable"]').value),
    costPerKm: parseFloat(form.querySelector('input[name="costPerKm"]').value),
  };

  // Validate
  if (!updatedRide.startLocation || !updatedRide.destinationLocation) {
    alert("Please fill in all required fields");
    return;
  }

  const ride = getAllRides().find((r) => r.id === rideId && r.riderEmail === user.email);
  if (!ride) {
    alert("Ride not found");
    return;
  }

  const updatedFullRide = { ...ride, ...updatedRide };
  saveRide(updatedFullRide);

  closeEditModal();
  loadDashboard();
}

function handleLogout() {
  if (confirm("Are you sure you want to logout?")) {
    logout();
  }
}

// ========== Initialization ==========

function loadDashboard() {
  const user = getCurrentUser();
  if (!user) {
    redirectToLogin();
    return;
  }

  // Display user email
  document.querySelector("[data-user-email]").textContent = user.email;

  // Load rides
  const rides = getRiderRides(user.email);
  renderRides(rides);

  // Load applications
  const applications = getApplicationsForRider(user.email);
  renderApplications(applications);

  // Update revenue
  updateRevenue();
}

// ========== Event Listeners ==========

document.addEventListener("DOMContentLoaded", () => {
  const user = getCurrentUser();
  if (!user) {
    redirectToLogin();
    return;
  }

  loadDashboard();

  // Post Ride button
  document.getElementById("post-ride-btn").addEventListener("click", () => {
    window.location.href = "post-ride.html";
  });

  // Logout button
  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  // Edit modal
  const editForm = document.getElementById("edit-ride-form");
  editForm.addEventListener("submit", handleEditSubmit);

  const modalCloseBtn = document.querySelector(".modal-close-btn");
  modalCloseBtn.addEventListener("click", closeEditModal);

  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  modalCancelBtn.addEventListener("click", closeEditModal);

  // Close modal on outside click
  const modal = document.getElementById("edit-ride-modal");
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeEditModal();
    }
  });

  // Refresh data every 5 seconds
  setInterval(loadDashboard, 5000);
});
