import { supabase } from "./supabase-client.js";

// ========== Module-level state ==========

let currentUser = null;

// ========== Utility Functions ==========

function redirectToLogin() {
  window.location.href = "login-rider.html";
}

// ========== Data Fetching ==========

async function loadDashboard() {
  if (!currentUser) return;

  // 1. Fetch rider's rides
  const { data: rides, error: ridesError } = await supabase
    .from("rides")
    .select("*")
    .eq("rider_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (ridesError) {
    console.error("Error fetching rides:", ridesError);
    return;
  }

  const rideIds = rides.map((r) => r.id);

  // 2. Fetch seat summaries for these rides
  let seatSummaries = [];
  if (rideIds.length > 0) {
    const { data: summaryData, error: summaryError } = await supabase
      .from("ride_seat_summary")
      .select("*")
      .in("ride_id", rideIds);

    if (!summaryError && summaryData) {
      seatSummaries = summaryData;
    }
  }

  // Build a lookup map: ride_id → seat summary
  const seatMap = {};
  seatSummaries.forEach((s) => {
    seatMap[s.ride_id] = s;
  });

  // 3. Fetch booking applications for this rider's rides
  let bookings = [];
  if (rideIds.length > 0) {
    const { data: bookingData, error: bookingError } = await supabase
      .from("ride_bookings")
      .select("*")
      .in("ride_id", rideIds);

    if (!bookingError && bookingData) {
      bookings = bookingData;
    }
  }

  // 4. Fetch passenger profiles for the bookings
  const passengerIds = [...new Set(bookings.map((b) => b.passenger_id))];
  let profileMap = {};
  if (passengerIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", passengerIds);

    if (!profilesError && profiles) {
      profiles.forEach((p) => {
        profileMap[p.id] = p;
      });
    }
  }

  // Build a lookup map: ride_id → ride
  const rideMap = {};
  rides.forEach((r) => {
    rideMap[r.id] = r;
  });

  // Render
  renderRides(rides, seatMap);
  renderApplications(bookings, profileMap, rideMap);
  updateRevenue(rides, seatMap);
}

// ========== Render Functions ==========

function renderRides(rides, seatMap) {
  const rideList = document.querySelector("[data-active-ride-list]");
  const rideCount = document.querySelector("[data-active-ride-count]");

  rideCount.textContent = `${rides.length} ride${rides.length !== 1 ? "s" : ""}`;

  if (rides.length === 0) {
    rideList.innerHTML =
      '<p class="empty-state">No rides posted yet. Click "Post a Ride" to get started.</p>';
    return;
  }

  rideList.innerHTML = rides
    .map((ride) => createRideCard(ride, seatMap[ride.id]))
    .join("");

  // Attach event listeners
  rideList.querySelectorAll(".edit-ride-btn").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.rideId));
  });

  rideList.querySelectorAll(".delete-ride-btn").forEach((btn) => {
    btn.addEventListener("click", () => confirmDeleteRide(btn.dataset.rideId));
  });
}

function createRideCard(ride, seatSummary) {
  const seatsBooked = seatSummary ? seatSummary.seats_booked : 0;
  const seatsAvailable = seatSummary
    ? seatSummary.seats_available
    : ride.seats_total;
  const estimatedDistance = parseFloat(ride.estimated_distance_km) || 0;
  const revenue = (seatsBooked * estimatedDistance * ride.cost_per_km).toFixed(
    2
  );

  const viaDisplay =
    ride.via_locations && ride.via_locations.length > 0
      ? `<p><strong>Via:</strong> ${ride.via_locations.join(", ")}</p>`
      : "";

  return `
    <div class="ride-card" data-ride-id="${ride.id}">
      <div class="ride-card-header">
        <div class="ride-route">
          <span class="location-label">From</span>
          <p class="location-name">${ride.start_location}</p>
          <span class="location-label">To</span>
          <p class="location-name">${ride.destination_location}</p>
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
        ${viaDisplay}
        <p><strong>Seats Available:</strong> ${seatsAvailable}/${ride.seats_total}</p>
        <p><strong>Cost per km:</strong> ₹${ride.cost_per_km}/km</p>
        <p><strong>Revenue from this ride:</strong> ₹${revenue}</p>
        <p class="ride-date"><small>Posted on ${new Date(ride.created_at).toLocaleDateString()}</small></p>
      </div>
    </div>
  `;
}

function renderApplications(bookings, profileMap, rideMap) {
  const applicationsList = document.querySelector("[data-applications-list]");
  const applicationCount = document.querySelector("[data-application-count]");

  applicationCount.textContent = `${bookings.length} request${bookings.length !== 1 ? "s" : ""}`;

  if (bookings.length === 0) {
    applicationsList.innerHTML =
      '<p class="empty-state">No passenger applications yet.</p>';
    return;
  }

  applicationsList.innerHTML = bookings
    .map((app) => createApplicationCard(app, profileMap, rideMap))
    .join("");

  // Attach accept/reject listeners
  applicationsList.querySelectorAll(".accept-app-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      handleApplicationAction(btn.dataset.appId, "accepted")
    );
  });

  applicationsList.querySelectorAll(".reject-app-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      handleApplicationAction(btn.dataset.appId, "rejected")
    );
  });
}

function createApplicationCard(application, profileMap, rideMap) {
  const ride = rideMap[application.ride_id];
  const passenger = profileMap[application.passenger_id] || {};

  if (!ride) return "";

  const passengerName = passenger.full_name || "Unknown";
  const passengerEmail = passenger.email || "Unknown";
  const estimatedDistance = parseFloat(ride.estimated_distance_km) || 0;
  const estimatedFare = (
    application.seats_requested *
    estimatedDistance *
    ride.cost_per_km
  ).toFixed(2);

  return `
    <div class="application-card">
      <div class="application-header">
        <div>
          <p class="passenger-name"><strong>${passengerName}</strong></p>
          <p class="passenger-email">${passengerEmail}</p>
        </div>
        <span class="status-badge status-${application.status}">${application.status}</span>
      </div>

      <div class="application-details">
        <p><strong>Ride:</strong> ${ride.start_location} → ${ride.destination_location}</p>
        <p><strong>Seats Requested:</strong> ${application.seats_requested}</p>
        <p><strong>Estimated Fare:</strong> ₹${estimatedFare}</p>
        <p class="application-date"><small>Applied on ${new Date(application.applied_at || application.created_at).toLocaleDateString()}</small></p>
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

function updateRevenue(rides, seatMap) {
  const totalRevenue = rides.reduce((total, ride) => {
    const summary = seatMap[ride.id];
    const seatsBooked = summary ? summary.seats_booked : 0;
    const distance = parseFloat(ride.estimated_distance_km) || 0;
    const revenue = seatsBooked * distance * ride.cost_per_km;
    return total + revenue;
  }, 0);

  const revenueDisplay = document.querySelector("[data-total-revenue]");
  revenueDisplay.textContent = `₹${totalRevenue.toFixed(2)}`;
}

// ========== Application Actions ==========

async function handleApplicationAction(appId, newStatus) {
  const { error } = await supabase
    .from("ride_bookings")
    .update({
      status: newStatus,
      responded_at: new Date().toISOString(),
    })
    .eq("id", appId);

  if (error) {
    console.error(`Error ${newStatus} application:`, error);
    alert(`Failed to ${newStatus} application. Please try again.`);
    return;
  }

  await loadDashboard();
}

// ========== Modal Functions ==========

async function openEditModal(rideId) {
  if (!currentUser) return;

  // Fetch the specific ride
  const { data: ride, error } = await supabase
    .from("rides")
    .select("*")
    .eq("id", rideId)
    .eq("rider_id", currentUser.id)
    .maybeSingle();

  if (error || !ride) {
    alert("Ride not found");
    return;
  }

  const form = document.getElementById("edit-ride-form");
  form.querySelector('input[name="rideId"]').value = ride.id;
  form.querySelector('input[name="startLocation"]').value =
    ride.start_location;
  form.querySelector('input[name="destinationLocation"]').value =
    ride.destination_location;
  form.querySelector('input[name="via"]').value = (
    ride.via_locations || []
  ).join(", ");
  form.querySelector('input[name="seatsAvailable"]').value = ride.seats_total;
  form.querySelector('input[name="costPerKm"]').value = ride.cost_per_km;

  // Prefill vehicle model and number plate
  let model = "";
  let plate = "";
  if (ride.vehicle_details) {
    const match = ride.vehicle_details.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      model = match[1];
      plate = match[2];
    } else {
      model = ride.vehicle_details;
    }
  }
  form.querySelector('input[name="vehicleModel"]').value = model;
  form.querySelector('input[name="vehiclePlate"]').value = plate;

  const modal = document.getElementById("edit-ride-modal");
  modal.setAttribute("aria-hidden", "false");
}

function closeEditModal() {
  const modal = document.getElementById("edit-ride-modal");
  modal.setAttribute("aria-hidden", "true");
}

async function confirmDeleteRide(rideId) {
  if (!currentUser) return;

  if (confirm("Are you sure you want to delete this ride?")) {
    const { error } = await supabase
      .from("rides")
      .delete()
      .eq("id", rideId)
      .eq("rider_id", currentUser.id);

    if (error) {
      console.error("Error deleting ride:", error);
      alert("Failed to delete ride. Please try again.");
      return;
    }

    await loadDashboard();
  }
}

// ========== Event Handlers ==========

async function handleEditSubmit(event) {
  event.preventDefault();

  if (!currentUser) {
    redirectToLogin();
    return;
  }

  const form = event.target;
  const rideId = form.querySelector('input[name="rideId"]').value;
  const startLocation = form
    .querySelector('input[name="startLocation"]')
    .value.trim();
  const destinationLocation = form
    .querySelector('input[name="destinationLocation"]')
    .value.trim();
  const via = form.querySelector('input[name="via"]').value;
  const seatsAvailable = parseInt(
    form.querySelector('input[name="seatsAvailable"]').value
  );
  const costPerKm = parseFloat(
    form.querySelector('input[name="costPerKm"]').value
  );
  const vehicleModel = form.querySelector('input[name="vehicleModel"]').value.trim();
  const vehiclePlate = form.querySelector('input[name="vehiclePlate"]').value.trim();

  // Basic validation
  if (!startLocation || !destinationLocation || !vehicleModel || !vehiclePlate) {
    alert("Please fill in all required fields");
    return;
  }

  const vehicleDetails = `${vehicleModel} (${vehiclePlate.toUpperCase()})`;

  // Parse via locations
  const viaLocations = via
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const { error } = await supabase
    .from("rides")
    .update({
      start_location: startLocation,
      destination_location: destinationLocation,
      via_locations: viaLocations,
      seats_total: seatsAvailable,
      cost_per_km: costPerKm,
      vehicle_details: vehicleDetails,
    })
    .eq("id", rideId)
    .eq("rider_id", currentUser.id);

  if (error) {
    console.error("Error updating ride:", error);
    alert("Failed to update ride. Please try again.");
    return;
  }

  closeEditModal();
  await loadDashboard();
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

  currentUser = user;

  // Display user email
  document.querySelector("[data-user-email]").textContent = user.email;

  // Fetch user roles to add a switcher link
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const navActions = document.querySelector(".nav-actions");
  if (navActions) {
    const isPassenger = roles && roles.some((r) => r.role === "passenger");
    const switchBtn = document.createElement("a");
    switchBtn.className = "nav-button";
    // Add margin/style spacing
    switchBtn.style.marginRight = "1rem";
    if (isPassenger) {
      switchBtn.href = "passenger-landing.html";
      switchBtn.textContent = "Passenger Dashboard";
    } else {
      switchBtn.href = "passenger-onboarding.html";
      switchBtn.textContent = "Become a Passenger";
    }
    navActions.insertBefore(switchBtn, navActions.firstChild);
  }

  // Load dashboard
  await loadDashboard();

  // Post Ride button
  document.getElementById("post-ride-btn").addEventListener("click", () => {
    window.location.href = "post-ride.html";
  });

  // Logout button
  document
    .getElementById("logout-btn")
    .addEventListener("click", async () => {
      if (confirm("Are you sure you want to logout?")) {
        await supabase.auth.signOut();
        redirectToLogin();
      }
    });

  // Edit modal form
  const editForm = document.getElementById("edit-ride-form");
  editForm.addEventListener("submit", handleEditSubmit);

  // Modal close buttons
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
});
