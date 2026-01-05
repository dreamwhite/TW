import { ensureConfigured, showSetupLinks, requireToken, fetchWithAuth } from './shared.js';

const state = {
  token: null,
  sensors: [],
  valuesBySensor: new Map(),
};

const cardsContainer = document.querySelector('#sensorCards');
const alertBox = document.querySelector('#valuesAlert');
const historyBody = document.querySelector('#historyTableBody');
const sensorFilter = document.querySelector('#sensorFilter');
const onlyAlerts = document.querySelector('#onlyAlerts');
const refreshButton = document.querySelector('#refreshValues');
const historyModalEl = document.getElementById('historyModal');
const historyModal = historyModalEl ? new bootstrap.Modal(historyModalEl) : null;
const historyTitle = document.getElementById('historyModalLabel');

init();

async function init() {
  const status = await ensureConfigured();
  showSetupLinks(status.setupRequired);
  if (status.setupRequired) return;

  const token = requireToken();
  if (!token) return;
  state.token = token;

  refreshButton.addEventListener('click', loadData);
  sensorFilter.addEventListener('change', render);
  onlyAlerts.addEventListener('change', render);

  await loadData();
}

async function loadData() {
  try {
    const sensorsRes = await fetchWithAuth('/api/sensors/', { token: state.token });
    if (!sensorsRes.ok) throw new Error('Impossibile caricare i sensori');
    const sensorsPayload = await sensorsRes.json();
    state.sensors = sensorsPayload.items || [];
    // Assicurati che il backend sia sottoscritto ai topic correnti
    await fetchWithAuth('/api/sensors/resubscribe', { method: 'POST', token: state.token }).catch(() => {});
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
}

function renderCard(sensor) {
  const items = state.valuesBySensor.get(sensor.id) || [];
  const latest = items[0];
  const status = getSensorStatus(sensor);
  const valueDisplay = latest ? formatValue(latest) : 'N/D';
  const timeDisplay = latest ? formatDate(latest.received_at) : '—';
  const tipo = typeLabel(sensor.type);
  const controlState = status.level === 'alert' ? 'Azione soglia: attiva' : 'Azione soglia: disattivata';

  const col = document.createElement('div');
  col.className = 'col-12 col-md-6 col-xl-4';
  col.innerHTML = `
    <div class="card h-100 sensor-card">
      <div class="card-body d-flex flex-column gap-3">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="text-uppercase text-muted small mb-1">${escapeHtml(tipo)}</div>
            <h5 class="mb-1">${escapeHtml(sensor.name)}</h5>
            <div class="text-muted small">Topic: <code>${escapeHtml(sensor.topic)}</code></div>
          </div>
          <div class="sensor-status ${status.className}">
            <span class="status-dot"></span>
            <span class="small fw-semibold">${status.label}</span>
          </div>
        </div>
        <div class="d-flex align-items-baseline gap-2">
          <div class="sensor-value">${valueDisplay}</div>
          ${sensor.unit ? `<span class="text-muted">${escapeHtml(sensor.unit)}</span>` : ''}
        </div>
        <div class="text-muted small d-flex justify-content-between">
          <span>Soglia: ${sensor.threshold ?? 'N/D'}</span>
          <span>${controlState}</span>
        </div>
        <div class="text-muted small">Aggiornato: ${timeDisplay}</div>
        <div class="mt-auto">
          <button class="btn btn-sm btn-outline-primary" data-sensor="${sensor.id}">Dettagli</button>
        </div>
      </div>
    </div>
  `;
  col.querySelector('button').addEventListener('click', () => {
    openHistory(sensor);
  });
  return col;
}

function openHistory(sensor) {
  if (!historyModal) return;
  historyTitle.textContent = `Ultimi messaggi · ${sensor.name}`;
  const items = state.valuesBySensor.get(sensor.id) || [];
  historyBody.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('tr');
    empty.innerHTML = '<td colspan="4" class="text-center p-4 text-muted">Nessun messaggio disponibile.</td>';
    historyBody.appendChild(empty);
  } else {
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

  historyModal.show();
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
    return { level: 'alert', label: 'Allarme', className: 'bg-danger-subtle text-danger' };
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

function typeLabel(type) {
  const map = {
    temperature: 'Temperatura',
    humidity: 'Umidità',
    presence: 'Presenza',
    custom: 'Personalizzato',
    generic: 'Generico',
  };
  return map[type] || 'Generico';
}

function flash(message, type) {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.classList.remove('d-none');
}
