// /assets/js/mystery-trip.js

//const API_BASE_URL = "http://127.0.0.1:5001";
const API_BASE_URL = "https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net/";

const form = document.getElementById("tripForm");
const resultState = document.getElementById("resultState");
const formError = document.getElementById("form-error");

const btnSubmit = document.getElementById("btn-submit");
const btnReset  = document.getElementById("btn-reset");
const btnRead   = document.getElementById("btn-read");
const speechStatus = document.getElementById("speech-status");

let lastResultData = null; // bewaren voor voorlezen

function showFormError(msg) {
  formError.style.display = "block";
  formError.textContent = msg;
}

function hideFormError() {
  formError.style.display = "none";
  formError.textContent = "";
}

function setLoading(loading) {
  btnSubmit.disabled = loading;
  btnReset.disabled = loading;
  btnSubmit.textContent = loading ? "Bezig met genereren…" : "Advies genereren";
}

function setResultLoading() {
  resultState.innerHTML = `
    <div class="stack-sm">
      <div class="loader" aria-label="Laden"></div>
      <div class="meta" style="text-align:center;">Bezig met het genereren van jouw mystery trip…</div>
    </div>
  `;
}

function setResultEmpty() {
  resultState.innerHTML = `<div class="alert" style="margin:0;">Vul links je gegevens in en klik op “Advies genereren”.</div>`;
}

function setResultError(msg) {
  resultState.innerHTML = `<div class="alert alert-danger" style="margin:0;"><strong>Fout:</strong> ${escapeHtml(msg)}</div>`;
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function setResultSuccess(data) {
  const klantnaam = escapeHtml(data.klantnaam || "");
  const typeReis  = escapeHtml(data.type_reis || "");
  const paklijst  = escapeHtml(data.paklijst || "");
  const motivatie = escapeHtml(data.motivatie || "");

  resultState.innerHTML = `
    <div class="stack-sm">
      <div class="alert" style="margin:0;">
        <strong>Hey <span id="klantnaamText">${klantnaam}</span>,</strong>
        jouw ideale <span id="type_reisText">${typeReis}</span> is bepaald!<br/>
        <span class="muted">De bestemming blijft nog een verrassing…</span>
      </div>

      <div>
        <h3 style="margin:0 0 8px 0;">Paklijst</h3>
        <div class="paklijst" id="paklijstText">${paklijst}</div>
      </div>

      <div class="accordion" id="motivatieAcc">
        <button type="button" id="toggleMotivatie">
          Waarom past deze trip bij jou? ▾
        </button>
        <div class="body" id="motivatieText">${motivatie}</div>
      </div>
    </div>
  `;

  // accordion toggle
  const acc = document.getElementById("motivatieAcc");
  const btn = document.getElementById("toggleMotivatie");
  btn.addEventListener("click", () => {
    acc.classList.toggle("open");
  });
}

function normalizePayload(formData) {
  const payload = Object.fromEntries(formData.entries());
  payload.aantal_personen = Number(payload.aantal_personen);
  payload.budget_pp_eur = Number(payload.budget_pp_eur);
  payload.aantal_dagen = Number(payload.aantal_dagen);
  return payload;
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include"
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || "Onbekende fout");
  return data;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideFormError();
  speechStatus.textContent = "";
  btnRead.disabled = true;
  lastResultData = null;

  const formData = new FormData(form);
  const payload = normalizePayload(formData);

  setLoading(true);
  setResultLoading();

  try {
    const data = await postJson(`${API_BASE_URL}/esmee`, payload);
    lastResultData = data;

    setResultSuccess(data);
    btnRead.disabled = false;

  } catch (err) {
    console.error(err);
    setResultError(err.message);
    showFormError("Controleer je invoer en probeer opnieuw.");
  } finally {
    setLoading(false);
  }
});

btnReset.addEventListener("click", () => {
  form.reset();
  hideFormError();
  speechStatus.textContent = "";
  btnRead.disabled = true;
  lastResultData = null;
  setResultEmpty();
});

// ===== Speech synthesis =====
async function getSpeechToken() {
  const res = await fetch(`${API_BASE_URL}/esmee/speech-token2`, {
    method: "GET",
    credentials: "include"
  });
  if (!res.ok) throw new Error("Kan speech-token niet ophalen.");
  return res.json(); // { token, region }
}

function buildSpeechTextFromData(data) {
  const klantnaam = data?.klantnaam || "";
  const typeReis  = data?.type_reis || "";
  const paklijst  = data?.paklijst || "";
  const motivatie = data?.motivatie || "";

  return `Hey ${klantnaam}. Jouw ideale ${typeReis} is bepaald. De bestemming blijft nog een verrassing. ` +
         `Om het vertrek goed te laten verlopen, hier alvast de paklijst: ${paklijst}. ` +
         `Waarom dit bij je past: ${motivatie}`;
}

async function leesVoorAzure() {
  if (!window.SpeechSDK) {
    alert("SpeechSDK is niet geladen.");
    return;
  }
  if (!lastResultData) {
    alert("Genereer eerst een advies voordat je het laat voorlezen.");
    return;
  }

  const tekst = buildSpeechTextFromData(lastResultData);
  if (!tekst.trim()) {
    alert("Geen tekst om voor te lezen.");
    return;
  }

  btnRead.disabled = true;
  speechStatus.textContent = "Voorlezen gestart…";

  try {
    const { token, region } = await getSpeechToken();
    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechSynthesisLanguage = "nl-NL";
    speechConfig.speechSynthesisVoiceName = "nl-NL-ColetteNeural";

    const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
    const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);

    synthesizer.speakTextAsync(
      tekst,
      (result) => {
        console.log("Voorlezen voltooid:", result);
        speechStatus.textContent = "Voorlezen voltooid ✓";
        synthesizer.close();
        btnRead.disabled = false;
      },
      (err) => {
        console.error("Fout bij voorlezen:", err);
        speechStatus.textContent = "Fout bij voorlezen.";
        synthesizer.close();
        btnRead.disabled = false;
      }
    );

  } catch (err) {
    console.error(err);
    speechStatus.textContent = "Er ging iets mis bij het ophalen van token of spraak.";
    btnRead.disabled = false;
  }
}

btnRead.addEventListener("click", leesVoorAzure);

// Init
document.addEventListener("DOMContentLoaded", () => {
  setResultEmpty();
});