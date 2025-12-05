let globalData = [];


(function () {
  const API_BASE = "http://127.0.0.1:5001";
  const imgEl = document.getElementById("genImg");
  const statusEl = document.getElementById("status");
  const btnGen = document.getElementById("btnGen");
  const promptInput = document.getElementById("prompt");

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
    statusEl.textContent = "Laden van laatste afbeelding...";
    try {
      const data = await fetchJson(`${API_BASE}/images/latest`);
      if (data.error) {
        statusEl.textContent = "Nog geen afbeelding beschikbaar.";
        return;
      }
      imgEl.src = data.image_url;
      imgEl.alt = `Gegenereerde afbeelding: ${data.prompt || ""}`;
      state.blob_name = data.blob_name;
      state.container = data.container;
      state.expires_utc = data.expires_utc;
      state.prompt = data.prompt || null;
      statusEl.textContent = `Afbeelding geladen (vervalt: ${state.expires_utc})`;
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Fout bij laden van laatste afbeelding.";
    }
  }

  async function generateImage(prompt) {
    statusEl.textContent = "Afbeelding genereren...";
    const data = await fetchJson(`${API_BASE}/images/generate`, {
      method: "POST",
      body: JSON.stringify({ prompt })
    });
    imgEl.src = data.image_url;
    imgEl.alt = `Gegenereerde afbeelding: ${prompt}`;
    state.blob_name = data.blob_name;
    state.container = data.container;
    state.expires_utc = data.expires_utc;
    state.prompt = prompt;
    statusEl.textContent = `Klaar ✔️ (vervalt: ${state.expires_utc})`;
  }

  async function renewSas() {
    if (!state.blob_name) {
      alert("Nog geen afbeelding gegenereerd.");
      return;
    }
    statusEl.textContent = "SAS vernieuwen...";
    const data = await fetchJson(`${API_BASE}/images/renew`, {
      method: "POST",
      body: JSON.stringify({ blob_name: state.blob_name, container: state.container })
    });
    imgEl.src = data.image_url;
    state.expires_utc = data.expires_utc;
    statusEl.textContent = `SAS vernieuwd ✔️ (vervalt: ${state.expires_utc})`;
  }

  // Init
  loadLatest();

  // Events
  btnGen.addEventListener("click", async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      alert("Voer een prompt in.");
      return;
    }
    try {
      await generateImage(prompt);
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Fout bij genereren.";
    }
  });

  btnRenew.addEventListener("click", async () => {
    try {
      await renewSas();
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Fout bij SAS vernieuwen.";
    }
  });
})();





// (BB) Functie die een HTML-tabel maakt uit JSON-data
function renderTable(data, columns) {
    const tableContainer = document.getElementById("tableContainer");

    if (!data || data.length === 0) {
        tableContainer.innerHTML = '<p>Geen data gevonden.</p>';
        return;
    }

    const table = document.createElement('table');

    // (BB) Header
    const headerRow = document.createElement('tr');
    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // (BB) Data rows
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
        bestemming: document.getElementById('bestemmingFilter').value,
        vertrekdatum: document.getElementById('vertrekdatumFilter').value,
        personen: document.getElementById('personenFilter').value
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
    
// (BB) vult een dropdown met opties
function populateDropdown(selectId, items, defaultText) {
    const select = document.getElementById(selectId);
    select.innerHTML = '';
    
    // (BB) voeg een default toe bijvoorbeeld "alle bestemmingen"
    select.appendChild(createOption('all', defaultText));

    // (BB) voeg alle unieke items toe als opties
    items.forEach(item => select.appendChild(createOption(item, item)));
}

function createOption(value, text) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    return option;
}

// (BB) voegt event listeners toe aan alle filter dropdowns, zodadt de tabel opnieuw gefilterd wordt bij een wijziging
function addFilterListeners(columns) {
    ['bestemmingFilter', 'vertrekdatumFilter', 'personenFilter'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => applyFilter(columns));
    });
}

// (BB) haalt data op, vult de dropdowns en toont de tabel
async function init() {
    try {
        const response = await fetch('http://127.0.0.1:5001/bente');
        const jsonData = await response.json();

        const columns = jsonData.columns;
        globalData = jsonData.rows;

        // (BB) Dropdowns vullen
        populateDropdown('bestemmingFilter', getUniqueSortedValues(globalData, 'bestemmingsland'), 'Alle bestemmingen');
        populateDropdown('vertrekdatumFilter', getUniqueSortedValues(globalData, 'vertrekdatum'), 'Alle datums');

        // (BB) Tabel renderen met juiste kolomvolgorde
        renderTable(globalData, columns);

        addFilterListeners(columns);
    } catch (err) {
        console.error(err);
        document.getElementById('tableContainer').innerHTML = '<p>Fout bij ophalen data.</p>';
    }
}

init();