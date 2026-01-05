import { ensureConfigured as fetchSetupStatus, getToken, setToken, clearToken, showSetupLinks, fetchWithAuth } from './shared.js';

const state = {
  token: getToken(),
  user: null,
  setupRequired: false,
  sensors: [],
  valuesBySensor: new Map(),
  lastMessage: null,
};

const loginView = document.querySelector('#loginView');
const appView = document.querySelector('#appView');
const loginForm = document.querySelector('#loginForm');
const loginError = document.querySelector('#loginError');
const publishForm = document.querySelector('#publishForm');
const messageTableBody = document.querySelector('#messageTableBody');
const refreshButton = document.querySelector('#refreshButton');
const userEmailLabel = document.querySelector('#userEmail');
const logoutButton = document.querySelector('#logoutButton');
const appAlerts = document.querySelector('#appAlerts');
const statSensors = document.querySelector('#statSensors');
const statAlerts = document.querySelector('#statAlerts');
const statLastTopic = document.querySelector('#statLastTopic');
const statLastTime = document.querySelector('#statLastTime');
const quickSensorCards = document.querySelector('#quickSensorCards');

const API_BASE = '/api';

bootstrap();

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAlert(loginError);

  const email = document.querySelector('#email').value.trim();
  const password = document.querySelector('#password').value;

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Credenziali non valide');
    }

    const data = await response.json();
    state.token = data.access_token;
    setToken(data.access_token);
    enterApp(data.email);
  } catch (error) {
    showAlert(loginError, error.message || 'Errore durante l\'autenticazione');
    console.error(error);
  }
});

publishForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const topicInput = document.querySelector('#topic');
  const payloadInput = document.querySelector('#payload');

  const topic = topicInput.value.trim();
  const rawPayload = payloadInput.value.trim();

  if (!topic) {
    flashApp('Inserisci un topic valido.', 'warning');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawPayload);
  } catch (error) {
    payload = rawPayload;
  }

  try {
    const response = await fetchWithAuth('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, payload }),
      token: state.token,
    });

    if (!response.ok) {
      const payloadResponse = await response.json().catch(() => ({}));
      throw new Error(payloadResponse.error || 'Impossibile pubblicare il messaggio');
    }

    flashApp('Messaggio inviato al gateway', 'info');
    payloadInput.value = '';
  } catch (error) {
    flashApp(error.message || 'Errore durante la pubblicazione', 'danger');
    console.error(error);
  }
});

refreshButton.addEventListener('click', async () => {
  await loadMessages();
  flashApp('Lista messaggi aggiornata', 'secondary');
});

logoutButton.addEventListener('click', () => {
  logout();
});

async function bootstrap() {
  const status = await initSetupStatus();
  if (status.setupRequired) {
    toggleAppView(false);
    return;
  }

  if (state.token) {
    await resumeSession();
  }

  if (!state.token) {
    toggleAppView(false);
  }
}

async function initSetupStatus() {
  const status = await fetchSetupStatus();
  state.setupRequired = status.setupRequired;
  showSetupLinks(status.setupRequired);
  if (state.setupRequired && !window.location.pathname.includes('/setup.html')) {
    window.location.href = '/setup.html';
  }
  return status;
}

async function resumeSession() {
  try {
    const response = await fetchWithAuth('/api/status/me', { token: state.token });
    if (!response.ok) {
      throw new Error('Sessione non valida');
    }
    const payload = await response.json();
    const email = payload.email || payload.user || (payload.claims && payload.claims.sub) || 'utente';
    enterApp(email, { silent: true });
  } catch (error) {
    clearToken();
    state.token = null;
    toggleAppView(false);
  }
}

async function loadMessages() {
  if (!state.token) return;
  try {
    const response = await fetchWithAuth(`${API_BASE}/messages?limit=25`, { token: state.token });
    if (response.status === 401) {
      flashApp('Sessione scaduta, effettua nuovamente il login.', 'warning');
      logout();
      return;
    }
    if (!response.ok) {
      throw new Error('Impossibile caricare i messaggi');
    }
    const payload = await response.json();
    const items = payload.items || [];
    state.lastMessage = items[0] || null;
    renderMessages(items);
    renderStats();
  } catch (error) {
    flashApp(error.message || 'Errore durante il caricamento dei messaggi', 'danger');
    console.error(error);
  }
}

function renderMessages(items) {
  messageTableBody.innerHTML = '';
  if (!items.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="4" class="text-center p-4 text-muted">Nessun messaggio disponibile.</td>';
    messageTableBody.appendChild(emptyRow);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatDirection(item.direction)}</td>
      <td>${item.topic || '-'}</td>
      <td class="payload-json">${escapeHtml(formatPayload(item.payload ?? item.raw_payload))}</td>
      <td>${formatDate(item.received_at)}</td>
    `;
    messageTableBody.appendChild(row);
  });
}

function logout() {
  state.token = null;
  state.user = null;
  clearToken();

  setUserEmail('');
  refreshButton.disabled = true;
  toggleAppView(false);
  resetMessages();
  loginForm.reset();
  hideAlert(loginError);
}

function enterApp(email, { silent = false } = {}) {
  state.user = email;
  toggleAppView(true);
  setUserEmail(email);
  refreshButton.disabled = false;
  if (!silent) {
    flashApp(`Autenticato come ${email}`, 'success');
  }
  Promise.all([loadMessages(), loadSensorsSummary()]);
}

function toggleAppView(isLoggedIn) {
  if (isLoggedIn) {
    loginView.classList.add('d-none');
    appView.classList.remove('d-none');
  } else {
    loginView.classList.remove('d-none');
    appView.classList.add('d-none');
  }
}

function setUserEmail(email) {
  userEmailLabel.textContent = email;
}

function resetMessages() {
  messageTableBody.innerHTML = '<tr class="text-muted"><td colspan="4" class="text-center p-4">Effettua il login per visualizzare i messaggi.</td></tr>';
}

async function loadSensorsSummary() {
  if (!state.token) return;
  try {
    const sensorsRes = await fetchWithAuth('/api/sensors/', { token: state.token });
    if (!sensorsRes.ok) throw new Error('Impossibile caricare i sensori');
    const sensorsPayload = await sensorsRes.json();
    state.sensors = sensorsPayload.items || [];

    const entries = await Promise.all(
      state.sensors.map(async (sensor) => {
        try {
          const res = await fetchWithAuth(`/api/sensors/${sensor.id}/values?limit=1`, { token: state.token });
          if (!res.ok) throw new Error('Errore');
          const payload = await res.json();
          return [sensor.id, payload.items || []];
        } catch (error) {
          console.error('Errore caricando valori sensore', sensor.id, error);
          return [sensor.id, []];
        }
      }),
    );
    state.valuesBySensor = new Map(entries);
    renderStats();
    renderQuickSensors();
  } catch (error) {
    flashApp(error.message || 'Errore caricando i sensori', 'danger');
    console.error(error);
  }
}

function renderStats() {
  if (statSensors) statSensors.textContent = state.sensors.length || 0;
  const alerting = state.sensors.filter((s) => {
    const items = state.valuesBySensor.get(s.id) || [];
    if (!items.length) return false;
    const status = evaluateThreshold(s, items[0]);
    return status.level === 'alert';
  }).length;
  if (statAlerts) statAlerts.textContent = alerting;
  if (state.lastMessage) {
    statLastTopic.textContent = state.lastMessage.topic || '—';
    statLastTime.textContent = formatDate(state.lastMessage.received_at);
  } else {
    statLastTopic.textContent = '—';
    statLastTime.textContent = '—';
  }
}

function renderQuickSensors() {
  if (!quickSensorCards) return;
  quickSensorCards.innerHTML = '';
  if (!state.sensors.length) {
    const empty = document.createElement('div');
    empty.className = 'col-12 text-center text-muted py-3';
    empty.textContent = 'Nessun sensore configurato.';
    quickSensorCards.appendChild(empty);
    return;
  }

  state.sensors.slice(0, 4).forEach((sensor) => {
    const items = state.valuesBySensor.get(sensor.id) || [];
    const latest = items[0];
    const status = latest ? evaluateThreshold(sensor, latest) : { level: 'unknown', label: 'N/D', className: 'bg-secondary-subtle text-secondary' };
    const valueDisplay = latest ? formatValue(latest) : 'N/D';
    const updated = latest ? formatDate(latest.received_at) : '—';
    const tipo = typeLabel(sensor.type);

    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-xl-3';
    col.innerHTML = `
          <div class="card h-100 border-0 section-card">
            <div class="card-body d-flex flex-column gap-2">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <div class="text-uppercase text-muted small mb-1">${escapeHtml(tipo)}</div>
                  <h5 class="mb-1">${escapeHtml(sensor.name)}</h5>
                  <div class="text-muted small">Topic: <code>${escapeHtml(sensor.topic)}</code></div>
                </div>
            <span class="badge rounded-pill ${status.className}">${status.label}</span>
          </div>
          <div class="fs-4 fw-semibold">${valueDisplay}${sensor.unit ? ` ${escapeHtml(sensor.unit)}` : ''}</div>
          <div class="text-muted small">Aggiornato: ${updated}</div>
          <div class="small text-muted">Soglia: ${sensor.threshold ?? 'N/D'}</div>
          <div class="mt-auto">
            <a href="/sensor-values.html" class="btn btn-sm btn-outline-primary">Vai al dettaglio</a>
          </div>
        </div>
      </div>
    `;
    quickSensorCards.appendChild(col);
  });
}

function flashApp(message, type = 'info') {
  if (!appAlerts) return;
  appAlerts.textContent = message;
  appAlerts.className = `alert alert-${type}`;
  appAlerts.classList.remove('d-none');

  clearTimeout(flashApp.timeoutId);
  flashApp.timeoutId = setTimeout(() => {
    appAlerts.classList.add('d-none');
  }, 4000);
}

function showAlert(element, message) {
  element.textContent = message;
  element.classList.remove('d-none');
}

function hideAlert(element) {
  element.classList.add('d-none');
}

function formatPayload(payload) {
  if (!payload) return '';
  if (typeof payload === 'object') {
    return JSON.stringify(payload, null, 2);
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

function formatDirection(direction) {
  if (direction === 'inbound') return 'Ingresso';
  if (direction === 'outbound') return 'Uscita';
  return direction || '-';
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

function escapeHtml(value) {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
