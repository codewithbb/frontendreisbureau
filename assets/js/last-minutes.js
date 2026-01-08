
let globalData = [];

(function () {
  const API_BASE     = "https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net/";
  const imgEl        = document.getElementById("genImg");
  const statusEl     = document.getElementById("status");
  const btnGen       = document.getElementById("boek_btn");
  const btnRenew     = document.getElementById("renew_btn");

  // ✨ Bronvelden waar we de prompt uit samenstellen
  const arrivalEl    = document.getElementById("arrivalAt"); // "Aankomst op"
  const activityEl   = document.getElementById("activity");   // "Wat ga je doen op vakantie?"

  let state = {
    blob_name: null,
    container: null,
    expires_utc: null,
    prompt: null
  };

  async function fetchJson(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      credentials: "include"
    });
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const body = isJson ? await res.json() : await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${isJson ? JSON.stringify(body) : body}`);
    }
    return body;
  }

  async function loadLatest() {
    if (!statusEl || !imgEl) return;
    statusEl.textContent = "Laden van laatste afbeelding...";
    try {
      const data = await fetchJson(`${API_BASE}/images/latest`);
      if (data.error) {
        statusEl.textContent = "Nog geen afbeelding beschikbaar.";
        return;
      }
      imgEl.src = data.image_url;
      imgEl.alt = `Gegenereerde afbeelding: ${data.prompt || ""}`;
      state.blob_name  = data.blob_name;
      state.container  = data.container;
      state.expires_utc= data.expires_utc;
      state.prompt     = data.prompt || null;
      statusEl.textContent = `Afbeelding geladen (vervalt: ${state.expires_utc})`;
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Fout bij laden van laatste afbeelding.";
    }
  }

  // ✨ Bouw een nette NL-prompt uit "Aankomst op" + "Activiteit"
  function buildPrompt(arrivalValue, activityValue) {
    const plaats = (arrivalValue || "").trim();
    const activiteit = (activityValue || "").trim();

    if (!plaats) {
      throw new Error("Kies eerst ‘Aankomst op’ (bestemming).");
    }

    if (activiteit) {
      return `Genereer een fotorealistische impressie van ${activiteit} in ${plaats}. ` +
             `Gebruik een moderne reisbrochure-stijl en levendige, uitnodigende kleuren.`;
    }

    return `Genereer een fotorealistische impressie van een vakantie in ${plaats}, ` +
           `in een moderne reisbrochure-stijl met levendige, uitnodigende kleuren.`;
  }

  async function generateImage(prompt) {
    if (statusEl) statusEl.textContent = "Afbeelding genereren...";
    const data = await fetchJson(`${API_BASE}/images/generate`, {
      method: "POST",
      body: JSON.stringify({ prompt })
    });
    if (imgEl) {
      imgEl.src = data.image_url;
      imgEl.alt = `Gegenereerde afbeelding: ${prompt}`;
    }
    state.blob_name   = data.blob_name;
    state.container   = data.container;
    state.expires_utc = data.expires_utc;
    state.prompt      = prompt;
    if (statusEl) statusEl.textContent = `Klaar ✓ (vervalt: ${state.expires_utc})`;
  }

  async function renewSas() {
    if (!state.blob_name) {
      alert("Nog geen afbeelding gegenereerd.");
      return;
    }
    if (statusEl) statusEl.textContent = "SAS vernieuwen...";
    const data = await fetchJson(`${API_BASE}/images/renew`, {
      method: "POST",
      body: JSON.stringify({ blob_name: state.blob_name, container: state.container })
    });
    if (imgEl) imgEl.src = data.image_url;
    state.expires_utc = data.expires_utc;
    if (statusEl) statusEl.textContent = `SAS vernieuwd ✓ (vervalt: ${state.expires_utc})`;
  }

  // Init
  loadLatest();

  // Events
  if (btnGen) {
    btnGen.addEventListener("click", async () => {
      try {
        const arrivalValue  = arrivalEl ? arrivalEl.value : "";
        const activityValue = activityEl ? activityEl.value : "";
        const prompt = buildPrompt(arrivalValue, activityValue);
        await generateImage(prompt);
      } catch (err) {
        console.error(err);
        alert(err.message || "Er ging iets mis bij het genereren.");
        if (statusEl) statusEl.textContent = "Fout bij genereren.";
      }
    });
  }

  if (btnRenew) {
    btnRenew.addEventListener("click", async () => {
      try {
        await renewSas();
      } catch (err) {
        console.error(err);
        if (statusEl) statusEl.textContent = "Fout bij SAS vernieuwen.";
      }
    });
  }
})();

// ==== (BB) Tabel/filters utilities blijven zoals je ze had ====
function renderTable(data, columns) {
  const tableContainer = document.getElementById("tableContainer");
  if (!data || data.length === 0) {
    tableContainer.innerHTML = '<div class="alert" style="margin:0;">Geen resultaten voor de gekozen filters.</div>';
    return;
  }
  const table = document.createElement('table');
  table.classList.add("table");

  const headerRow = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  data.forEach(row => {
    const tr = document.createElement('tr');
    columns.forEach(col => {
      const td = document.createElement('td');
      td.textContent = row[col];
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  tableContainer.innerHTML = '';
  tableContainer.appendChild(table);
}

function getSelectedFilters() {
  return {
    bestemming:   document.getElementById('bestemmingFilter').value,
    vertrekdatum: document.getElementById('vertrekdatumFilter').value,
    personen:     document.getElementById('personenFilter').value
  }
}

function filterByBestemming(data, bestemming){
  return bestemming === 'all' ? data : data.filter(item => item.bestemmingsland === bestemming);
}
function filterByVertrekdatum(data, vertrekdatum) {
  return vertrekdatum === 'all' ? data : data.filter(item => item.vertrekdatum === vertrekdatum);
}
function filterByPersonen(data, personen) {
  if (personen === 'all') return data;
  const aantal = parseInt(personen);
  return data.filter(item => item.aantal_beschikbare_plekken >= aantal);
}
function applyFilter(columns) {
  const { bestemming, vertrekdatum, personen } = getSelectedFilters();
  let filtered = globalData;
  filtered = filterByBestemming(filtered, bestemming);
  filtered = filterByVertrekdatum(filtered, vertrekdatum);
  filtered = filterByPersonen(filtered, personen);
  renderTable(filtered, columns);
}
async function fetchData(url) {
  const response = await fetch(url);
  return await response.json();
}
function getUniqueSortedValues(data, key) {
  return [...new Set(data.map(item => item[key]))].filter(Boolean).sort();
}
function populateDropdown(selectId, items, defaultText) {
  const select = document.getElementById(selectId);
  select.innerHTML = '';
  select.appendChild(createOption('all', defaultText));
  items.forEach(item => select.appendChild(createOption(item, item)));
}
function createOption(value, text) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = text;
  return option;
}
function addFilterListeners(columns) {
  ['bestemmingFilter', 'vertrekdatumFilter', 'personenFilter'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => applyFilter(columns));
  });
}
async function init() {
  try {
    const response = await fetch('https://ack2511-reisbureau-fdghe5emesfrbza5.swedencentral-01.azurewebsites.net/bente');
    const jsonData = await response.json();
    const columns = jsonData.columns;
    globalData = jsonData.rows;

    populateDropdown('bestemmingFilter', getUniqueSortedValues(globalData, 'bestemmingsland'), 'Alle bestemmingen');
    populateDropdown('vertrekdatumFilter', getUniqueSortedValues(globalData, 'vertrekdatum'), 'Alle datums');

    renderTable(globalData, columns);
    addFilterListeners(columns);
  } catch (err) {
    console.error(err);
    document.getElementById('tableContainer').innerHTML =
      '<div class="alert alert-danger" style="margin:0;">Fout bij het ophalen van data. Probeer opnieuw.</div>';

  }
}
init();