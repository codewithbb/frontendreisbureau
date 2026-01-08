// /assets/js/mijn-reizen.js

let currentUser = null; // { user_id, username, full_name }

// DOM
const loginSection     = document.getElementById("login-section");
const appSection       = document.getElementById("app-section");
const loginForm        = document.getElementById("login-form");
const loginButton      = document.getElementById("login-button");
const loginError       = document.getElementById("login-error");
const usernameInput    = document.getElementById("username");
const passwordInput    = document.getElementById("password");

const userInfoDiv      = document.getElementById("user-info");
const tripsContainer   = document.getElementById("trips-container");
const reviewsContainer = document.getElementById("reviews-container");
const refreshButton    = document.getElementById("refresh-button");
const logoutButton     = document.getElementById("logout-button");
const aiButton         = document.getElementById("ai-button");

// AI overlay
const aiOverlay        = document.getElementById("ai-overlay");
const aiDialog         = document.getElementById("ai-dialog");
const aiForm           = document.getElementById("ai-form");
const aiIncludeTrips   = document.getElementById("ai-include-trips");
const aiIncludeReviews = document.getElementById("ai-include-reviews");
const aiStrategy       = document.getElementById("ai-strategy");
const aiNotes          = document.getElementById("ai-notes");
const aiError          = document.getElementById("ai-error");
const aiSubmit         = document.getElementById("ai-submit");
const aiCancel         = document.getElementById("ai-cancel");
const aiCancelX        = document.getElementById("ai-cancel-x");
const aiResult         = document.getElementById("ai-result-container");
const aiMeta           = document.getElementById("ai-meta");

const aiSpeechBtn      = document.getElementById("ai-speech-btn");
const aiSpeechStatus   = document.getElementById("ai-speech-status");

let speechRecognizer = null;

//const API_BASE = "http://127.0.0.1:5001";
const API_BASE = "https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net/";

// Marked config
if (window.marked) {
  marked.setOptions({ headerIds: false, mangle: false });
}

function showLoginError(message) {
  loginError.style.display = "block";
  loginError.textContent = message;
}

function hideLoginError() {
  loginError.style.display = "none";
  loginError.textContent = "";
}

function showAiError(message) {
  aiError.style.display = "block";
  aiError.textContent = message;
}

function hideAiError() {
  aiError.style.display = "none";
  aiError.textContent = "";
}

function showLogin() {
  loginSection.classList.remove("hidden");
  appSection.classList.add("hidden");
  hideLoginError();
  currentUser = null;
  closeAiOverlay();

  tripsContainer.innerHTML = `<div class="alert" style="margin:0;">Nog geen reizen geladen.</div>`;
  reviewsContainer.innerHTML = `<div class="alert" style="margin:0;">Nog geen reviews geladen.</div>`;
}

function showApp() {
  loginSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  hideLoginError();

  if (currentUser) {
    const name = currentUser.full_name || currentUser.username || "";
    userInfoDiv.textContent = `Ingelogd als ${name}`;
  } else {
    userInfoDiv.textContent = "";
  }

  closeAiOverlay();
}

async function checkSessionAndInit() {
  try {
    const resp = await fetch(`${API_BASE}/julian/session`, {
      method: "GET",
      credentials: "include",
    });

    if (!resp.ok) {
      showLogin();
      return;
    }

    const data = await resp.json();
    if (data.logged_in && data.user) {
      currentUser = data.user;
      showApp();
      await loadJulianData();
    } else {
      showLogin();
    }
  } catch (err) {
    console.error("Session check error:", err);
    showLogin();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  hideLoginError();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showLoginError("Vul zowel gebruikersnaam als wachtwoord in.");
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "Bezig met inloggen…";

  try {
    const resp = await fetch(`${API_BASE}/julian/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password })
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      showLoginError(errText || "Inloggen mislukt.");
      return;
    }

    const data = await resp.json().catch(() => null);
    if (!data || !data.success || !data.user) {
      showLoginError(data?.error || "Ongeldige gebruikersnaam of wachtwoord.");
      return;
    }

    currentUser = data.user;
    showApp();
    await loadJulianData();

  } catch (error) {
    console.error("Login fetch error:", error);
    showLoginError("Er ging iets mis tijdens het inloggen.");
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Log in";
  }
}

async function loadJulianData() {
  tripsContainer.innerHTML = `<div class="alert" style="margin:0;">Reizen laden…</div>`;
  reviewsContainer.innerHTML = `<div class="alert" style="margin:0;">Reviews laden…</div>`;

  try {
    const resp = await fetch(`${API_BASE}/julian`, {
      method: "GET",
      credentials: "include"
    });

    if (!resp.ok) {
      tripsContainer.innerHTML = `<div class="alert alert-danger" style="margin:0;">Kon reizen niet laden.</div>`;
      reviewsContainer.innerHTML = `<div class="alert alert-danger" style="margin:0;">Kon reviews niet laden.</div>`;
      return;
    }

    const data = await resp.json().catch(() => null);
    if (!data) {
      tripsContainer.innerHTML = `<div class="alert alert-danger" style="margin:0;">Ongeldige data voor reizen.</div>`;
      reviewsContainer.innerHTML = `<div class="alert alert-danger" style="margin:0;">Ongeldige data voor reviews.</div>`;
      return;
    }

    if (data.user) {
      currentUser = data.user;
      const name = currentUser.full_name || currentUser.username || "";
      userInfoDiv.textContent = `Ingelogd als ${name}`;
    }

    renderTrips(data.trips || []);
    renderReviews(data.reviews || []);

  } catch (error) {
    console.error("Error loading julian data:", error);
    tripsContainer.innerHTML = `<div class="alert alert-danger" style="margin:0;">Fout bij laden van reizen.</div>`;
    reviewsContainer.innerHTML = `<div class="alert alert-danger" style="margin:0;">Fout bij laden van reviews.</div>`;
  }
}

function renderTrips(trips) {
  if (!trips.length) {
    tripsContainer.innerHTML = `<div class="alert" style="margin:0;">Je hebt nog geen reizen.</div>`;
    return;
  }

  const html = trips.map(trip => {
    const depCity = trip.departure_city_name || "Onbekende vertrekplaats";
    const arrCity = trip.arrival_city_name || "Onbekende bestemming";
    const depDate = trip.departure_date ? trip.departure_date.substring(0, 10) : "";
    const retDate = trip.return_date ? trip.return_date.substring(0, 10) : "enkele reis";
    const airline = trip.primary_airline_name || "Onbekende maatschappij";
    const price   = trip.total_price != null ? `${trip.total_price} ${trip.currency_code || ""}` : "n.v.t.";
    const purpose = trip.purpose || "Onbekend doel";

    return `
      <div class="item">
        <div class="item-title">
          <strong>${depCity} → ${arrCity}</strong>
          <span class="meta">${depDate}${retDate ? " – " + retDate : ""}</span>
        </div>
        <div class="meta">${airline} · ${purpose} · ${price}</div>
      </div>
    `;
  }).join("");

  tripsContainer.innerHTML = html;
}

function renderReviews(reviews) {
  if (!reviews.length) {
    reviewsContainer.innerHTML = `<div class="alert" style="margin:0;">Je hebt nog geen reviews geschreven.</div>`;
    return;
  }

  const html = reviews.map(r => {
    const title  = r.review_title || "(Zonder titel)";
    const rating = r.rating != null ? `Beoordeling: ${r.rating}/5` : "";
    const when   = r.travel_date ? r.travel_date.substring(0, 10) : "";
    const airline = r.airline_name || "";
    const airport = r.airport_code || "";
    const city    = r.city_name || "";
    const place   = [airline, airport, city].filter(Boolean).join(" · ");

    return `
      <div class="item">
        <div class="item-title">
          <strong>${title}</strong>
          <span class="meta">${rating}${when ? " · " + when : ""}</span>
        </div>
        <div class="meta">${place}</div>
        <div style="margin-top:6px; color: rgba(86, 191, 207, 0.73); font-style: italic">
          ${(r.review_text || "").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}
        </div>
      </div>
    `;
  }).join("");

  reviewsContainer.innerHTML = html;
}

async function handleLogout() {
  try {
    await fetch(`${API_BASE}/julian/logout`, { method: "POST", credentials: "include" });
  } catch (e) {
    console.error("Logout error:", e);
  }
  showLogin();
}

// ===== AI overlay =====
function openAiOverlay() {
  hideAiError();
  aiMeta.textContent = "";
  aiResult.innerHTML = `<div class="alert" style="margin:0;">Je aanbeveling verschijnt hier.</div>`;
  aiSubmit.disabled = false;
  aiSubmit.textContent = "Genereer aanbeveling";
  aiSpeechStatus.textContent = "";
  aiOverlay.classList.remove("hidden");

  // Focus in modal
  setTimeout(() => aiNotes?.focus(), 50);
}

function closeAiOverlay() {
  aiOverlay.classList.add("hidden");
}

function closeOnOutsideClick(e) {
  if (!aiDialog.contains(e.target)) closeAiOverlay();
}

function closeOnEscape(e) {
  if (e.key === "Escape") closeAiOverlay();
}

async function handleAiSubmit(event) {
  event.preventDefault();
  hideAiError();

  aiSubmit.disabled = true;
  aiSubmit.textContent = "Bezig met genereren…";
  aiMeta.textContent = "";
  aiResult.innerHTML = `<div class="alert" style="margin:0;">Aanbeveling wordt gegenereerd…</div>`;

  const rawPref = aiStrategy.value; // surprise | far | new | repeat
  let distancePreference = null;
  if (rawPref === "far") distancePreference = "far";
  else if (rawPref === "new") distancePreference = "new";
  else if (rawPref === "repeat") distancePreference = "been_before";

  const payload = {
    include_trips: aiIncludeTrips.checked,
    include_reviews: aiIncludeReviews.checked,
    distance_preference: distancePreference,
    extra_notes: aiNotes.value || ""
  };

  try {
    const resp = await fetch(`${API_BASE}/julian/ai_recommendation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      showAiError(text || "Kon geen aanbeveling genereren.");
      aiResult.innerHTML = `<div class="alert alert-danger" style="margin:0;">Er ging iets mis.</div>`;
      return;
    }

    const data = await resp.json().catch(() => null);
    if (!data || !data.success) {
      showAiError(data?.error || "Kon geen aanbeveling genereren.");
      aiResult.innerHTML = `<div class="alert alert-danger" style="margin:0;">Er ging iets mis.</div>`;
      return;
    }

    const rec = data.recommendation || "(Geen tekst ontvangen)";
    const tripsCount = data.used_trips ?? null;
    const reviewsCount = data.used_reviews ?? null;

    const metaPieces = [];
    if (typeof tripsCount === "number") metaPieces.push(`${tripsCount} reizen`);
    if (typeof reviewsCount === "number") metaPieces.push(`${reviewsCount} reviews`);
    if (data.model) metaPieces.push(`model: ${data.model}`);

    aiMeta.textContent = metaPieces.length ? `Gebaseerd op: ${metaPieces.join(", ")}.` : "";

    const html = window.marked ? marked.parse(rec) : rec;
    aiResult.innerHTML = html;

  } catch (err) {
    console.error("AI fetch error:", err);
    showAiError("Er ging iets mis bij het communiceren met de AI.");
    aiResult.innerHTML = `<div class="alert alert-danger" style="margin:0;">Netwerkfout.</div>`;
  } finally {
    aiSubmit.disabled = false;
    aiSubmit.textContent = "Genereer aanbeveling";
  }
}

// ===== Speech to text for notes =====
function getSelectedSpeechLanguage() {
  const dropdown = document.getElementById("ai-stt-language");
  return dropdown?.value || "nl-NL";
}

async function startSpeechToText() {
  aiSpeechStatus.textContent = "";
  aiSpeechBtn.disabled = true;

  try {
    const tokenResp = await fetch(`${API_BASE}/julian/speech-token`, {
      method: "GET",
      credentials: "include"
    });

    if (!tokenResp.ok) {
      aiSpeechStatus.textContent = "Kan spraakherkenning niet starten.";
      return;
    }

    const { token, region } = await tokenResp.json();
    if (!token || !region) {
      aiSpeechStatus.textContent = "Ongeldig speech-token antwoord.";
      return;
    }

    const SpeechSDK = window.SpeechSDK;
    if (!SpeechSDK) {
      aiSpeechStatus.textContent = "Speech SDK is niet geladen.";
      return;
    }

    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechRecognitionLanguage = getSelectedSpeechLanguage();

    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    speechRecognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    aiSpeechStatus.textContent = "Aan het luisteren… spreek nu.";

    speechRecognizer.recognizeOnceAsync(
      (result) => {
        try {
          if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
            const text = result.text || "";
            if (text) {
              if (aiNotes.value && !aiNotes.value.endsWith(" ")) aiNotes.value += " ";
              aiNotes.value += text;
            }
            aiSpeechStatus.textContent = `Herkenning: ${text}`;
          } else if (result.reason === SpeechSDK.ResultReason.NoMatch) {
            aiSpeechStatus.textContent = "Geen spraak herkend.";
          } else {
            aiSpeechStatus.textContent = "Spraakherkenning gestopt.";
          }
        } finally {
          try { speechRecognizer.close(); } catch(e) {}
          speechRecognizer = null;
          aiSpeechBtn.disabled = false;
        }
      },
      (err) => {
        console.error("Speech recognition error:", err);
        aiSpeechStatus.textContent = "Fout bij spraakherkenning.";
        if (speechRecognizer) {
          try { speechRecognizer.close(); } catch(e) {}
          speechRecognizer = null;
        }
        aiSpeechBtn.disabled = false;
      }
    );

  } catch (err) {
    console.error("Speech setup error:", err);
    aiSpeechStatus.textContent = "Kon spraakherkenning niet starten.";
    aiSpeechBtn.disabled = false;
  }
}

// Events
loginForm.addEventListener("submit", handleLogin);
refreshButton?.addEventListener("click", loadJulianData);
logoutButton?.addEventListener("click", handleLogout);

aiButton?.addEventListener("click", openAiOverlay);
aiCancel?.addEventListener("click", closeAiOverlay);
aiCancelX?.addEventListener("click", closeAiOverlay);
aiForm?.addEventListener("submit", handleAiSubmit);

aiSpeechBtn?.addEventListener("click", startSpeechToText);

// modal close behaviors
aiOverlay?.addEventListener("click", closeOnOutsideClick);
document.addEventListener("keydown", closeOnEscape);

// Init
document.addEventListener("DOMContentLoaded", () => {
  checkSessionAndInit();
});