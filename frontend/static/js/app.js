import { ensureConfigured as fetchSetupStatus, getToken, setToken, clearToken, showSetupLinks } from './shared.js';

const urlParams = new URLSearchParams(window.location.search);
const demoMode = urlParams.get('demo') === '1';

const DEMO_MESSAGES = [
  {
    direction: 'inbound',
    topic: 'gateway/in/status',
    payload: { door: 'closed', battery: 87 },
    received_at: new Date(Date.now() - 120000).toISOString(),
  },
  {
    direction: 'outbound',
    topic: 'gateway/out/command',
    payload: { action: 'ping' },
    received_at: new Date(Date.now() - 60000).toISOString(),
  },
];

const state = {
  token: demoMode ? DEMO_TOKEN : getToken(),
  socket: null,
  user: null,
  demoMode,
  demoTimer: null,
  setupRequired: false,
};

const loginView = document.querySelector('#loginView');
const appView = document.querySelector('#appView');
const loginForm = document.querySelector('#loginForm');
const loginError = document.querySelector('#loginError');
const demoNotice = document.querySelector('#demoNotice');
const publishForm = document.querySelector('#publishForm');
const messageTableBody = document.querySelector('#messageTableBody');
const refreshButton = document.querySelector('#refreshButton');
const statusBadge = document.querySelector('#statusBadge');
const userEmailLabel = document.querySelector('#userEmail');
const logoutButton = document.querySelector('#logoutButton');
const appAlerts = document.querySelector('#appAlerts');

const API_BASE = '/api';

if (demoMode && demoNotice) {
  demoNotice.classList.remove('d-none');
}

bootstrap();

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAlert(loginError);

  const email = document.querySelector('#email').value.trim();
  const password = document.querySelector('#password').value;

  if (state.demoMode) {
    handleLoginSuccess({ access_token: 'demo-token', email });
    return;
  }

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
    handleLoginSuccess(data);
  } catch (error) {
    showAlert(loginError, error.message || 'Errore durante l\'autenticazione');
    console.error(error);
  }
});

publishForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (state.demoMode) {
    const topicInput = document.querySelector('#topic');
    const payloadInput = document.querySelector('#payload');
    const topic = topicInput.value.trim() || 'gateway/demo/manual';
    const rawPayload = payloadInput.value.trim();
    let payload;
    try {
      payload = JSON.parse(rawPayload);
    } catch (error) {
      payload = rawPayload || '<vuoto>';
    }
    appendMessage({
      direction: 'outbound',
      topic,
      payload,
      received_at: new Date().toISOString(),
    });
    flashApp('Messaggio demo registrato (nessun invio reale).', 'info');
    payloadInput.value = '';
    return;
  }

  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    flashApp('WebSocket non connesso, impossibile inviare il messaggio.', 'warning');
    return;
  }

  const topicInput = document.querySelector('#topic');
  const payloadInput = document.querySelector('#payload');

  const topic = topicInput.value.trim();
  const rawPayload = payloadInput.value.trim();

  let payload;
  try {
    payload = JSON.parse(rawPayload);
  } catch (error) {
    payload = rawPayload;
  }

  state.socket.send(
    JSON.stringify({
      action: 'publish',
      topic: topic || undefined,
      payload,
    }),
  );

  payloadInput.value = '';
  flashApp('Messaggio inviato al gateway', 'info');
});

refreshButton.addEventListener('click', async () => {
  await loadMessages();
  flashApp('Lista messaggi aggiornata', 'secondary');
});

logoutButton.addEventListener('click', () => {
  logout();
});

async function loadMessages() {
  if (state.demoMode) {
    renderMessages([...DEMO_MESSAGES]);
    return;
  }

  if (!state.token) return;
  try {
    const response = await fetch(`${API_BASE}/messages?limit=25`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (response.status === 401) {
      flashApp('Sessione scaduta, effettua nuovamente il login.', 'warning');
      logout();
      return;
    }
    if (!response.ok) {
      throw new Error('Impossibile caricare i messaggi');
    }
    const payload = await response.json();
    renderMessages(payload.items || []);
  } catch (error) {
    flashApp(error.message || 'Errore durante il caricamento dei messaggi', 'danger');
    console.error(error);
  }
}

function connectWebSocket() {
  if (state.demoMode) {
    updateConnectionStatus('online', 'demo');
    if (state.demoTimer) {
      clearInterval(state.demoTimer);
    }
    state.demoTimer = setInterval(() => {
      const payload = {
        direction: Math.random() > 0.5 ? 'inbound' : 'outbound',
        topic: `gateway/demo/${Math.random() > 0.5 ? 'status' : 'command'}`,
        payload: { value: Math.floor(Math.random() * 100) },
        received_at: new Date().toISOString(),
      };
      appendMessage(payload);
    }, 5000);
    return;
  }

  if (!state.token) return;

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${window.location.host}/ws?token=${state.token}`;

  updateConnectionStatus('connecting', 'connessione…');

  const socket = new WebSocket(wsUrl);
  state.socket = socket;

  socket.addEventListener('open', () => {
    updateConnectionStatus('online', 'online');
  });

  socket.addEventListener('close', () => {
    updateConnectionStatus('offline', 'offline');
    setTimeout(connectWebSocket, 2000);
  });

  socket.addEventListener('error', (event) => {
    console.error('WebSocket error', event);
    updateConnectionStatus('offline', 'errore');
    flashApp('Errore nella connessione WebSocket', 'danger');
  });

  socket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data);
      handleSocketMessage(message);
    } catch (error) {
      console.error('Errore parsing messaggio', error);
    }
  });
}

function handleSocketMessage(message) {
  const { type, data } = message;
  switch (type) {
    case 'connected':
      flashApp(`WebSocket connesso come ${data.user}`, 'success');
      break;
    case 'mqtt_message':
      appendMessage(data);
      break;
    case 'publish_ack':
      // ack informativa, nessuna azione aggiuntiva
      break;
    case 'error':
      flashApp(data.message || 'Errore dal gateway', 'danger');
      break;
    default:
      console.debug('Messaggio non gestito', message);
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

  items
    .slice()
    .reverse()
    .forEach((item) => appendMessage(item));
}

function appendMessage(item, prepend = true) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${item.direction || '-'}</td>
    <td>${item.topic || '-'}</td>
    <td class="payload-json">${escapeHtml(formatPayload(item.payload ?? item.raw_payload))}</td>
    <td>${formatDate(item.received_at)}</td>
  `;
  if (prepend) {
    messageTableBody.prepend(row);
    while (messageTableBody.children.length > 50) {
      messageTableBody.removeChild(messageTableBody.lastElementChild);
    }
  } else {
    messageTableBody.appendChild(row);
  }
}

function updateConnectionStatus(status, label) {
  const classes = ['badge-offline', 'badge-online', 'badge-connecting', 'text-bg-secondary'];
  statusBadge.textContent = label || status;
  statusBadge.classList.remove(...classes);

  const classMap = {
    offline: 'badge-offline',
    online: 'badge-online',
    connecting: 'badge-connecting',
  };

  statusBadge.classList.add(classMap[status] || 'text-bg-secondary');
}

function setUserEmail(email) {
  userEmailLabel.textContent = email;
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

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resetMessages() {
  messageTableBody.innerHTML = '<tr class="text-muted"><td colspan="4" class="text-center p-4">Effettua il login per visualizzare i messaggi.</td></tr>';
}

function logout() {
  if (state.socket) {
    state.socket.close();
  }
  if (state.demoTimer) {
    clearInterval(state.demoTimer);
    state.demoTimer = null;
  }
  state.token = null;
  state.socket = null;
  state.user = null;
  if (!state.demoMode) {
    clearToken();
  }

  setUserEmail('');
  updateConnectionStatus('offline', 'offline');
  refreshButton.disabled = true;
  toggleAppView(false);
  resetMessages();
  loginForm.reset();
  hideAlert(loginError);
}

window.addEventListener('beforeunload', () => {
  if (state.socket) {
    state.socket.close();
  }
  if (state.demoTimer) {
    clearInterval(state.demoTimer);
  }
});

function handleLoginSuccess(data) {
  state.token = data.access_token;
  if (!state.demoMode) {
    setToken(data.access_token);
  }
  enterApp(data.email);
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
    const response = await fetch('/api/status/me', {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (!response.ok) {
      throw new Error('Sessione non valida');
    }
    const payload = await response.json();
    const email = payload.email || payload.user || (payload.claims && payload.claims.sub) || 'utente';
    enterApp(email, { silent: true });
  } catch (error) {
    console.warn('Sessione non più valida, richiesto nuovo login');
    clearToken();
    state.token = null;
    toggleAppView(false);
  }
}

function enterApp(email, { silent = false } = {}) {
  state.user = email;

  toggleAppView(true);
  setUserEmail(email);
  refreshButton.disabled = false;
  if (!silent) {
    flashApp(state.demoMode ? `Demo attiva per ${email}` : `Autenticato come ${email}`, 'success');
  }

  loadMessages();
  connectWebSocket();
}

async function bootstrap() {
  if (state.demoMode) {
    showSetupLinks(false);
    toggleAppView(false);
    return;
  }

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
