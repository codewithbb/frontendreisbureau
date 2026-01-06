// /assets/js/vliegvelden-kaart.js

const API_BASE_URL = "https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net/";

// DOM
const selectDeparture = document.getElementById("select-departure");
const selectArrival   = document.getElementById("select-arrival");
const statusLine      = document.getElementById("status-line");
const statusSub       = document.getElementById("status-sub");
const btnReset        = document.getElementById("btn-reset");

// Leaflet map initialiseren
const map = L.map("map").setView([52.37, 4.90], 6);

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: "© OpenStreetMap contributors",
  maxZoom: 19
}).addTo(map);

// State
let airports = [];
let departureMarker = null;
let tooltipArrival = null;
let departureCoords = null; // [lat, lon]
let arrivalCoords   = null; // [lat, lon]
let routeLine = null;

function setStatus(main, sub = "") {
  statusLine.innerHTML = `<span class="mini">Status:</span> <span>${main}</span>`;
  statusSub.textContent = sub || "";
}

function clearRoute() {
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
}

function drawRouteIfPossible() {
  clearRoute();
  if (!departureCoords || !arrivalCoords) return;

  routeLine = L.polyline([departureCoords, arrivalCoords], {
    color: "grey",
    weight: 2,
    dashArray: "6, 8"
  }).addTo(map);

  map.fitBounds(routeLine.getBounds(), { padding: [40, 40], maxZoom: 5 });
}

function resetArrivalState() {
  // remove arrival tooltip
  if (tooltipArrival) {
    map.removeLayer(tooltipArrival);
    tooltipArrival = null;
  }
  arrivalCoords = null;

  // reset arrival dropdown
  selectArrival.innerHTML = `<option value="">— Kies eerst vertrek —</option>`;
  selectArrival.value = "";
  selectArrival.disabled = true;

  drawRouteIfPossible();
}

function resetAll() {
  selectDeparture.value = "";
  resetArrivalState();

  if (departureMarker) {
    map.removeLayer(departureMarker);
    departureMarker = null;
  }
  departureCoords = null;

  clearRoute();
  map.setView([52.37, 4.90], 6);

  setStatus("Selectie gewist.", "");
}

function fillDepartureDropdown() {
  airports.forEach(a => {
    const opt = document.createElement("option");
    opt.value = a.iata_code;
    opt.textContent = `(${a.iata_code}) ${a.name}`;
    selectDeparture.appendChild(opt);
  });
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, credentials: "include" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || res.statusText || "Onbekende fout");
  return data;
}

// Init: load airports
(async function init() {
  try {
    setStatus("Luchthavens laden…");
    const data = await fetchJson(`${API_BASE_URL}/donny`);
    airports = Array.isArray(data) ? data : [];
    fillDepartureDropdown();
    setStatus("Klaar.", `Beschikbaar: ${airports.length} luchthavens.`);
  } catch (err) {
    console.error(err);
    setStatus("Fout bij laden van luchthavens.", "Controleer je verbinding of probeer opnieuw.");
  }
})();

// Event: departure change
selectDeparture.addEventListener("change", async function () {
  const selectedIata = this.value;

  // Reset arrival whenever departure changes
  resetArrivalState();

  if (!selectedIata) {
    // clear departure marker and route
    if (departureMarker) {
      map.removeLayer(departureMarker);
      departureMarker = null;
    }
    departureCoords = null;
    clearRoute();
    setStatus("Kies een vertrekhaven om verder te gaan.");
    return;
  }

  const ap = airports.find(a => a.iata_code === selectedIata);
  if (!ap) return;

  departureCoords = [Number(ap.latitude), Number(ap.longitude)];

  // Remove old marker
  if (departureMarker) map.removeLayer(departureMarker);

  // Add new marker
  departureMarker = L.marker(departureCoords).addTo(map);

  // Japan special: PowerBI on click
  const japanIata = ["HND", "NRT", "KIX", "ITM", "CTS", "FUK", "OKA", "NGO"];
  if (japanIata.includes(ap.iata_code)) {
    const powerBiUrl = "https://app.powerbi.com/view?r=eyJrIjoiMWU3MzVkNTgtMDk3Ny00NTY1LWFkNzYtMGFiZGQ3YWVhNTY4IiwidCI6IjgxZGJmMzFjLWQ5MTgtNDQ3Yi05YTM1LTBlZTNjN2I1Yjg4ZCIsImMiOjl9";
    departureMarker.on("click", () => window.open(powerBiUrl, "_blank"));
  }

  map.setView(departureCoords, 6);
  drawRouteIfPossible();

  // Fetch destinations for this departure
  try {
    setStatus("Bestemmingen ophalen…", `Vertrek: (${ap.iata_code}) ${ap.name}`);
    const destinations = await fetchJson(`${API_BASE_URL}/donny/destinations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ iata_code: selectedIata })
    });

    const list = Array.isArray(destinations) ? destinations : [];
    selectArrival.disabled = false;
    selectArrival.innerHTML = `<option value="">— Kies een luchthaven —</option>`;

    list.forEach(dest => {
      const opt = document.createElement("option");
      opt.value = dest.iata_code;
      const price = dest.min_price != null ? `vanaf €${Math.round(dest.min_price)}` : "prijs onbekend";
      opt.textContent = `(${dest.iata_code}) ${dest.name} — ${price}`;
      selectArrival.appendChild(opt);
    });

    setStatus("Bestemmingen geladen.", `${list.length} mogelijke bestemmingen gevonden.`);
  } catch (err) {
    console.error("Fout bij ophalen bestemmingen:", err);
    setStatus("Fout bij ophalen bestemmingen.", "Probeer opnieuw of kies een andere vertrekhaven.");
  }
});

// Event: arrival change
selectArrival.addEventListener("change", function () {
  const selectedIata = this.value;

  if (!selectedIata) {
    if (tooltipArrival) map.removeLayer(tooltipArrival);
    tooltipArrival = null;
    arrivalCoords = null;
    drawRouteIfPossible();
    setStatus("Kies een aankomsthaven om de route te zien.");
    return;
  }

  const ap = airports.find(a => a.iata_code === selectedIata);
  if (!ap) return;

  if (tooltipArrival) map.removeLayer(tooltipArrival);

  tooltipArrival = L.tooltip({
    permanent: true,
    direction: "top",
    className: "my-tooltip",
    offset: [0, 0]
  })
    .setLatLng([ap.latitude, ap.longitude])
    .setContent(`Aankomst: (${ap.iata_code}) ${ap.name}`)
    .addTo(map);

  arrivalCoords = [Number(ap.latitude), Number(ap.longitude)];
  map.setView(arrivalCoords, 6);

  drawRouteIfPossible();
  setStatus("Route getekend.", `Aankomst: (${ap.iata_code}) ${ap.name}`);
});

btnReset.addEventListener("click", resetAll);