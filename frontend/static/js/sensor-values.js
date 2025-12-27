import { ensureConfigured, showSetupLinks, requireToken, fetchWithAuth } from './shared.js';

const state = {
  token: null,
  sensors: [],
  valuesBySensor: new Map(),
  selectedId: null,
};

const cardsContainer = document.querySelector('#sensorCards');
const alertBox = document.querySelector('#valuesAlert');
const historySection = document.querySelector('#historySection');
const historyTitle = document.querySelector('#historyTitle');
const historyBody = document.querySelector('#historyTableBody');
const sensorFilter = document.querySelector('#sensorFilter');
const onlyAlerts = document.querySelector('#onlyAlerts');
const refreshButton = document.querySelector('#refreshValues');

init();

async function init() {
  const status = await ensureConfigured();
  showSetupLinks(status.setupRequired);
  if (status.setupRequired) return;

  const token = requireToken();
  if (!token) return;
  state.token = token;

  refreshButton.addEventListener('click', loadData);
  sensorFilter.addEventListener('change', () => {
    state.selectedId = sensorFilter.value || null;
    render();
  });
  onlyAlerts.addEventListener('change', render);

  await loadData();
}

async function loadData() {
  try {
    const sensorsRes = await fetchWithAuth('/api/sensors/', { token: state.token });
    if (!sensorsRes.ok) throw new Error('Impossibile caricare i sensori');
    const sensorsPayload = await sensorsRes.json();
    state.sensors = sensorsPayload.items || [];
    if (!state.selectedId && state.sensors.length) {
      state.selectedId = state.sensors[0].id;
    }
    await fetchValues();
    populateSensorFilter();
    render();
  } catch (error) {
    flash(error.message || 'Errore durante il caricamento dei dati', 'danger');
    console.error(error);
  }
}

async function fetchValues() {
  const entries = await Promise.all(
    state.sensors.map(async (sensor) => {
      try {
        const res = await fetchWithAuth(`/api/sensors/${sensor.id}/values?limit=20`, { token: state.token });
        if (!res.ok) throw new Error('Errore');
        const payload = await res.json();
        return [sensor.id, payload.items || []];
      } catch (err) {
        console.error('Errore caricando valori sensore', sensor.id, err);
        return [sensor.id, []];
      }
    }),
  );
  state.valuesBySensor = new Map(entries);
}

function populateSensorFilter() {
  sensorFilter.innerHTML = '<option value="">Tutti i sensori</option>';
  state.sensors.forEach((sensor) => {
    const option = document.createElement('option');
    option.value = sensor.id;
    option.textContent = sensor.name;
    if (sensor.id === state.selectedId) option.selected = true;
    sensorFilter.appendChild(option);
  });
}

function render() {
  cardsContainer.innerHTML = '';
  const onlyAlert = onlyAlerts.checked;

  const sensorsToShow = state.sensors.filter((sensor) => {
    if (sensorFilter.value && sensor.id !== sensorFilter.value) return false;
    if (!onlyAlert) return true;
    const status = getSensorStatus(sensor);
    return status.level !== 'ok';
  });

  if (!sensorsToShow.length) {
    const empty = document.createElement('div');
    empty.className = 'col-12 text-center text-muted py-4';
    empty.textContent = 'Nessun sensore da mostrare.';
    cardsContainer.appendChild(empty);
  } else {
    sensorsToShow.forEach((sensor) => cardsContainer.appendChild(renderCard(sensor)));
  }

  renderHistory();
}

function renderCard(sensor) {
  const items = state.valuesBySensor.get(sensor.id) || [];
  const latest = items[0];
  const status = getSensorStatus(sensor);
  const valueDisplay = latest ? formatValue(latest) : 'N/D';
  const timeDisplay = latest ? formatDate(latest.received_at) : '—';

  const col = document.createElement('div');
  col.className = 'col-12 col-md-6 col-xl-4';
  col.innerHTML = `
    <div class="card h-100 border-0 section-card">
      <div class="card-body d-flex flex-column gap-2">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="text-uppercase text-muted small mb-1">${escapeHtml(sensor.type || 'generico')}</div>
            <h5 class="mb-1">${escapeHtml(sensor.name)}</h5>
            <div class="text-muted small">Topic: <code>${escapeHtml(sensor.topic)}</code></div>
          </div>
          <span class="badge rounded-pill ${status.className}">${status.label}</span>
        </div>
        <div class="fs-4 fw-semibold">${valueDisplay}${sensor.unit ? ` ${escapeHtml(sensor.unit)}` : ''}</div>
        <div class="text-muted small">Aggiornato: ${timeDisplay}</div>
        <div class="small text-muted">Soglia: ${sensor.threshold ?? 'N/D'}</div>
        <div class="d-flex gap-2 flex-wrap mt-auto">
          <button class="btn btn-sm btn-outline-primary" data-sensor="${sensor.id}">Dettagli</button>
        </div>
      </div>
    </div>
  `;
  col.querySelector('button').addEventListener('click', () => {
    state.selectedId = sensor.id;
    sensorFilter.value = sensor.id;
    renderHistory();
  });
  return col;
}

function renderHistory() {
  historyBody.innerHTML = '';
  if (!state.selectedId) {
    historySection.classList.add('d-none');
    return;
  }
  historySection.classList.remove('d-none');
  const sensor = state.sensors.find((s) => s.id === state.selectedId);
  const items = state.valuesBySensor.get(state.selectedId) || [];
  historyTitle.textContent = sensor ? `Ultimi messaggi per ${sensor.name}` : 'Ultimi messaggi';

  if (!items.length) {
    const empty = document.createElement('tr');
    empty.innerHTML = '<td colspan="4" class="text-center p-4 text-muted">Nessun messaggio disponibile.</td>';
    historyBody.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const status = evaluateThreshold(sensor, item);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><code>${escapeHtml(item.topic)}</code></td>
      <td class="payload-json">${escapeHtml(formatPayload(item.payload ?? item.raw_payload))}</td>
      <td class="text-muted small">${formatDate(item.received_at)}</td>
      <td><span class="badge ${status.className}">${status.label}</span></td>
    `;
    historyBody.appendChild(row);
  });
}

function getSensorStatus(sensor) {
  const items = state.valuesBySensor.get(sensor.id) || [];
  if (!items.length) {
    return { level: 'unknown', label: 'N/D', className: 'bg-secondary-subtle text-secondary' };
  }
  return evaluateThreshold(sensor, items[0]);
}

function evaluateThreshold(sensor, item) {
  const threshold = sensor.threshold;
  const numericValue = extractNumericValue(item);
  if (threshold == null || Number.isNaN(numericValue)) {
    return { level: 'ok', label: 'OK', className: 'bg-success-subtle text-success' };
  }
  if (numericValue > threshold) {
    return { level: 'alert', label: 'Alert', className: 'bg-danger-subtle text-danger' };
  }
  return { level: 'ok', label: 'OK', className: 'bg-success-subtle text-success' };
}

function extractNumericValue(item) {
  if (!item) return NaN;
  const payload = item.payload;
  if (typeof payload === 'number') return payload;
  if (payload && typeof payload === 'object' && typeof payload.value === 'number') return payload.value;
  const raw = item.raw_payload ?? payload;
  const num = Number(raw);
  return Number.isNaN(num) ? NaN : num;
}

function formatValue(item) {
  if (!item) return 'N/D';
  const numeric = extractNumericValue(item);
  if (!Number.isNaN(numeric)) return numeric;
  return formatPayload(item.payload ?? item.raw_payload);
}

function formatPayload(payload) {
  if (!payload) return '';
  if (typeof payload === 'object') {
    try {
      return JSON.stringify(payload);
    } catch {
      return '[oggetto]';
    }
  }
  return String(payload);
}

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
}

function escapeHtml(value) {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function flash(message, type) {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.classList.remove('d-none');
}
