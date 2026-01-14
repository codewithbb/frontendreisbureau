// /assets/js/cv/profielen.js
const API_BASE_URL = "https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net";

// ---- DOM (builder page: cv_reader_new.html) ----
const dropdownCVs = document.getElementById("available_cvs");
const refreshCvsBtn = document.getElementById("refreshCvsBtn");
const profileElementsContainer = document.getElementById("profile_elements_container");
const generateProfileBtn = document.getElementById("generateProfile");
const saveProfileBtn = document.getElementById("saveProfile");
const profileNameEl = document.getElementById("profile_name");
const profilePreview = document.getElementById("profilePreview");
const profileResponse = document.getElementById("profileResponse");
const profileStatus = document.getElementById("profileStatus");

// ---- DOM (viewer page: profile_viewer_new.html) ----
const viewerCv = document.getElementById("viewer_cv");
const profilesDropdown = document.getElementById("profiles");
const BtnViewProfile = document.getElementById("BtnViewProfile");
const BtnDelen = document.getElementById("BtnDelen");
const responseBox = document.getElementById("responseBox");
const responseBox2 = document.getElementById("responseBox2");
const profileView = document.getElementById("profileView");
const shareBox = document.getElementById("shareBox");
const viewerStatusProfiles = document.getElementById("viewerStatus");

let lastGeneratedProfile = null;

// ---- helpers ----
function setAlert(el, type, msg) {
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove("hidden");
}
function clearAlert(el) {
  if (!el) return;
  el.className = "alert hidden";
  el.textContent = "";
}
function setPre(el, objOrText) {
  if (!el) return;
  el.textContent = typeof objOrText === "string" ? objOrText : JSON.stringify(objOrText, null, 2);
}

async function fetchJson(url, options = {}) {
  const resp = await fetch(url, options);
  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!resp.ok) {
    const msg = (data && (data.error || data.message)) ? (data.error || data.message) : text;
    throw new Error(msg || `HTTP ${resp.status}`);
  }
  return data;
}

function fillGenericDropdown(selectEl, items, placeholder) {
  if (!selectEl) return;
  selectEl.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
  (items || []).forEach(item => {
    const option = document.createElement("option");
    option.value = item.ID;
    const label = item.FileName
      ? `${item.ID} — ${item.FileName}`
      : (item.DisplayName ? `${item.ID} — ${item.DisplayName}` : String(item.ID));
    option.textContent = label;
    selectEl.appendChild(option);
  });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---- renderer (builder preview) ----
function formatProfileOutput(data) {
  let html = "";
  for (const [key, value] of Object.entries(data || {})) {
    if (key === "CV_ID") continue;

    html += `<div class="profile-block">`;
    html += `<h4>${escapeHtml(key.replace("Json", ""))}</h4>`;

    let content = value;
    if (typeof value === "string" && (value.trim().startsWith("{") || value.trim().startsWith("["))) {
      try { content = JSON.parse(value); } catch { content = value; }
    }

    if (typeof content === "object" && content !== null) {
      html += `<ul>`;
      for (const [subKey, subValue] of Object.entries(content)) {
        if (subValue) html += `<li>${escapeHtml(subKey)}: ${escapeHtml(subValue)}</li>`;
      }
      html += `</ul>`;
    } else {
      html += `<p>${escapeHtml(content || "Geen gegevens beschikbaar")}</p>`;
    }
    html += `</div>`;
  }
  return html;
}

// ---- renderer (viewer: JSON info -> HTML) ----
function formatInfoAsProfileHtml(infoObj) {
  if (!infoObj || typeof infoObj !== "object") return "";

  const entries = Object.entries(infoObj)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "");

  // naam bovenaan als aanwezig
  entries.sort(([a], [b]) => (a === "VolledigeNaam" ? -1 : b === "VolledigeNaam" ? 1 : 0));

  const rows = entries.map(([k, v]) => `<li><strong>${escapeHtml(k)}</strong>: ${escapeHtml(v)}</li>`).join("");
  return `<div class="profile-block"><h4>Profiel</h4><ul>${rows}</ul></div>`;
}

// ====== Load CV lists (for both pages) ======
async function loadCvs() {
  const cvs = await fetchJson(`${API_BASE_URL}/cv/get_available_cvs`);
  fillGenericDropdown(dropdownCVs, cvs, "CV kiezen…");
  fillGenericDropdown(viewerCv, cvs, "CV kiezen…");
}
window.CVTool = window.CVTool || {};
window.CVTool.loadCvs = loadCvs;

if (refreshCvsBtn) refreshCvsBtn.addEventListener("click", loadCvs);

// ====== Builder: load base checklist ======
async function loadProfileElementsAsChecklistBase() {
  if (!profileElementsContainer) return;

  profileElementsContainer.innerHTML = "";
  const profileElements = await fetchJson(`${API_BASE_URL}/cv/get_profile_elements`);

  if (!Array.isArray(profileElements) || profileElements.length === 0) {
    profileElementsContainer.innerHTML = "<em>Geen profiel elementen gevonden.</em>";
    return;
  }

  profileElements.forEach(pe => {
    const row = document.createElement("div");
    row.className = "checklist-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `profile_element_${pe.ID}`;
    checkbox.value = pe.element;
    checkbox.name = "profile_elements";

    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.className = "checklist-label";
    label.textContent = pe.element;

    row.appendChild(checkbox);
    row.appendChild(label);
    profileElementsContainer.appendChild(row);
  });
}

function getSelectedProfileElements() {
  if (!profileElementsContainer) return [];
  const checked = Array.from(
    document.querySelectorAll('#profile_elements_container input[type="checkbox"]:checked')
  );
  return checked.map(cb => cb.value);
}

// Builder: when CV chosen -> show sub-fields
if (dropdownCVs) {
  dropdownCVs.addEventListener("change", async () => {
    const cvId = dropdownCVs.value;
    if (!cvId || !profileElementsContainer) return;

    profileElementsContainer.innerHTML = "<em>Laden van velden…</em>";

    try {
      const data = await fetchJson(`${API_BASE_URL}/cv/get_meta?id=${encodeURIComponent(cvId)}`);
      const meta = data.result;

      profileElementsContainer.innerHTML = "";

      const addGroup = (title, jsonStr, columnName) => {
        try {
          const obj = JSON.parse(jsonStr);
          if (Object.keys(obj).length > 0) {
            const header = document.createElement("div");
            header.className = "checklist-group-title";
            header.textContent = title;
            profileElementsContainer.appendChild(header);

            for (const key in obj) {
              const value = obj[key];
              if (!value || String(value).trim() === "") continue;

              const preview = `${key}: ${value}`;
              const row = document.createElement("div");
              row.className = "checklist-item";
              row.innerHTML = `
                <input type="checkbox" id="${columnName}_${key}" value="${columnName}.${key}" name="profile_elements">
                <label for="${columnName}_${key}" class="checklist-label">${escapeHtml(preview)}</label>
              `;
              profileElementsContainer.appendChild(row);
            }
          }
        } catch {}
      };

      addGroup("Persoonlijke gegevens", meta.PersoonlijkJson, "PersoonlijkJson");
      addGroup("Opleidingen", meta.OpleidingenJson, "OpleidingenJson");
      addGroup("Werkervaring", meta.WerkervaringJson, "WerkervaringJson");
      addGroup("Vaardigheden", meta.VaardighedenJson, "VaardighedenJson");
      addGroup("Certificeringen", meta.CertificeringenJson, "CertificeringenJson");
      addGroup("Extra zaken", meta.ExtraZakenJson, "ExtraZakenJson");

      if (meta.Beschrijving) {
        const desc = String(meta.Beschrijving).trim();
        const preview = desc.length > 160 ? desc.slice(0, 160) + "..." : desc;

        const row = document.createElement("div");
        row.className = "checklist-item";
        row.innerHTML = `
          <input type="checkbox" id="desc" value="Beschrijving" name="profile_elements">
          <label for="desc" class="checklist-label">Beschrijving: ${escapeHtml(preview)}</label>
        `;
        profileElementsContainer.appendChild(row);
      }
    } catch (err) {
      profileElementsContainer.innerHTML = "<em>Fout bij laden velden.</em>";
    }
  });
}

// Builder: Generate profile
if (generateProfileBtn) {
  generateProfileBtn.addEventListener("click", async () => {
    clearAlert(profileStatus);

    const cvId = dropdownCVs ? (dropdownCVs.value || null) : null;
    const selected = getSelectedProfileElements();

    if (!cvId) { setAlert(profileStatus, "warning", "Selecteer eerst een CV."); return; }
    if (!selected.length) { setAlert(profileStatus, "warning", "Selecteer minimaal één profielonderdeel."); return; }

    try {
      setAlert(profileStatus, "info", "Bezig met genereren…");
      const data = await fetchJson(`${API_BASE_URL}/cv/generate_profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ CV_ID: cvId, selected_elements: selected })
      });

      lastGeneratedProfile = data;
      if (profilePreview) profilePreview.innerHTML = formatProfileOutput(data);
      setPre(profileResponse, data);
      setAlert(profileStatus, "success", "Preview gegenereerd. Je kunt nu opslaan.");
    } catch (err) {
      setAlert(profileStatus, "danger", err.message || "Genereren mislukt.");
    }
  });
}

// Builder: Save profile
if (saveProfileBtn) {
  saveProfileBtn.addEventListener("click", async () => {
    clearAlert(profileStatus);

    const cvId = dropdownCVs ? (dropdownCVs.value || null) : null;
    const selected = getSelectedProfileElements();
    const name = profileNameEl ? profileNameEl.value.trim() : "";

    if (!cvId) { setAlert(profileStatus, "warning", "Selecteer eerst een CV."); return; }
    if (!selected.length) { setAlert(profileStatus, "warning", "Selecteer minimaal één profielonderdeel."); return; }
    if (!name) { setAlert(profileStatus, "warning", "Geef een profielnaam."); return; }

    try {
      setAlert(profileStatus, "info", "Opslaan…");
      const data = await fetchJson(`${API_BASE_URL}/cv/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ CV_ID: cvId, selected_elements: selected, profile_name: name })
      });

      setAlert(profileStatus, "success", `Opgeslagen (ID: ${data.output})`);

      // refresh viewer list only when viewer exists and has same CV selected
      if (viewerCv && profilesDropdown && viewerCv.value === cvId) {
        await createDropDownProfiles();
      }
    } catch (err) {
      setAlert(profileStatus, "danger", err.message || "Opslaan mislukt.");
    }
  });
}

// ====== Viewer: load profiles dropdown ======
async function createDropDownProfiles() {
  if (!viewerCv || !profilesDropdown) return;

  const selectedValue = viewerCv.value;
  profilesDropdown.innerHTML = '<option value="" disabled selected>Selecteer profiel…</option>';

  if (!selectedValue) return;

  const profiles = await fetchJson(`${API_BASE_URL}/profile_viewer/get_profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ CV_ID: selectedValue })
  });

  (profiles || []).forEach(profile => {
    const option = document.createElement("option");
    option.value = profile.ID;
    option.textContent = `${profile.ID} — ${profile.naam}`;
    profilesDropdown.appendChild(option);
  });
}

// Viewer: when CV changes -> refresh profiles list
if (viewerCv) {
  viewerCv.addEventListener("change", async () => {
    clearAlert(viewerStatusProfiles);

    if (profileView) {
      profileView.innerHTML = `<p class="muted">Selecteer een profiel.</p>`;
    }
    setPre(responseBox, "Nog geen response");
    if (shareBox) {
      shareBox.innerHTML = `<p class="muted">Klik op “Delen” om een link te genereren.</p>`;
    }
    if (responseBox2) responseBox2.classList.add("hidden");

    try {
      await createDropDownProfiles();
    } catch (err) {
      setAlert(viewerStatusProfiles, "danger", err.message || "Fout bij laden profielen.");
    }
  });
}

// Viewer: view profile
if (BtnViewProfile) {
  BtnViewProfile.addEventListener("click", async () => {
    clearAlert(viewerStatusProfiles);

    const profileId = profilesDropdown ? profilesDropdown.value : "";
    if (!profileId) {
      setAlert(viewerStatusProfiles, "warning", "Selecteer eerst een profiel.");
      return;
    }

    try {
      setAlert(viewerStatusProfiles, "info", "Laden…");

      const data = await fetchJson(`${API_BASE_URL}/profile_viewer/view_profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId })
      });

      setPre(responseBox, data); // debug blijft verborgen in HTML

      const result = data?.result ?? data ?? {};
      lastGeneratedProfile = result;

      // Sommige backends geven tekst, jouw backend geeft info-json
      const text =
        result?.profile_text ??
        result?.profileText ??
        result?.profile_html ??
        result?.profileHtml ??
        result?.text ??
        "";

      const infoHtml = result?.info ? formatInfoAsProfileHtml(result.info) : "";

      if (profileView) {
        profileView.innerHTML = text || infoHtml || "<em>Geen inhoud</em>";
      }

      setAlert(viewerStatusProfiles, "success", "Profiel geladen.");
    } catch (err) {
      setAlert(viewerStatusProfiles, "danger", err.message || "Fout bij laden profiel.");
    }
  });
}

// Viewer: share profile
if (BtnDelen) {
  BtnDelen.addEventListener("click", async () => {
    clearAlert(viewerStatusProfiles);

    const profileId = profilesDropdown ? profilesDropdown.value : "";
    if (!profileId) {
      setAlert(viewerStatusProfiles, "warning", "Selecteer eerst een profiel.");
      return;
    }

    try {
      setAlert(viewerStatusProfiles, "info", "Link genereren…");

      const data = await fetchJson(`${API_BASE_URL}/profile_viewer/share_profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId })
      });

      // support meerdere response structuren
      const result = data?.result ?? data ?? {};
let url = result?.share_url ?? result?.shareUrl ?? "";
if (!url) throw new Error("Geen share_url ontvangen van backend.");

// als backend een relatief pad teruggeeft: maak hem absoluut naar de API host
if (url.startsWith("/")) {
  url = `${API_BASE_URL}${url}`;
}


      if (!url) throw new Error("Geen share_url ontvangen van backend.");

      if (shareBox) {
        shareBox.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      }
      setAlert(viewerStatusProfiles, "success", "Deellink aangemaakt.");
    } catch (err) {
      setAlert(viewerStatusProfiles, "danger", err.message || "Fout bij delen.");
    }
  });
}

// ---- init ----
(async function init() {
  try {
    await loadCvs();
    await loadProfileElementsAsChecklistBase(); // doet niks als container ontbreekt
  } catch (err) {
    console.error(err);
  }
})();
