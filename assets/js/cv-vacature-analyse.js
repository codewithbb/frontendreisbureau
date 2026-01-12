// /assets/js/cv/cv-vacature-analyse.js
const API_BASE_URL = "https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net";
//const API_BASE_URL = "http://127.0.0.1:5001"

// ---- DOM (upload) ----
const uploadBtn = document.getElementById("uploadBtn");
const uploadCvClear = document.getElementById("uploadCvClear");
const uploadResponse = document.getElementById("uploadResponse");
const uploadCvStatus = document.getElementById("uploadCvStatus");

const uploadVacBtn = document.getElementById("uploadVacBtn");
const uploadVacTextBtn = document.getElementById("uploadVacTextBtn");
const uploadVacClear = document.getElementById("uploadVacClear");
const vacUploadResponse = document.getElementById("vacUploadResponse");
const uploadVacStatus = document.getElementById("uploadVacStatus");

// ---- DOM (analysis) ----
const evalCvDropdown = document.getElementById("eval_cv_id");
const evalVacancyDropdown = document.getElementById("eval_vacancy_id");
const evalNotes = document.getElementById("eval_notes");
const evaluateBtn = document.getElementById("evaluateBtn");
const evaluateClearBtn = document.getElementById("evaluateClearBtn");
const evalResponse = document.getElementById("evalResponse");
const evalStatus = document.getElementById("evalStatus");

const vacEvalDropdown = document.getElementById("vac_eval_id");
const vacEvalNotes = document.getElementById("vac_eval_notes");
const vacEvalBtn = document.getElementById("vac_eval_btn");
const vacEvalResponse = document.getElementById("vac_eval_response");
const vacEvalStatus = document.getElementById("vacEvalStatus");

const matchVacancyDropdown = document.getElementById("match_vacancy_id");
const matchVacancyBtn = document.getElementById("match_vacancy_btn");
const matchVacancyResults = document.getElementById("match_vacancy_results");

const matchCvDropdown = document.getElementById("match_cv_id");
const matchCvBtn = document.getElementById("match_cv_btn");
const matchCvResults = document.getElementById("match_cv_results");

// ---- DOM (viewer) ----
const viewerType = document.getElementById("viewer_type");
const viewerId = document.getElementById("viewer_id");
const viewerDetails = document.getElementById("viewer_details");
const viewerNotes = document.getElementById("viewer_notes");
const viewerSaveBtn = document.getElementById("viewer_save_notes");
const viewerSaveResponse = document.getElementById("viewer_save_response");
const viewerStatus = document.getElementById("viewerStatus");

// ---- Tabs ----
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    document.getElementById("tab-analyse").classList.toggle("hidden", tab !== "analyse");
    document.getElementById("tab-viewer").classList.toggle("hidden", tab !== "viewer");
  });
});

// ---- helpers ----
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setAlert(el, type, msg) {
  // type: info|success|warning|danger
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove("hidden");
}
function clearAlert(el) {
  el.className = "alert hidden";
  el.textContent = "";
}
function setPre(el, objOrText) {
  el.textContent = (typeof objOrText === "string")
    ? objOrText
    : JSON.stringify(objOrText, null, 2);
  el.classList.remove("hidden");
}

async function fetchJson(url, options = {}) {
  const resp = await fetch(url, options);
  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!resp.ok) {
    const msg = (data && (data.error || data.message)) ? (data.error || data.message) : text;
    throw new Error(msg || `HTTP ${resp.status}`);
  }
  return data;
}

function fillGenericDropdown(selectEl, items, placeholder) {
  selectEl.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item.ID;
    const label = item.DisplayName
      ? `${item.ID} — ${item.DisplayName}`
      : (item.FileName ? `${item.ID} — ${item.FileName}` : String(item.ID));
    option.textContent = label;
    selectEl.appendChild(option);
  });
}

async function loadAvailableCvs() {
  const cvs = await fetchJson(`${API_BASE_URL}/cv/get_available_cvs`);
  fillGenericDropdown(evalCvDropdown, cvs, "CV kiezen…");
  fillGenericDropdown(matchCvDropdown, cvs, "CV kiezen…");
  if (viewerType.value === "cv") fillGenericDropdown(viewerId, cvs, "CV kiezen…");
}

async function loadAvailableVacancies() {
  const vacancies = await fetchJson(`${API_BASE_URL}/vacancy/get_available_vacancies`);
  fillGenericDropdown(evalVacancyDropdown, vacancies, "Vacature kiezen…");
  fillGenericDropdown(vacEvalDropdown, vacancies, "Vacature kiezen…");
  fillGenericDropdown(matchVacancyDropdown, vacancies, "Vacature kiezen…");
  if (viewerType.value === "vacancy") fillGenericDropdown(viewerId, vacancies, "Vacature kiezen…");
}

// ---- AI evaluation card (reuse your renderer but fix usage) ----
function scoreClass(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

function renderAiEvaluation(result) {
  const card = document.getElementById("ai-eval-card");
  if (!card) return;

  if (!result) {
    card.classList.remove("hidden");
    card.innerHTML = "<p class='muted'>Geen evaluatie-resultaat ontvangen.</p>";
    return;
  }

  const fitScore = Number(result.fit_score ?? 0);
  const summary = result.fit_summary ?? "";
  const strengths = Array.isArray(result.strengths) ? result.strengths : [];
  const gaps = Array.isArray(result.gaps) ? result.gaps : [];
  const steps = Array.isArray(result.recommended_next_steps) ? result.recommended_next_steps : [];

  const ul = (arr, empty) => arr.length
    ? `<ul>${arr.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`
    : `<p class="muted">${empty}</p>`;

  card.innerHTML = `
    <div class="ai-eval-header">
      <div>
        <div class="ai-eval-title">Match met vacature</div>
        <div class="ai-eval-muted">AI is hulpmiddel — geen definitieve beslissing.</div>
      </div>
      <div class="ai-eval-score ${scoreClass(fitScore)}">${fitScore}/100</div>
    </div>

    <div class="ai-eval-section">
      <h3>Samenvatting</h3>
      <p>${escapeHtml(summary)}</p>
    </div>

    <div class="ai-eval-section">
      <h3>Sterktes</h3>
      ${ul(strengths, "Geen sterke punten gedetecteerd op basis van de aangeleverde tekst.")}
    </div>

    <div class="ai-eval-section">
      <h3>Hiaten / onzekerheden</h3>
      ${ul(gaps, "Geen duidelijke hiaten genoemd.")}
    </div>

    <div class="ai-eval-section">
      <h3>Aanbevolen vervolgstappen</h3>
      ${ul(steps, "Geen vervolgstappen voorgesteld.")}
    </div>
  `;
  card.classList.remove("hidden");
}

function renderVacancyEvaluation(result) {
  if (!result) return "Geen evaluatie-resultaat ontvangen.";
  const lines = [];
  const listSection = (title, arr) => {
    lines.push(`=== ${title} ===`);
    if (Array.isArray(arr) && arr.length) arr.forEach(x => lines.push("- " + x));
    else lines.push("- (geen)");
    lines.push("");
  };

  if (result.summary) { lines.push("=== Samenvatting ===", result.summary, ""); }
  if (result.role_profile) { lines.push("=== Gewenst profiel ===", result.role_profile, ""); }

  listSection("Must-have skills", result.must_have_skills);
  listSection("Nice-to-have skills", result.nice_to_have_skills);
  listSection("Traits/competenties om op te screenen", result.traits_to_screen_for);
  listSection("Interviewvragen", result.interview_questions);
  listSection("Red flags / onduidelijkheden", result.red_flags_or_ambiguities);

  return lines.join("\n");
}

function renderMatchResults(title, payload) {
  if (!payload || !payload.success) return "Geen resultaten.";
  const results = payload.results || [];
  const lines = [title, ""];
  if (!results.length) return lines.concat(["(geen matches gevonden)"]).join("\n");

  results.forEach((r, idx) => {
    const scorePct = Math.round((r.score || 0) * 100);
    const overlap = Array.isArray(r.overlap) ? r.overlap.join(", ") : "";
    lines.push(`${idx + 1}. ${r.display} — ${scorePct}% match`);
    if (overlap) lines.push(`   overlap: ${overlap}`);
  });
  return lines.join("\n");
}

// ---- Upload handlers ----
uploadBtn.addEventListener("click", async () => {
  clearAlert(uploadCvStatus);
  uploadResponse.classList.add("hidden");

  const fileInput = document.getElementById("cvFile");
  if (!fileInput.files.length) {
    setAlert(uploadCvStatus, "warning", "Selecteer eerst een CV-bestand.");
    return;
  }

  try {
    setAlert(uploadCvStatus, "info", "Bezig met uploaden…");
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    const data = await fetchJson(`${API_BASE_URL}/cv/upload`, { method: "POST", body: formData });
    setAlert(uploadCvStatus, "success", "CV geüpload. Lijsten worden bijgewerkt.");
    setPre(uploadResponse, data);

    await loadAvailableCvs();
  } catch (err) {
    setAlert(uploadCvStatus, "danger", err.message || "Upload mislukt.");
  }
});

uploadCvClear.addEventListener("click", () => {
  document.getElementById("cvFile").value = "";
  uploadResponse.classList.add("hidden");
  clearAlert(uploadCvStatus);
});

uploadVacBtn.addEventListener("click", async () => {
  clearAlert(uploadVacStatus);
  vacUploadResponse.classList.add("hidden");

  const title = (document.getElementById("vacTitle").value || "").trim();
  const fileInput = document.getElementById("vacFile");
  if (!fileInput.files.length) {
    setAlert(uploadVacStatus, "warning", "Selecteer eerst een vacaturebestand (pdf/docx/txt).");
    return;
  }

  try {
    setAlert(uploadVacStatus, "info", "Bezig met uploaden…");
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    if (title) formData.append("title", title);

    const data = await fetchJson(`${API_BASE_URL}/vacancy/upload`, { method: "POST", body: formData });
    setAlert(uploadVacStatus, "success", "Vacature geüpload. Lijsten worden bijgewerkt.");
    setPre(vacUploadResponse, data);

    await loadAvailableVacancies();
  } catch (err) {
    setAlert(uploadVacStatus, "danger", err.message || "Upload mislukt.");
  }
});

uploadVacTextBtn.addEventListener("click", async () => {
  clearAlert(uploadVacStatus);
  vacUploadResponse.classList.add("hidden");

  const title = (document.getElementById("vacTitle").value || "").trim();
  const text = (document.getElementById("vacText").value || "").trim();
  if (!text) {
    setAlert(uploadVacStatus, "warning", "Plak eerst vacaturetekst.");
    return;
  }

  try {
    setAlert(uploadVacStatus, "info", "Bezig met uploaden…");
    const data = await fetchJson(`${API_BASE_URL}/vacancy/upload_text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, text })
    });

    setAlert(uploadVacStatus, "success", "Vacaturetekst opgeslagen. Lijsten worden bijgewerkt.");
    setPre(vacUploadResponse, data);

    await loadAvailableVacancies();
  } catch (err) {
    setAlert(uploadVacStatus, "danger", err.message || "Upload mislukt.");
  }
});

uploadVacClear.addEventListener("click", () => {
  document.getElementById("vacTitle").value = "";
  document.getElementById("vacFile").value = "";
  document.getElementById("vacText").value = "";
  vacUploadResponse.classList.add("hidden");
  clearAlert(uploadVacStatus);
});

// ---- Evaluate CV ----
evaluateBtn.addEventListener("click", async () => {
  clearAlert(evalStatus);
  evalResponse.classList.add("hidden");
  document.getElementById("ai-eval-card").classList.add("hidden");

  const cvId = evalCvDropdown.value || null;
  const vacancyId = evalVacancyDropdown.value || null;
  const notes = (evalNotes.value || "").trim();

  if (!cvId) { setAlert(evalStatus, "warning", "Selecteer een CV."); return; }
  if (!vacancyId) { setAlert(evalStatus, "warning", "Selecteer een vacature."); return; }

  try {
    setAlert(evalStatus, "info", "Bezig met beoordelen…");
    const data = await fetchJson(`${API_BASE_URL}/cv/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cv_id: cvId, vacancy_id: vacancyId, notes })
    });

    renderAiEvaluation(data.result);
    setPre(evalResponse, data);
    setAlert(evalStatus, "success", "Beoordeling klaar.");
  } catch (err) {
    setAlert(evalStatus, "danger", err.message || "Beoordeling mislukt.");
  }
});

evaluateClearBtn.addEventListener("click", () => {
  evalNotes.value = "";
  evalResponse.classList.add("hidden");
  document.getElementById("ai-eval-card").classList.add("hidden");
  clearAlert(evalStatus);
});

// ---- Evaluate Vacancy ----
vacEvalBtn.addEventListener("click", async () => {
  clearAlert(vacEvalStatus);
  vacEvalResponse.classList.add("hidden");

  const vacancyId = vacEvalDropdown.value || null;
  const notes = (vacEvalNotes.value || "").trim();

  if (!vacancyId) { setAlert(vacEvalStatus, "warning", "Selecteer een vacature."); return; }

  try {
    setAlert(vacEvalStatus, "info", "Bezig met beoordelen…");
    const data = await fetchJson(`${API_BASE_URL}/vacancy/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vacancy_id: vacancyId, notes })
    });

    if (!data.success) throw new Error(data.error || "Onbekende fout");
    setPre(vacEvalResponse, renderVacancyEvaluation(data.result));
    setAlert(vacEvalStatus, "success", "Beoordeling klaar.");
  } catch (err) {
    setAlert(vacEvalStatus, "danger", err.message || "Beoordeling mislukt.");
  }
});

function renderPrettyMeta(data) {
  let html = "";

  for (const [key, value] of Object.entries(data || {})) {
    if (key === "CV_ID" || key === "ID") continue;

    html += `<div class="profile-block">`;
    html += `<h4>${escapeHtml(key.replace("Json", ""))}</h4>`;

    let content = value;

    if (typeof value === "string" && value.trim().startsWith("{")) {
      try { content = JSON.parse(value); } catch {}
    }

    if (typeof content === "object" && content !== null) {
      html += "<ul>";
      for (const [k, v] of Object.entries(content)) {
        if (v) html += `<li>${escapeHtml(k)}: ${escapeHtml(v)}</li>`;
      }
      html += "</ul>";
    } else {
      html += `<p>${escapeHtml(content || "—")}</p>`;
    }

    html += "</div>";
  }

  return html;
}


// ---- Viewer + Notes ----
async function refreshViewerDropdown() {
  if (viewerType.value === "cv") {
    const cvs = await fetchJson(`${API_BASE_URL}/cv/get_available_cvs`);
    fillGenericDropdown(viewerId, cvs, "CV kiezen…");
  } else {
    const vacancies = await fetchJson(`${API_BASE_URL}/vacancy/get_available_vacancies`);
    fillGenericDropdown(viewerId, vacancies, "Vacature kiezen…");
  }
  viewerDetails.textContent = "Nog niets geselecteerd.";
  viewerNotes.value = "";
  viewerSaveResponse.classList.add("hidden");
}

viewerType.addEventListener("change", async () => {
  clearAlert(viewerStatus);
  try { await refreshViewerDropdown(); }
  catch (err) { setAlert(viewerStatus, "danger", err.message); }
});

viewerId.addEventListener("change", async () => {
  clearAlert(viewerStatus);
  viewerSaveResponse.classList.add("hidden");

  const id = viewerId.value;
  if (!id) return;

  try {
    setAlert(viewerStatus, "info", "Laden…");
    if (viewerType.value === "cv") {
      const data = await fetchJson(`${API_BASE_URL}/cv/get_meta?id=${encodeURIComponent(id)}`);
      if (!data.success) throw new Error(data.error || "CV meta error");
      setPre(viewerDetails, data.result);
      const pretty = document.getElementById("viewer_details_pretty");
      if (pretty) {
        pretty.innerHTML = renderPrettyMeta(data.result);
      }

      viewerNotes.value = data.result.Notities || "";
    } else {
      const data = await fetchJson(`${API_BASE_URL}/vacancy/get_meta?id=${encodeURIComponent(id)}`);
      if (!data.success) throw new Error(data.error || "Vacancy meta error");
      setPre(viewerDetails, data.result);
      const pretty = document.getElementById("viewer_details_pretty");
      if (pretty) {
        pretty.innerHTML = renderPrettyMeta(data.result);
      }
      viewerNotes.value = data.result.Notities || "";
    }
    setAlert(viewerStatus, "success", "Geladen.");
  } catch (err) {
    setAlert(viewerStatus, "danger", err.message);
    viewerDetails.textContent = "Fout bij laden.";
  }
});

viewerSaveBtn.addEventListener("click", async () => {
  clearAlert(viewerStatus);
  viewerSaveResponse.classList.add("hidden");

  const id = viewerId.value;
  if (!id) { setAlert(viewerStatus, "warning", "Selecteer eerst een item."); return; }

  const notities = viewerNotes.value || "";

  try {
    setAlert(viewerStatus, "info", "Opslaan…");
    if (viewerType.value === "cv") {
      const resp = await fetchJson(`${API_BASE_URL}/cv/update_notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv_id: id, notities })
      });
      if (!resp.success) throw new Error(resp.error || "Opslaan mislukt");
    } else {
      const resp = await fetchJson(`${API_BASE_URL}/vacancy/update_notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vacancy_id: id, notities })
      });
      if (!resp.success) throw new Error(resp.error || "Opslaan mislukt");
    }

    setPre(viewerSaveResponse, "Opgeslagen ✅");
    setAlert(viewerStatus, "success", "Notities opgeslagen.");
    viewerId.dispatchEvent(new Event("change"));
  } catch (err) {
    setAlert(viewerStatus, "danger", err.message || "Opslaan mislukt.");
  }
});

// ---- Matching ----
matchVacancyBtn.addEventListener("click", async () => {
  const vacancyId = matchVacancyDropdown.value;
  if (!vacancyId) return alert("Selecteer eerst een vacature.");

  matchVacancyResults.textContent = "Matching…";
  try {
    const data = await fetchJson(`${API_BASE_URL}/match/cvs_for_vacancy?vacancy_id=${encodeURIComponent(vacancyId)}&limit=20`);
    matchVacancyResults.textContent = renderMatchResults("CV matches", data);
  } catch (err) {
    matchVacancyResults.textContent = "Fout: " + (err.message || err);
  }
});

matchCvBtn.addEventListener("click", async () => {
  const cvId = matchCvDropdown.value;
  if (!cvId) return alert("Selecteer eerst een CV.");

  matchCvResults.textContent = "Matching…";
  try {
    const data = await fetchJson(`${API_BASE_URL}/match/vacancies_for_cv?cv_id=${encodeURIComponent(cvId)}&limit=20`);
    matchCvResults.textContent = renderMatchResults("Vacature matches", data);
  } catch (err) {
    matchCvResults.textContent = "Fout: " + (err.message || err);
  }
});

// ---- init ----
(async function init() {
  try {
    await loadAvailableCvs();
    await loadAvailableVacancies();
    await refreshViewerDropdown();
  } catch (err) {
    console.error(err);
  }
})();
