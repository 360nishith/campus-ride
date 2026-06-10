import { supabase } from "./supabase-client.js";

// ========== Module-level state ==========

let currentUser = null;
let currentRides = [];
let currentBooking = null;

// ========== DOM Elements ==========

const form = document.querySelector("[data-ride-search]");
const rideList = document.querySelector("[data-ride-list]");
const rideCount = document.querySelector("[data-ride-count]");
const bookingCard = document.querySelector("[data-booking-card]");
const searchError = document.querySelector("[data-search-error]");

// ========== Utility Functions ==========

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ========== Data Fetching ==========

async function getAllRides() {
  const { data, error } = await supabase.from("available_rides").select("*");

  if (error) {
    console.error("Error fetching rides:", error);
    return [];
  }

  return data || [];
}

async function getPassengerBooking() {
  if (!currentUser) return null;

  // Fetch the most recent active booking for this passenger
  const { data: booking, error: bookingError } = await supabase
    .from("ride_bookings")
    .select("*")
    .eq("passenger_id", currentUser.id)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bookingError || !booking) {
    return null;
  }

  // Fetch the ride details
  const { data: ride, error: rideError } = await supabase
    .from("rides")
    .select("*")
    .eq("id", booking.ride_id)
    .maybeSingle();

  if (rideError || !ride) {
    return { ...booking, ride: null };
  }

  // Fetch the rider profile to get UPI ID and name
  const { data: riderProfile, error: riderProfileError } = await supabase
    .from("rider_profiles")
    .select("upi_id")
    .eq("user_id", ride.rider_id)
    .maybeSingle();

  const { data: riderInfo, error: riderInfoError } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", ride.rider_id)
    .maybeSingle();

  const upiId =
    !riderProfileError && riderProfile ? riderProfile.upi_id : null;
  const riderName =
    !riderInfoError && riderInfo ? riderInfo.full_name : "Rider";

  const fareEstimate =
    booking.fare_estimate ||
    ride.cost_per_km * (parseFloat(ride.estimated_distance_km) || 0);

  const paymentLink = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(riderName)}&am=${encodeURIComponent(fareEstimate)}&cu=INR&tn=${encodeURIComponent("Campus Ride booking")}`
    : null;

  return {
    ...booking,
    ride,
    riderName,
    upiId,
    fareEstimate,
    paymentLink,
  };
}

// ========== Search / Filter ==========

function rideMatches(ride, filters) {
  const searchableStart = normalize(ride.start_location);
  const searchableDestination = normalize(ride.destination_location);
  const searchableVia = (ride.via_locations || [])
    .map(normalize)
    .join(" ");

  const startMatches =
    !filters.start || searchableStart.includes(filters.start);
  const destinationMatches =
    !filters.destination ||
    searchableDestination.includes(filters.destination);
  const viaMatches = !filters.via || searchableVia.includes(filters.via);
  const priceMatches =
    !filters.price || ride.cost_per_km <= Number(filters.price);

  return startMatches && destinationMatches && viaMatches && priceMatches;
}

function getFilters() {
  const formData = new FormData(form);

  return {
    start: normalize(formData.get("start")),
    destination: normalize(formData.get("destination")),
    via: normalize(formData.get("via")),
    price: normalize(formData.get("price")),
  };
}

async function applyFilters() {
  const filters = getFilters();
  const filtered = currentRides.filter((ride) => rideMatches(ride, filters));
  renderRides(filtered);
}

// ========== Ride Card ==========

function createRideCard(ride, selectedRideId) {
  const article = document.createElement("article");
  article.className = "ride-card";
  article.dataset.rideId = ride.id;

  const isSelected = selectedRideId === ride.id;
  const buttonLabel = isSelected ? "Selected" : "Choose ride";

  const departureText = ride.departure_at
    ? new Date(ride.departure_at).toLocaleString()
    : "Flexible";

  const viaText = (ride.via_locations || []).join(", ");
  const priceDisplay = formatCurrency(ride.cost_per_km) + "/km";
  const vehicleDisplay = ride.vehicle_details || "Not specified";

  article.innerHTML = `
    <div class="ride-card-top">
      <div>
        <h3>${ride.start_location} to ${ride.destination_location}</h3>
        <p>${departureText} with ${ride.rider_name}</p>
      </div>
      <strong>${priceDisplay}</strong>
    </div>
    <dl class="ride-meta">
      <div>
        <dt>Via</dt>
        <dd>${viaText || "Direct"}</dd>
      </div>
      <div>
        <dt>Seats</dt>
        <dd>${ride.seats_available}</dd>
      </div>
      <div>
        <dt>Vehicle</dt>
        <dd>${vehicleDisplay}</dd>
      </div>
    </dl>
    <button class="ride-select-button" type="button" data-select-ride="${ride.id}" ${
      isSelected ? "disabled" : ""
    }>${buttonLabel}</button>
  `;

  return article;
}

// ========== Render Functions ==========

function renderRides(rides) {
  const selectedRideId = currentBooking ? currentBooking.ride_id : null;

  rideList.replaceChildren();
  rideCount.textContent = `${rides.length} ${rides.length === 1 ? "ride" : "rides"}`;

  if (!rides.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No rides match these filters yet.";
    rideList.append(empty);
    return;
  }

  rides.forEach((ride) => {
    rideList.append(createRideCard(ride, selectedRideId));
  });
}

function renderBooking() {
  if (!currentBooking) {
    bookingCard.innerHTML =
      '<p class="empty-state">Select a ride to see payment details.</p>';
    return;
  }

  const ride = currentBooking.ride;
  const routeText = ride
    ? `${ride.start_location} to ${ride.destination_location}`
    : "Unknown route";
  const fareDisplay = formatCurrency(currentBooking.fareEstimate || 0);

  const paymentSection = currentBooking.paymentLink
    ? `
      <p class="payment-line">Pay ${fareDisplay} to <strong>${currentBooking.upiId}</strong></p>
      <a class="payment-button" href="${currentBooking.paymentLink}">Open UPI payment</a>
    `
    : `<p class="payment-line">Fare: ${fareDisplay}</p>`;

  const statusBadge = currentBooking.status
    ? `<span class="status-badge status-${currentBooking.status}">${currentBooking.status}</span>`
    : "";

  bookingCard.innerHTML = `
    <div class="booking-summary">
      <h3>${routeText}</h3>
      <p>${ride && ride.departure_at ? new Date(ride.departure_at).toLocaleString() : "Flexible"} with ${currentBooking.riderName || "Rider"}</p>
      ${statusBadge}
      ${paymentSection}
      <button class="delete-booking-button" type="button" data-delete-booking>Cancel booking</button>
    </div>
  `;
}

// ========== Booking Actions ==========

async function bookRide(rideId) {
  const ride = currentRides.find((item) => item.id === rideId);

  if (!ride) return;

  if (!currentUser) {
    console.error("No user session");
    return;
  }

  const fareEstimate =
    ride.cost_per_km * (parseFloat(ride.estimated_distance_km) || 0);

  const { error } = await supabase.from("ride_bookings").insert({
    ride_id: rideId,
    passenger_id: currentUser.id,
    seats_requested: 1,
    fare_estimate: fareEstimate,
  });

  if (error) {
    console.error("Error booking ride:", error);
    alert(error.message || "Failed to book ride. Please try again.");
    return;
  }

  // Refresh rides and booking
  currentRides = await getAllRides();
  currentBooking = await getPassengerBooking();
  applyFilters();
  renderBooking();
}

async function deleteBooking() {
  if (!currentBooking || !currentUser) return;

  const { error } = await supabase
    .from("ride_bookings")
    .update({ status: "cancelled" })
    .eq("id", currentBooking.id)
    .eq("passenger_id", currentUser.id);

  if (error) {
    console.error("Error cancelling booking:", error);
    alert("Failed to cancel booking. Please try again.");
    return;
  }

  currentBooking = null;
  currentRides = await getAllRides();
  applyFilters();
  renderBooking();
}

// ========== Event Listeners ==========

form.addEventListener("submit", (event) => {
  event.preventDefault();
  searchError.textContent = "";

  if (!form.checkValidity()) {
    searchError.textContent = "Enter start and destination locations.";
    form.reportValidity();
    return;
  }

  applyFilters();
});

rideList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select-ride]");

  if (button) {
    bookRide(button.dataset.selectRide);
  }
});

bookingCard.addEventListener("click", (event) => {
  if (event.target.closest("[data-delete-booking]")) {
    deleteBooking();
  }
});

// ========== Initialization ==========

async function init() {
  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    // Passenger page can work without auth for browsing,
    // but store user for booking actions
    currentUser = null;
  } else {
    currentUser = user;

    // Fetch user roles to add a switcher link
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const navActions = document.querySelector(".nav-actions");
    if (navActions) {
      const isRider = roles && roles.some((r) => r.role === "rider");
      const switchBtn = document.createElement("a");
      switchBtn.className = "nav-button";
      if (isRider) {
        switchBtn.href = "rider-landing.html";
        switchBtn.textContent = "Rider Dashboard";
      } else {
        switchBtn.href = "rider-onboarding.html";
        switchBtn.textContent = "Become a Rider";
      }
      navActions.insertBefore(switchBtn, navActions.firstChild);
    }
  }

  // Load all available rides
  currentRides = await getAllRides();
  renderRides(currentRides);

  // Load current booking (if authenticated)
  if (currentUser) {
    currentBooking = await getPassengerBooking();
    renderBooking();
  }
}

init();
