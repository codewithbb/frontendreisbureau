// /assets/js/cv/profielen.js
// const API_BASE_URL = "https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net";
// const API_BASE_URL = "http://127.0.0.1:5001"

const dropdownCVs = document.getElementById("available_cvs");
const refreshCvsBtn = document.getElementById("refreshCvsBtn");

const profileElementsContainer = document.getElementById("profile_elements_container");
const generateProfileBtn = document.getElementById("generateProfile");
const saveProfileBtn = document.getElementById("saveProfile");
const profileNameEl = document.getElementById("profile_name");

const profilePreview = document.getElementById("profilePreview");
const profileResponse = document.getElementById("profileResponse");
const profileStatus = document.getElementById("profileStatus");

// viewer side
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

function setAlert(el, type, msg) {
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove("hidden");
}
function clearAlert(el) {
  el.className = "alert hidden";
  el.textContent = "";
}
function setPre(el, objOrText) {
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
  selectEl.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
  items.forEach(item => {
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

// ====== Profile elements checklist (base list) ======
async function loadProfileElementsAsChecklistBase() {
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

// ====== When CV chosen: show sub-fields (your DL logic) ======
function getSelectedProfileElements() {
  const checked = Array.from(
    document.querySelectorAll('#profile_elements_container input[type="checkbox"]:checked')
  );
  return checked.map(cb => cb.value);
}

dropdownCVs.addEventListener("change", async () => {
  const cvId = dropdownCVs.value;
  if (!cvId) return;

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

            // verberg lege waarden volledig
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

// ====== Load CV lists ======
async function loadCvs() {
  const cvs = await fetchJson(`${API_BASE_URL}/cv/get_available_cvs`);
  fillGenericDropdown(dropdownCVs, cvs, "CV kiezen…");
  fillGenericDropdown(viewerCv, cvs, "CV kiezen…");
}

refreshCvsBtn.addEventListener("click", loadCvs);

// ====== Generate profile (preview) ======
function formatProfileOutput(data) {
  let html = "";
  for (const [key, value] of Object.entries(data)) {
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

generateProfileBtn.addEventListener("click", async () => {
  clearAlert(profileStatus);
  const cvId = dropdownCVs.value || null;
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
    profilePreview.innerHTML = formatProfileOutput(data);
    setPre(profileResponse, data);
    setAlert(profileStatus, "success", "Preview gegenereerd. Je kunt nu opslaan.");

  } catch (err) {
    setAlert(profileStatus, "danger", err.message || "Genereren mislukt.");
  }
});

// ====== Save profile ======
saveProfileBtn.addEventListener("click", async () => {
  clearAlert(profileStatus);

  const cvId = dropdownCVs.value || null;
  const selected = getSelectedProfileElements();
  const name = (profileNameEl.value || "").trim();

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

    setAlert(profileStatus, "success", `Opgeslagen ✅ (ID: ${data.output})`);

    // refresh profile viewer list if same CV selected
    if (viewerCv.value === cvId) {
      await createDropDownProfiles();
    }
  } catch (err) {
    setAlert(profileStatus, "danger", err.message || "Opslaan mislukt.");
  }
});

// ====== Profiles viewer + share ======
async function createDropDownProfiles() {
  const selectedValue = viewerCv.value;
  profilesDropdown.innerHTML = '<option value="" disabled selected>Selecteer profiel…</option>';

  const profiles = await fetchJson(`${API_BASE_URL}/profile_viewer/get_profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ CV_ID: selectedValue })
  });

  profiles.forEach(profile => {
    const option = document.createElement("option");
    option.value = profile.ID;
    option.textContent = `${profile.ID} — ${profile.naam}`;
    profilesDropdown.appendChild(option);
  });
}

viewerCv.addEventListener("change", async () => {
  clearAlert(viewerStatusProfiles);
  profileView.innerHTML = `<p class="muted">Selecteer een profiel.</p>`;
  setPre(responseBox, "Nog geen response");
  shareBox.innerHTML = `<p class="muted">Klik op “Delen” om een link te genereren.</p>`;
  responseBox2.classList.add("hidden");
  try {
    await createDropDownProfiles();
  } catch (err) {
    setAlert(viewerStatusProfiles, "danger", err.message || "Fout bij laden profielen.");
  }
});

BtnViewProfile.addEventListener("click", async () => {
  clearAlert(viewerStatusProfiles);
  const profileId = profilesDropdown.value;
  if (!profileId) { setAlert(viewerStatusProfiles, "warning", "Selecteer eerst een profiel."); return; }

  try {
    setAlert(viewerStatusProfiles, "info", "Laden…");
    const data = await fetchJson(`${API_BASE_URL}/profile_viewer/view_profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: profileId })
    });

    profileView.innerHTML = formatProfileOutput(data);
    setPre(responseBox, data);
    setAlert(viewerStatusProfiles, "success", "Profiel geladen.");
  } catch (err) {
    setAlert(viewerStatusProfiles, "danger", err.message || "Fout bij laden profiel.");
  }
});

BtnDelen.addEventListener("click", async () => {
  clearAlert(viewerStatusProfiles);
  const profileId = profilesDropdown.value;
  if (!profileId) { setAlert(viewerStatusProfiles, "warning", "Selecteer eerst een profiel."); return; }

  try {
    setAlert(viewerStatusProfiles, "info", "Link genereren…");
    const data = await fetchJson(`${API_BASE_URL}/profile_viewer/share_profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: profileId })
    });

    const fullUrl = `${API_BASE_URL}${data.share_url}`;
    shareBox.innerHTML = `
      <div class="share-row">
        <a href="${fullUrl}" target="_blank" rel="noopener">${fullUrl}</a>
        <button class="btn btn-ghost" id="copyShareLink">Kopieer</button>
      </div>
    `;
    document.getElementById("copyShareLink").addEventListener("click", async () => {
      await navigator.clipboard.writeText(fullUrl);
      setAlert(viewerStatusProfiles, "success", "Link gekopieerd.");
    });

    responseBox2.classList.remove("hidden");
    responseBox2.textContent = fullUrl;

    setAlert(viewerStatusProfiles, "success", "Deellink aangemaakt.");
  } catch (err) {
    setAlert(viewerStatusProfiles, "danger", err.message || "Fout bij delen.");
  }
});

// init
(async function init() {
  try {
    await loadCvs();
    await loadProfileElementsAsChecklistBase();
  } catch (err) {
    console.error(err);
  }
})();