// /assets/js/vlucht-boeken.js

const API_BASE_URL = "https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net/";
// const API_BASE_URL = "http://127.0.0.1:5001";

let currentUser = null;

// DOM
const mustLogin = document.getElementById("must-login");
const bookingSection = document.getElementById("booking-section");

const flyFromEl = document.getElementById("fly_from");
const flyToEl = document.getElementById("fly_to");
const dateEl = document.getElementById("departure_date");

const emailEl = document.getElementById("email");
const extraInfoEl = document.getElementById("extra_info");

const btnBook = document.getElementById("boek-btn");
const btnReset = document.getElementById("reset-btn");

const loadingEl = document.getElementById("loading");
const resultEl = document.getElementById("result-message");
const formErrorEl = document.getElementById("form-error");

const sumFrom = document.getElementById("sum-from");
const sumTo = document.getElementById("sum-to");
const sumDate = document.getElementById("sum-date");
const sumEmail = document.getElementById("sum-email");

const imgEl = document.getElementById("genImg");

// helpers
function setHidden(el, hidden) {
  el.classList.toggle("hidden", hidden);
}

function setResult(type, message) {
  // type: "success" | "warn" | "error"
  resultEl.className = ""; // reset
  resultEl.classList.add("alert");
  if (type === "success") resultEl.classList.add("alert-success");
  if (type === "warn")    resultEl.classList.add("alert-warning");
  if (type === "error")   resultEl.classList.add("alert-danger");
  resultEl.textContent = message;
  setHidden(resultEl, false);
}

function clearResult() {
  resultEl.textContent = "";
  setHidden(resultEl, true);
}

function setFormError(msg) {
  formErrorEl.textContent = msg;
  setHidden(formErrorEl, !msg);
}

function setLoading(loading) {
  setHidden(loadingEl, !loading);
  btnBook.disabled = loading;
  btnReset.disabled = loading;
  flyFromEl.disabled = loading;
  flyToEl.disabled = loading || flyToEl.dataset.enabled !== "true";
  dateEl.disabled = loading || dateEl.dataset.enabled !== "true";
  emailEl.disabled = loading;
  extraInfoEl.disabled = loading;
  btnBook.textContent = loading ? "Bezig…" : "Boek vlucht";
}

function updateSummary() {
  const fromText = flyFromEl.selectedOptions?.[0]?.textContent || "—";
  const toText   = flyToEl.selectedOptions?.[0]?.textContent || "—";
  const dateText = dateEl.value || "—";
  const emailTxt = emailEl.value?.trim() || "—";

  sumFrom.textContent = fromText;
  sumTo.textContent = toText;
  sumDate.textContent = dateText;
  sumEmail.textContent = emailTxt;
}

function resetDependentDropdown(el, placeholder) {
  el.innerHTML = `<option value="" selected disabled>${placeholder}</option>`;
  el.value = "";
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || res.statusText || "Onbekende fout");
  return data;
}

// === Prompt genereren ===
function buildImagePrompt(destinationName, extraInfo) {
  const plaats = (destinationName || "").trim();
  const activiteit = (extraInfo || "").trim();

  if (!plaats) return null;

  if (activiteit) {
    return `Fotorealistische afbeelding van een vakantie die land op ${plaats}, waar iemand ${activiteit} doet. Realistische stijl, zonder tekst. Foto herkenbaar als een vakantie in het land of de stad waar het vliegveld licht.`;
  }
  return `Fotorealistische afbeelding van een vakantie die land op ${plaats}. Realistische stijl, zonder tekst. Foto herkenbaar als een vakantie in het land of de stad waar het vliegveld licht.`;
}

// === Afbeelding genereren via backend ===
async function generateImageForBooking(destinationName, extraInfo) {
  const prompt = buildImagePrompt(destinationName, extraInfo);
  if (!prompt) return "";

  const res = await fetch(`${API_BASE_URL}/images/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ prompt })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || "Fout bij genereren van afbeelding");

  imgEl.src = data.image_url || "";
  return imgEl.src;
}

// --- auth gate ---
async function initAuthGate() {
  const { loggedIn, user } = await getCurrentSession();

  if (loggedIn) {
    currentUser = user;
    setHidden(bookingSection, false);
    setHidden(mustLogin, true);
    await loadDepartureAirports();
  } else {
    setHidden(bookingSection, true);
    setHidden(mustLogin, false);
  }
}

// --- 1. Load airports ---
async function loadDepartureAirports() {
  try {
    const airports = await fetchJson(`${API_BASE_URL}/vlucht_boeken/departureFrom`);
    airports.forEach(airport => {
      const opt = document.createElement("option");
      opt.value = airport.airportID;
      opt.textContent = airport.airportName;
      flyFromEl.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    setFormError("Kan vertrekluchthavens niet laden. Probeer later opnieuw.");
  }
}

// --- 2. Dropdown events ---
async function onDepartureChanged() {
  clearResult();
  setFormError("");

  flyToEl.dataset.enabled = "false";
  dateEl.dataset.enabled = "false";

  resetDependentDropdown(flyToEl, "Selecteer luchthaven");
  resetDependentDropdown(dateEl, "Selecteer eerst route");

  flyToEl.disabled = true;
  dateEl.disabled = true;

  const fly_from = flyFromEl.value;
  updateSummary();

  if (!fly_from) return;

  try {
    const airports = await fetchJson(`${API_BASE_URL}/vlucht_boeken/arrivalAt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fly_from })
    });

    airports.forEach(airport => {
      const opt = document.createElement("option");
      opt.value = airport.airportID;
      opt.textContent = airport.airportName;
      flyToEl.appendChild(opt);
    });

    flyToEl.dataset.enabled = "true";
    flyToEl.disabled = false;

  } catch (err) {
    console.error(err);
    setFormError("Kan aankomstluchthavens niet laden voor deze vertrekhaven.");
  }
}

async function onArrivalChanged() {
  clearResult();
  setFormError("");

  dateEl.dataset.enabled = "false";
  resetDependentDropdown(dateEl, "Selecteer datum");
  dateEl.disabled = true;

  const fly_from = flyFromEl.value;
  const fly_to = flyToEl.value;
  updateSummary();

  if (!fly_from || !fly_to) return;

  try {
    const dates = await fetchJson(`${API_BASE_URL}/vlucht_boeken/departureDate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fly_from, fly_to })
    });

    dates.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.departure_date;
      opt.textContent = d.departure_date;
      dateEl.appendChild(opt);
    });

    dateEl.dataset.enabled = "true";
    dateEl.disabled = false;

  } catch (err) {
    console.error(err);
    setFormError("Kan vertrekdata niet laden voor deze route.");
  }
}

// --- 3. Book flow ---
async function bookFlight() {
  clearResult();
  setFormError("");
  updateSummary();

  const flyFrom = flyFromEl.value;
  const flyTo = flyToEl.value;
  const date = dateEl.value;
  const extraInfo = extraInfoEl.value;
  const email = emailEl.value.trim();

  const fromName = flyFromEl.selectedOptions?.[0]?.textContent || "";
  const toName = flyToEl.selectedOptions?.[0]?.textContent || "";

  if (!flyFrom || !flyTo || !date || !email) {
    setFormError("Vul alle verplichte velden in (vertrek, aankomst, datum en e-mail).");
    return;
  }

  setLoading(true);

  try {
    // 1) boek vlucht in database
    const bookData = await fetchJson(`${API_BASE_URL}/vlucht_boeken/boeken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fly_from: flyFrom,
        fly_to: flyTo,
        travel_date: date
      })
    });

    if (!bookData.success) throw new Error(bookData.error || "Boeken mislukt.");

    // 2) generate image (optional, but you do it always)
    let imageUrl = "";
    try {
      imageUrl = await generateImageForBooking(toName, extraInfo);
    } catch (imgErr) {
      console.warn("Afbeelding genereren mislukt:", imgErr);
      imageUrl = ""; // we still continue with email
    }

    // 3) send email
    const mailRes = await fetch(`${API_BASE_URL}/vlucht_boeken/send_email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        from_name: fromName,
        to_name: toName,
        date,
        image_url: imageUrl
      })
    });

    const mailData = await mailRes.json().catch(() => ({}));

    if (mailRes.ok && mailData.success) {
      setResult("success", "Vlucht succesvol geboekt! Bevestigingsmail is verzonden.");
    } else {
      setResult("warn", "Vlucht geboekt, maar de bevestigingsmail kon niet worden verzonden.");
    }

  } catch (err) {
    console.error(err);
    setResult("error", err.message || "Er ging iets mis.");
  } finally {
    setLoading(false);
  }
}

// reset button
function resetAll() {
  clearResult();
  setFormError("");

  flyFromEl.value = "";
  resetDependentDropdown(flyToEl, "Selecteer eerst vertrek");
  resetDependentDropdown(dateEl, "Selecteer eerst route");

  flyToEl.dataset.enabled = "false";
  dateEl.dataset.enabled = "false";

  flyToEl.disabled = true;
  dateEl.disabled = true;

  emailEl.value = "";
  extraInfoEl.value = "";
  imgEl.src = "";

  updateSummary();
}

// listeners
document.addEventListener("DOMContentLoaded", async () => {
  // mark initial enabled states
  flyToEl.dataset.enabled = "false";
  dateEl.dataset.enabled = "false";

  await initAuthGate();
  updateSummary();

  flyFromEl.addEventListener("change", onDepartureChanged);
  flyToEl.addEventListener("change", onArrivalChanged);
  dateEl.addEventListener("change", updateSummary);
  emailEl.addEventListener("input", updateSummary);

  btnBook.addEventListener("click", bookFlight);
  btnReset.addEventListener("click", resetAll);
});