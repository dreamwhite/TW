import { ensureConfigured, requireToken, showSetupLinks, fetchWithAuth } from './shared.js';

const state = {
  token: null,
  items: [],
};

const tableBody = document.querySelector('#messagesTableBody');
const refreshButton = document.querySelector('#messagesRefresh');
const downloadButton = document.querySelector('#messagesDownload');
const alertBox = document.querySelector('#messagesAlert');
const filterDirection = document.querySelector('#filterDirection');
const filterTopic = document.querySelector('#filterTopic');
const filterLimit = document.querySelector('#filterLimit');

init();

async function init() {
  const status = await ensureConfigured();
  showSetupLinks(status.setupRequired);
  if (status.setupRequired) {
    return;
  }

  const token = requireToken();
  if (!token) {
    return;
  }
  state.token = token;

  filterDirection.addEventListener('change', renderTable);
  filterTopic.addEventListener('input', renderTable);
  filterLimit.addEventListener('change', async () => {
    await loadMessages();
  });

  refreshButton.addEventListener('click', async () => {
    await loadMessages();
    flash('Lista messaggi aggiornata', 'secondary');
  });

  downloadButton.addEventListener('click', downloadJson);

  await loadMessages();
}

async function loadMessages() {
  try {
    const limit = filterLimit.value || '25';
    const response = await fetchWithAuth(`/api/messages?limit=${limit}`, {
      token: state.token,
    });
    if (response.status === 401) {
      window.location.href = '/index.html';
      return;
    }
    if (!response.ok) {
      throw new Error('Impossibile caricare i messaggi');
    }
    const payload = await response.json();
    state.items = payload.items || [];
    renderTable();
  } catch (error) {
    flash(error.message || 'Errore durante il caricamento dei messaggi', 'danger');
    console.error(error);
  }
}

function renderTable() {
  tableBody.innerHTML = '';
  const directionFilter = filterDirection.value;
  const topicFilter = filterTopic.value.trim().toLowerCase();

  const filtered = state.items.filter((item) => {
    if (directionFilter && item.direction !== directionFilter) {
      return false;
    }
    if (topicFilter && !(item.topic || '').toLowerCase().includes(topicFilter)) {
      return false;
    }
    return true;
  });

  if (!filtered.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="4" class="text-center p-4 text-muted">Nessun messaggio disponibile.</td>';
    tableBody.appendChild(emptyRow);
    return;
  }

  filtered.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.direction || '-'}</td>
      <td>${item.topic || '-'}</td>
      <td class="payload-json">${escapeHtml(formatPayload(item.payload ?? item.raw_payload))}</td>
      <td>${formatDate(item.received_at)}</td>
    `;
    tableBody.appendChild(row);
  });
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(state.items, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `messages-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function flash(message, type) {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.classList.remove('d-none');
  clearTimeout(flash.timeoutId);
  flash.timeoutId = setTimeout(() => {
    alertBox.classList.add('d-none');
  }, 3000);
}
