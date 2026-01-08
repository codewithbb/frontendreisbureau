// /assets/js/ticket-scan.js

const API_BASE_URL = "https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net/";
// const API_BASE_URL = "http://127.0.0.1:5001";

const form = document.getElementById("checkin-form");
const fileInput = document.getElementById("ticket-file");
const fileNameEl = document.getElementById("file-name");
const btnClear = document.getElementById("btn-clear");
const btnSubmit = document.getElementById("btn-submit");

const errorEl = document.getElementById("error");
const resultState = document.getElementById("resultState");
const spinner = document.getElementById("spinner");

function cleanIata(str) {
  if (!str) return "";
  return String(str).replace(/\s+/g, "").toUpperCase();
}

function escapeHtml(str) {
  return (str ?? "").toString().replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function showError(msg) {
  errorEl.style.display = "block";
  errorEl.textContent = msg;
}

function hideError() {
  errorEl.style.display = "none";
  errorEl.textContent = "";
}

function setLoading(loading) {
  btnSubmit.disabled = loading;
  btnClear.disabled = loading;
  fileInput.disabled = loading;
  btnSubmit.textContent = loading ? "Bezig met uploaden…" : "Upload & bekijk vlucht";
  spinner.style.display = loading ? "block" : "none";
}

function setEmptyResult() {
  resultState.innerHTML = `<div class="alert" style="margin:0;">Upload links je ticket om te beginnen.</div>`;
}

function renderResult(t) {
  const passenger = escapeHtml(t.PassengerName || "");
  const depCity = escapeHtml(t.DepartureCity || "");
  const arrCity = escapeHtml(t.ArrivalCity || "");
  const depIata = escapeHtml(cleanIata(t.DepartureIATA));
  const arrIata = escapeHtml(cleanIata(t.ArrivalIATA));

  const date = escapeHtml(t.DateOfFlight || "");
  const gate = escapeHtml(t.Gate || "");
  const board = escapeHtml(t.BoardingTime || "");
  const seat = escapeHtml(t.Seat || "");
  const luggage = escapeHtml(t.Luggage || "");
  const klass = escapeHtml(t.Class || "");
  const ticket = escapeHtml(t.TicketNr || "");

  resultState.innerHTML = `
    <div class="stack-sm">
      <div class="route-badge">
        <span>${depIata || "—"}</span>
        <small>${depCity || "Vertrek"}</small>
        <span style="opacity:.7;">→</span>
        <span>${arrIata || "—"}</span>
        <small>${arrCity || "Aankomst"}</small>
      </div>

      <div class="alert" style="margin:0;">
        <strong>Hallo ${passenger || "reiziger"}!</strong>
        Hieronder staan de herkende vluchtgegevens. Controleer altijd even of alles klopt.
      </div>

      <div class="kv">
        <div class="k">Vluchtdatum</div><div class="v">${date || "—"}</div>
        <div class="k">Gate</div><div class="v">${gate || "—"}</div>
        <div class="k">Boardingtijd</div><div class="v">${board || "—"}</div>
        <div class="k">Stoel</div><div class="v">${seat || "—"}</div>
        <div class="k">Bagage</div><div class="v">${luggage || "—"}</div>
        <div class="k">Reisklasse</div><div class="v">${klass || "—"}</div>
        <div class="k">Ticketnummer</div><div class="v">${ticket || "—"}</div>
      </div>
    </div>
  `;
}

fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  fileNameEl.textContent = f ? `${f.name} (${Math.round(f.size / 1024)} KB)` : "Nog geen bestand gekozen.";
  hideError();
});

btnClear.addEventListener("click", () => {
  fileInput.value = "";
  fileNameEl.textContent = "Nog geen bestand gekozen.";
  hideError();
  setEmptyResult();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const file = fileInput.files?.[0];
  if (!file) {
    showError("Selecteer eerst een ticketafbeelding.");
    return;
  }

  setLoading(true);

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${API_BASE_URL}/donny/checkin`, {
      method: "POST",
      body: formData,
      credentials: "include"
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      showError(json.error || "Er ging iets mis bij het verwerken van je ticket.");
      setEmptyResult();
      return;
    }

    const t = json.data || {};
    renderResult(t);

  } catch (err) {
    console.error(err);
    showError("Onverwachte fout bij het versturen van je ticket.");
    setEmptyResult();
  } finally {
    setLoading(false);
  }
});

// init
document.addEventListener("DOMContentLoaded", () => {
  setEmptyResult();
});