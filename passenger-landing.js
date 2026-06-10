const currentUserKey = "campusRideCurrentUser";
const studentVerificationKey = "campusRideStudentVerifications";
const bookingKey = "campusRidePassengerBookings";

const demoRides = [
  {
    id: "demo-1",
    riderName: "Ananya Rao",
    riderEmail: "ananya.rao@nmamit.in",
    start: "NMAMIT Main Gate",
    destination: "Karkala Bus Stand",
    via: ["Nitte", "Belman"],
    time: "08:15 AM",
    seats: 3,
    price: 60,
    vehicle: "Swift KA 20 AB 1422",
    upiId: "ananya@upi",
  },
  {
    id: "demo-2",
    riderName: "Rahul Shetty",
    riderEmail: "rahul.shetty@nmamit.in",
    start: "NMAMIT Hostel Block",
    destination: "Udupi",
    via: ["Karkala", "Manipal"],
    time: "04:45 PM",
    seats: 2,
    price: 120,
    vehicle: "Baleno KA 19 MN 4471",
    upiId: "rahulshetty@okaxis",
  },
  {
    id: "demo-3",
    riderName: "Meera Pai",
    riderEmail: "meera.pai@nmamit.in",
    start: "Nitte Campus",
    destination: "Mangalore",
    via: ["Moodbidri", "Kankanady"],
    time: "05:30 PM",
    seats: 1,
    price: 180,
    vehicle: "i20 KA 20 CP 8091",
    upiId: "meerapai@ybl",
  },
  {
    id: "demo-4",
    riderName: "Vikram Hegde",
    riderEmail: "vikram.hegde@nmamit.in",
    start: "NMAMIT Main Gate",
    destination: "Moodbidri",
    via: ["Belvai"],
    time: "03:20 PM",
    seats: 4,
    price: 90,
    vehicle: "WagonR KA 21 H 3308",
    upiId: "vikram@paytm",
  },
];

const form = document.querySelector("[data-ride-search]");
const rideList = document.querySelector("[data-ride-list]");
const rideCount = document.querySelector("[data-ride-count]");
const bookingCard = document.querySelector("[data-booking-card]");
const searchError = document.querySelector("[data-search-error]");

function getJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch (error) {
    return fallback;
  }
}

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

function getCurrentPassenger() {
  return getJson(currentUserKey, {});
}

function getPassengerEmail() {
  const passenger = getCurrentPassenger();
  return normalize(passenger.email) || "guest@nmamit.in";
}

function getRiderGeneratedRides() {
  const verifications = getJson(studentVerificationKey, {});

  return Object.entries(verifications)
    .filter(([, details]) => details.riderOnboardingComplete && details.upiId)
    .map(([email, details], index) => ({
      id: `rider-${email}`,
      riderName: details.name || "NMAMIT Rider",
      riderEmail: email,
      start: details.pickup || "NMAMIT Main Gate",
      destination: "Karkala Bus Stand",
      via: ["Nitte"],
      time: index % 2 === 0 ? "08:30 AM" : "05:15 PM",
      seats: 3,
      price: 70,
      vehicle: "Rider vehicle",
      upiId: details.upiId,
    }));
}

function getAllRides() {
  const riderRides = getRiderGeneratedRides();
  const riderEmails = new Set(riderRides.map((ride) => ride.riderEmail));
  const availableDemoRides = demoRides.filter((ride) => !riderEmails.has(ride.riderEmail));

  return [...riderRides, ...availableDemoRides];
}

function getBookings() {
  return getJson(bookingKey, []);
}

function saveBookings(bookings) {
  localStorage.setItem(bookingKey, JSON.stringify(bookings));
}

function getPassengerBooking() {
  const passengerEmail = getPassengerEmail();

  return getBookings().find((booking) => booking.passengerEmail === passengerEmail);
}

function rideMatches(ride, filters) {
  const searchableStart = normalize(ride.start);
  const searchableDestination = normalize(ride.destination);
  const searchableVia = ride.via.map(normalize).join(" ");
  const startMatches = !filters.start || searchableStart.includes(filters.start);
  const destinationMatches =
    !filters.destination || searchableDestination.includes(filters.destination);
  const viaMatches = !filters.via || searchableVia.includes(filters.via);
  const priceMatches = !filters.price || ride.price <= Number(filters.price);

  return startMatches && destinationMatches && viaMatches && priceMatches;
}

function createRideCard(ride, selectedRideId) {
  const article = document.createElement("article");
  article.className = "ride-card";
  article.dataset.rideId = ride.id;

  const isSelected = selectedRideId === ride.id;
  const buttonLabel = isSelected ? "Selected" : "Choose ride";

  article.innerHTML = `
    <div class="ride-card-top">
      <div>
        <h3>${ride.start} to ${ride.destination}</h3>
        <p>${ride.time} with ${ride.riderName}</p>
      </div>
      <strong>${formatCurrency(ride.price)}</strong>
    </div>
    <dl class="ride-meta">
      <div>
        <dt>Via</dt>
        <dd>${ride.via.join(", ")}</dd>
      </div>
      <div>
        <dt>Seats</dt>
        <dd>${ride.seats}</dd>
      </div>
      <div>
        <dt>Vehicle</dt>
        <dd>${ride.vehicle}</dd>
      </div>
    </dl>
    <button class="ride-select-button" type="button" data-select-ride="${ride.id}" ${
    isSelected ? "disabled" : ""
  }>${buttonLabel}</button>
  `;

  return article;
}

function renderRides(rides) {
  const currentBooking = getPassengerBooking();
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
    rideList.append(createRideCard(ride, currentBooking?.rideId));
  });
}

function renderBooking() {
  const booking = getPassengerBooking();

  if (!booking) {
    bookingCard.innerHTML = '<p class="empty-state">Select a ride to see payment details.</p>';
    return;
  }

  bookingCard.innerHTML = `
    <div class="booking-summary">
      <h3>${booking.start} to ${booking.destination}</h3>
      <p>${booking.time} with ${booking.riderName}</p>
      <p class="payment-line">Pay ${formatCurrency(booking.price)} to <strong>${booking.upiId}</strong></p>
      <a class="payment-button" href="${booking.paymentLink}">Open UPI payment</a>
      <button class="delete-booking-button" type="button" data-delete-booking>Delete booking</button>
    </div>
  `;
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

function applyFilters() {
  const filters = getFilters();
  const rides = getAllRides().filter((ride) => rideMatches(ride, filters));
  renderRides(rides);
}

function bookRide(rideId) {
  const ride = getAllRides().find((item) => item.id === rideId);

  if (!ride) {
    return;
  }

  const passengerEmail = getPassengerEmail();
  const bookings = getBookings().filter((booking) => booking.passengerEmail !== passengerEmail);
  const paymentLink = `upi://pay?pa=${encodeURIComponent(ride.upiId)}&pn=${encodeURIComponent(
    ride.riderName
  )}&am=${encodeURIComponent(ride.price)}&cu=INR&tn=${encodeURIComponent("Campus Ride booking")}`;

  bookings.push({
    ...ride,
    rideId: ride.id,
    passengerEmail,
    paymentLink,
    bookedAt: new Date().toISOString(),
  });

  saveBookings(bookings);
  applyFilters();
  renderBooking();
}

function deleteBooking() {
  const passengerEmail = getPassengerEmail();
  const remainingBookings = getBookings().filter(
    (booking) => booking.passengerEmail !== passengerEmail
  );

  saveBookings(remainingBookings);
  applyFilters();
  renderBooking();
}

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

renderRides(getAllRides());
renderBooking();
