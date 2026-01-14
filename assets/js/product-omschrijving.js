// /assets/js/product-omschrijving.js

// const API_BASE = "http://127.0.0.1:5001";
const API_BASE = "https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net/";

// DOM
const form = document.getElementById("csvForm");
const csvTextEl = document.getElementById("csvText");
const resultDiv = document.getElementById("result");
const spinner = document.getElementById("spinner");
const statusEl = document.getElementById("status");

const clearBtn = document.getElementById("clearBtn");
const generateBtn = document.getElementById("generateBtn");

const critiqueEl = document.getElementById("critique");
const reviseBtn = document.getElementById("reviseBtn");
const reviseSpinner = document.getElementById("revisespinner");

const versionSelect = document.getElementById("versionSelect");
const downloadBtn = document.getElementById("downloadJsonBtn");

// State
let versions = [];     // { label, data }
let productJson = null;
let lastRenderedJson = null; // voor diff-highlighting

function setStatus(type, message) {
  // type: "info" | "success" | "warn" | "error"
  statusEl.className = "alert";
  if (type === "success") statusEl.classList.add("alert-success");
  if (type === "warn") statusEl.classList.add("alert-warning");
  if (type === "error") statusEl.classList.add("alert-danger");
  statusEl.textContent = message;
  statusEl.classList.remove("hidden");
}

function clearStatus() {
  statusEl.textContent = "";
  statusEl.className = "alert hidden";
}

function setLoading(loading) {
  spinner.classList.toggle("hidden", !loading);
  generateBtn.disabled = loading;
  clearBtn.disabled = loading;
  csvTextEl.disabled = loading;
}

function setReviseLoading(loading) {
  reviseSpinner.classList.toggle("hidden", !loading);
  reviseBtn.disabled = loading;
  critiqueEl.disabled = loading;
}

function updateVersionDropdown() {
  versionSelect.innerHTML = '<option value="">— Geen selectie —</option>';
  versions.forEach((v, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = v.label;
    versionSelect.appendChild(opt);
  });
}

// Correcte escaping
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// Verwijder eventuele markdown-codeblokken uit modeloutput
function cleanJsonString(str) {
  return String(str ?? "")
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function normalizeValue(v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v.trim();
  return v;
}

function isDifferent(a, b) {
  return JSON.stringify(normalizeValue(a)) !== JSON.stringify(normalizeValue(b));
}

function section(title, bodyHtml) {
  if (!bodyHtml || bodyHtml.trim() === "") return "";
  return `<h3>${escapeHtml(title)}</h3>${bodyHtml}`;
}

function renderBelangrijksteSpecificaties(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return `<p class="help-text">Geen belangrijkste specificaties ontvangen.</p>`;
  }
  return `<ul>${arr.map(b => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`;
}

function renderAfmetingen(val) {
  if (!val) return "";
  if (typeof val === "object" && !Array.isArray(val)) {
    const fields = [
      ["lengte_mm", "Lengte (mm)"],
      ["breedte_mm", "Breedte (mm)"],
      ["hoogte_mm", "Hoogte (mm)"],
      ["diameter_mm", "Diameter (mm)"],
      ["gewicht_kg", "Gewicht (kg)"],
      ["accu_compatibiliteit", "Accu compatibiliteit"],
      ["verpakking_lengte_mm", "Verpakking lengte (mm)"],
      ["verpakking_breedte_mm", "Verpakking breedte (mm)"],
      ["verpakking_hoogte_mm", "Verpakking hoogte (mm)"],
      ["verpakking_gewicht_kg", "Verpakking gewicht (kg)"]
    ];

    const rows = fields
      .map(([key, label]) => {
        const v = val[key];
        return (v !== undefined && v !== null && String(v).trim() !== "")
          ? `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(v))}</li>`
          : "";
      })
      .filter(Boolean)
      .join("");

    return rows ? `<ul>${rows}</ul>` : `<p class="help-text">Geen afmetingen/compatibiliteit ontvangen.</p>`;
  }

  return `<p>${escapeHtml(String(val))}</p>`;
}

function renderStructured(maybeJson, prevJson = null) {
  let data;

  if (typeof maybeJson === "string") {
    const jsonText = maybeJson;
    try {
      data = JSON.parse(jsonText);
    } catch {
      return `
        <div class="card">
          <h2>Resultaat (ruwe output)</h2>
          <pre class="mono">${escapeHtml(jsonText)}</pre>
        </div>
      `;
    }
  } else {
    data = maybeJson;
  }

  let warningHtml = "";
  if (Array.isArray(data.warning) && data.warning.length > 0) {
    warningHtml = `
      <div class="alert alert-warning" style="margin-bottom:12px;">
        <strong>Let op:</strong> De volgende kolommen zijn niet ingevuld:
        <ul>${data.warning.map(k => `<li>${escapeHtml(k)}</li>`).join("")}</ul>
      </div>
    `;
  }

  const title = data.title ?? "—";
  const intro = data.intro ?? "";

  const prev = prevJson || null;

  const changed = prev ? {
    title: isDifferent(prev.title, data.title),
    intro: isDifferent(prev.intro, data.intro),
    algemene_beschrijving: isDifferent(prev.algemene_beschrijving, data.algemene_beschrijving),
    belangrijkste_specificaties: isDifferent(prev.belangrijkste_specificaties, data.belangrijkste_specificaties),
    afmetingen_en_compatibiliteit: isDifferent(prev.afmetingen_en_compatibiliteit, data.afmetingen_en_compatibiliteit),
    functies: isDifferent(prev.functies, data.functies),
    gebruik: isDifferent(prev.gebruik, data.gebruik),
    onderhoud_en_duurzaamheid: isDifferent(prev.onderhoud_en_duurzaamheid, data.onderhoud_en_duurzaamheid),
    in_de_verpakking: isDifferent(prev.in_de_verpakking, data.in_de_verpakking),
  } : {};


  const belangrijksteSpecificaties = Array.isArray(data.belangrijkste_specificaties)
    ? data.belangrijkste_specificaties
    : [];

  const algemeneBeschrijving = data.algemene_beschrijving ?? "";

  const afmetingenHtml = renderAfmetingen(data.afmetingen_en_compatibiliteit);
  const functiesHtml   = data.functies ? `<p>${escapeHtml(String(data.functies))}</p>` : "";
  const gebruikHtml    = data.gebruik ? `<p>${escapeHtml(String(data.gebruik))}</p>` : "";
  const onderhoudHtml  = data.onderhoud_en_duurzaamheid ? `<p>${escapeHtml(String(data.onderhoud_en_duurzaamheid))}</p>` : "";
  const verpakkingHtml = data.in_de_verpakking ? `<p>${escapeHtml(String(data.in_de_verpakking))}</p>` : "";

  function wrapChanged(isChanged, innerHtml) {
    if (!innerHtml || innerHtml.trim() === "") return "";
    if (!isChanged) return innerHtml;

    return `
      <div class="diff-changed">
        <div class="diff-badge">Gewijzigd</div>
        ${innerHtml}
      </div>
    `;
  }

  return `
    ${warningHtml}
    <div class="card" style="margin:0;">
      ${wrapChanged(changed.title, `<h2>${escapeHtml(title)}</h2>`)}
      ${intro ? wrapChanged(changed.intro, `<p>${escapeHtml(intro)}</p>`) : ""}

      ${section("Algemene beschrijving",
        wrapChanged(
          changed.algemene_beschrijving,
          algemeneBeschrijving ? `<p>${escapeHtml(algemeneBeschrijving)}</p>` : ""
        )
      )}

      ${section("Belangrijkste specificaties",
        wrapChanged(
          changed.belangrijkste_specificaties,
          renderBelangrijksteSpecificaties(belangrijksteSpecificaties)
        )
      )}

      ${section("Afmetingen & compatibiliteit",
        wrapChanged(changed.afmetingen_en_compatibiliteit, afmetingenHtml)
      )}

      ${section("Functies",
        wrapChanged(changed.functies, functiesHtml)
      )}

      ${section("Gebruik",
        wrapChanged(changed.gebruik, gebruikHtml)
      )}

      ${section("Onderhoud & duurzaamheid",
        wrapChanged(changed.onderhoud_en_duurzaamheid, onderhoudHtml)
      )}

      ${section("In de verpakking",
        wrapChanged(changed.in_de_verpakking, verpakkingHtml)
      )}


      <details style="margin-top:.75rem;">
        <summary class="help-text">Ruwe JSON bekijken</summary>
        <pre class="mono">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
      </details>
    </div>
  `;
}

async function postGenerate(csv_text) {
  const res = await fetch(`${API_BASE}/productdescription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csv_text })
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `HTTP ${res.status} ${res.statusText}`);
  return payload;
}

async function postRevise(originalJson, critique) {
  const resp = await fetch(`${API_BASE}/productdescription/revise`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ original_json: originalJson, critique })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || "Onbekende fout");
  return data;
}

function addVersion(label, dataObj) {
  versions.push({ label, data: dataObj });
  updateVersionDropdown();
  // auto-select last
  versionSelect.value = String(versions.length - 1);
}

function setResultEmpty() {
  resultDiv.innerHTML = `<div class="alert" style="margin:0;">Nog geen resultaat. Genereer eerst een omschrijving.</div>`;
}

// Submit handler
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearStatus();

  const csv_text = csvTextEl.value.trim();
  if (!csv_text) {
    setStatus("warn", "Plak eerst je CSV in het veld.");
    return;
  }

  setLoading(true);
  //resultDiv.innerHTML = `<div class="alert" style="margin:0;">Bezig met genereren…</div>`;

  try {
    const payload = await postGenerate(csv_text);

    if (typeof payload.result === "string") {
      const cleaned = cleanJsonString(payload.result);
      try { productJson = JSON.parse(cleaned); } catch { productJson = null; }
      resultDiv.innerHTML = renderStructured(cleaned, null);
      lastRenderedJson = productJson ?? null;

      if (productJson) addVersion("Origineel", productJson);
    } else {
      productJson = payload.result;
      resultDiv.innerHTML = renderStructured(productJson, null);
      lastRenderedJson = productJson;

      if (productJson) addVersion("Origineel", productJson);
    }

    setStatus("success", "Omschrijving gegenereerd. Je kunt nu revisies maken of een versie downloaden.");

  } catch (err) {
    console.error(err);
    resultDiv.innerHTML = `<div class="alert alert-danger" style="margin:0;"><strong>Fout:</strong> ${escapeHtml(err.message)}</div>`;
    setStatus("error", "Genereren mislukt. Controleer je input en probeer opnieuw.");
  } finally {
    setLoading(false);
  }
});

// Revisie
reviseBtn.addEventListener("click", async () => {
  clearStatus();

  const critique = critiqueEl.value.trim();
  if (!critique) return setStatus("warn", "Vul eerst je kritiek in.");
  if (!productJson) return setStatus("warn", "Genereer eerst een productomschrijving.");

  setReviseLoading(true);

  try {
    const prev = productJson; // onthoud vorige versie
    const revised = await postRevise(productJson, critique);
    productJson = revised;

    resultDiv.innerHTML = renderStructured(revised, prev);
    lastRenderedJson = revised;


    const revCount = versions.filter(v => v.label.startsWith("Revisie")).length + 1;
    addVersion(`Revisie ${revCount}`, revised);

    setStatus("success", "Revisie aangemaakt en opgeslagen als nieuwe versie.");

  } catch (err) {
    console.error(err);
    setStatus("error", err.message || "Revisie mislukt.");
  } finally {
    setReviseLoading(false);
  }
});

// Versie wisselen
versionSelect.addEventListener("change", (e) => {
  const index = e.target.value;
  if (index === "") return;

  const chosen = versions[Number(index)];
  if (!chosen) return;

  const prev = lastRenderedJson;
  resultDiv.innerHTML = renderStructured(chosen.data, prev);
  productJson = chosen.data;
  lastRenderedJson = chosen.data;

  setStatus("info", `Versie geladen: ${chosen.label}`);
});

// Download
downloadBtn.addEventListener("click", () => {
  const idx = versionSelect.value;
  if (idx === "") return setStatus("warn", "Selecteer eerst een versie om te downloaden.");

  const chosen = versions[Number(idx)];
  if (!chosen) return setStatus("error", "Ongeldige selectie.");

  const blob = new Blob([JSON.stringify(chosen.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${chosen.label.replace(/\s+/g, "_").toLowerCase()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  setStatus("success", "JSON gedownload.");
});

// Clear
clearBtn.addEventListener("click", () => {
  csvTextEl.value = "";
  critiqueEl.value = "";
  versions = [];
  productJson = null;
  lastRenderedJson = null;
  updateVersionDropdown();
  setResultEmpty();
  clearStatus();
});

// init
document.addEventListener("DOMContentLoaded", () => {
  updateVersionDropdown();
  setResultEmpty();
});