let globalData = [];

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