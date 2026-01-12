// /assets/js/co2-calculator.js

// const API_BASE_URL = "http://127.0.0.1:5001";
const API_BASE_URL = "https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net/";

// DOM
const flyFrom = document.getElementById("fly_from");
const flyTo = document.getElementById("fly_to");

const airlineInput = document.getElementById("airline_name");
const suggestionBox = document.getElementById("airline_suggestions");

const depDate = document.getElementById("departure_date");
const depTime = document.getElementById("departure_time");
const flightNumber = document.getElementById("flight_number");

const btnCalc = document.getElementById("btn-calc");
const btnReset = document.getElementById("btn-reset");

const resultDiv = document.getElementById("result");
const alertDiv = document.getElementById("form-alert");

let airlinesCache = null;
let airlinesCacheTime = 0;

function showAlert(message) {
  // alertDiv.style.display = "block";
  alertDiv.classList.add("hidden");
  alertDiv.textContent = message;
}

function hideAlert() {
  alertDiv.style.display = "none";
  alertDiv.textContent = "";
}

function setLoading(isLoading) {
  btnCalc.disabled = isLoading;
  btnReset.disabled = isLoading;
  btnCalc.textContent = isLoading ? "Bezig met berekenen…" : "Bereken uitstoot";
}

function setResultHtml(html) {
  resultDiv.innerHTML = html;
}

function resetForm() {
  hideAlert();

  flyFrom.value = "";
  flyTo.innerHTML = `<option value="" disabled selected>Selecteer eerst vertrek</option>`;
  flyTo.disabled = true;

  airlineInput.value = "";
  suggestionBox.style.display = "none";
  suggestionBox.innerHTML = "";

  depDate.value = "";
  depTime.value = "";
  flightNumber.value = "";

  setResultHtml(`<div class="alert" style="margin:0;">Nog geen berekening uitgevoerd.</div>`);
}

async function populateDepartureAirports() {
  try {
    const res = await fetch(`${API_BASE_URL}/abel/departureFrom`);
    const airports = await res.json();

    airports.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.airportID;
      opt.textContent = a.airportName;
      flyFrom.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    showAlert("Kon de lijst met luchthavens niet laden. Probeer de pagina te verversen.");
  }
}

async function populateArrivalAirports(selectedDeparture) {
  flyTo.disabled = true;
  flyTo.innerHTML = `<option value="" disabled selected>Bezig met laden…</option>`;

  try {
    const res = await fetch(`${API_BASE_URL}/abel/arrivalAt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fly_from: selectedDeparture })
    });

    const airports = await res.json();

    flyTo.innerHTML = `<option value="" disabled selected>Selecteer luchthaven</option>`;
    airports.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.airportID;
      opt.textContent = a.airportName;
      flyTo.appendChild(opt);
    });

    flyTo.disabled = false;
  } catch (err) {
    console.error(err);
    flyTo.innerHTML = `<option value="" disabled selected>Kon aankomst niet laden</option>`;
    flyTo.disabled = true;
    showAlert("Kon aankomstluchthavens niet laden. Probeer opnieuw.");
  }
}

async function getAllAirlinesCached() {
  const now = Date.now();
  // cache 10 minuten
  if (airlinesCache && (now - airlinesCacheTime) < 10 * 60 * 1000) return airlinesCache;

  const res = await fetch(`${API_BASE_URL}/abel/airlines`);
  const allAirlines = await res.json();
  airlinesCache = allAirlines;
  airlinesCacheTime = now;
  return allAirlines;
}

async function handleAirlineSuggestions() {
  const query = airlineInput.value.trim();
  if (query.length < 1) {
    suggestionBox.style.display = "none";
    return;
  }

  try {
    const allAirlines = await getAllAirlinesCached();
    const filtered = allAirlines.filter(a =>
      (a.airlineName || "").toLowerCase().includes(query.toLowerCase())
    ).slice(0, 10); // top 10 voor UX

    suggestionBox.innerHTML = "";
    if (filtered.length === 0) {
      suggestionBox.style.display = "none";
      return;
    }

    filtered.forEach(a => {
      const div = document.createElement("div");
      div.textContent = a.airlineName;
      div.addEventListener("click", () => {
        airlineInput.value = a.airlineName;
        suggestionBox.style.display = "none";
      });
      suggestionBox.appendChild(div);
    });

    // suggestionBox.style.display = "block";
    suggestionBox.classList.add("hidden");
  } catch (err) {
    console.error(err);
    suggestionBox.style.display = "none";
  }
}

async function berekenUitstoot() {
  hideAlert();

  const fly_from = flyFrom.value;
  const fly_to = flyTo.value;

  if (!fly_from || !fly_to) {
    showAlert("Selecteer een vertrek- en aankomstluchthaven.");
    return;
  }

  setLoading(true);
  setResultHtml(`<div class="alert" style="margin:0;">Bezig met berekenen…</div>`);

  try {
    const res = await fetch(`${API_BASE_URL}/abel/computeEmissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fly_from,
        fly_to,
        departure_date: depDate.value || null,
        departure_time: depTime.value || null,
        airline_name: airlineInput.value || null,
        flight_number: flightNumber.value || null
      })
    });

    if (!res.ok || !res.body) {
      setResultHtml(`<div class="alert alert-danger" style="margin:0;">Er ging iets mis bij het ophalen van de berekening.</div>`);
      setLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");

    // streamed HTML/text vanuit backend
    resultDiv.innerHTML = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      resultDiv.innerHTML += chunk;
    }

  } catch (err) {
    console.error(err);
    setResultHtml(`<div class="alert alert-danger" style="margin:0;">Netwerkfout tijdens berekenen. Probeer opnieuw.</div>`);
  } finally {
    setLoading(false);
  }
}

// Event listeners
flyFrom.addEventListener("change", () => {
  hideAlert();
  const selected = flyFrom.value;
  if (!selected) return;
  populateArrivalAirports(selected);
});

airlineInput.addEventListener("input", handleAirlineSuggestions);

document.addEventListener("click", (e) => {
  if (!suggestionBox.contains(e.target) && e.target !== airlineInput) {
    suggestionBox.style.display = "none";
  }
});

btnCalc.addEventListener("click", berekenUitstoot);
btnReset.addEventListener("click", resetForm);

// Init
document.addEventListener("DOMContentLoaded", () => {
  resetForm();
  populateDepartureAirports();
});