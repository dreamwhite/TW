import { ensureConfigured, showSetupLinks, requireToken, fetchWithAuth } from './shared.js';

const state = {
  sensors: [],
  editingId: null,
  token: null,
};

const form = document.querySelector('#sensorForm');
const alertBox = document.querySelector('#sensorsAlert');
const tableBody = document.querySelector('#sensorsTableBody');
const refreshButton = document.querySelector('#sensorsRefresh');
const newSensorButton = document.querySelector('#newSensorButton');
const cancelEditButton = document.querySelector('#sensorCancelEdit');
const saveButton = document.querySelector('#sensorSaveButton');

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

  form.addEventListener('submit', handleSubmit);
  refreshButton.addEventListener('click', loadSensors);
  newSensorButton.addEventListener('click', () => {
    resetForm();
    form.scrollIntoView({ behavior: 'smooth' });
    form.sensorName.focus();
  });
  cancelEditButton.addEventListener('click', () => {
    resetForm();
    flash('Modifica annullata.', 'info');
  });

  await loadSensors();
}

async function loadSensors() {
  try {
    const response = await fetchWithAuth('/api/sensors/', { token: state.token });
    if (!response.ok) {
      throw new Error('Impossibile caricare i sensori');
    }
    const payload = await response.json();
    state.sensors = payload.items || [];
    renderTable();
  } catch (error) {
    flash(error.message || 'Errore durante il caricamento dei sensori', 'danger');
    console.error(error);
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const payload = collectFormPayload();
  if (!payload) {
    return;
  }

  try {
    let response;
    if (state.editingId) {
      response = await fetchWithAuth(`/api/sensors/${state.editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        token: state.token,
      });
    } else {
      response = await fetchWithAuth('/api/sensors/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        token: state.token,
      });
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error || Object.values(data.errors || {}).join(', ') || 'Operazione fallita';
      throw new Error(message);
    }

    flash(state.editingId ? 'Sensore aggiornato con successo.' : 'Sensore creato con successo.', 'success');
    resetForm();
    await loadSensors();
  } catch (error) {
    flash(error.message || 'Errore durante il salvataggio del sensore', 'danger');
    console.error(error);
  }
}

function collectFormPayload() {
  const name = form.sensorName.value.trim();
  const topic = form.sensorTopic.value.trim();
  const unit = form.sensorUnit.value.trim() || undefined;
  const icon = form.sensorIcon.value.trim() || undefined;
  const type = form.sensorType.value || undefined;
  const description = form.sensorDescription.value.trim() || undefined;
  const thresholdRaw = form.sensorThreshold.value;
  const threshold = thresholdRaw ? Number(thresholdRaw) : undefined;

  if (!name || !topic) {
    flash('Nome e topic sono obbligatori.', 'danger');
    return null;
  }

  if (thresholdRaw && Number.isNaN(threshold)) {
    flash('La soglia deve essere un numero valido.', 'danger');
    return null;
  }

  return { name, topic, unit, icon, type, description, threshold };
}

function renderTable() {
  tableBody.innerHTML = '';
  if (!state.sensors.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="7" class="text-center p-4 text-muted">Nessun sensore configurato.</td>';
    tableBody.appendChild(emptyRow);
    return;
  }

  state.sensors.forEach((sensor) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(sensor.name)}</td>
      <td><code>${escapeHtml(sensor.topic)}</code></td>
      <td>${escapeHtml(sensor.unit || '-')}</td>
      <td>${sensor.icon ? `<i class="${escapeHtml(sensor.icon)}"></i>` : '-'}</td>
      <td>${escapeHtml(sensor.type || '-')}</td>
      <td>${sensor.threshold ?? '-'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary me-2" data-action="edit" data-id="${sensor.id}">
          <i class="fa-solid fa-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${sensor.id}">
          <i class="fa-solid fa-eraser"></i>
        </button>
      </td>
    `;
    row.querySelector('[data-action="edit"]').addEventListener('click', () => startEdit(sensor.id));
    row.querySelector('[data-action="delete"]').addEventListener('click', () => removeSensor(sensor.id));
    tableBody.appendChild(row);
  });
}

function startEdit(id) {
  const sensor = state.sensors.find((item) => item.id === id);
  if (!sensor) return;
  state.editingId = id;
  form.sensorName.value = sensor.name;
  form.sensorTopic.value = sensor.topic;
  form.sensorUnit.value = sensor.unit || '';
  form.sensorIcon.value = sensor.icon || '';
  form.sensorType.value = sensor.type || 'generic';
  form.sensorDescription.value = sensor.description || '';
  form.sensorThreshold.value = sensor.threshold ?? '';
  saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Aggiorna sensore';
  cancelEditButton.classList.remove('d-none');
  form.scrollIntoView({ behavior: 'smooth' });
}

async function removeSensor(id) {
  if (!confirm('Confermi la cancellazione del sensore?')) {
    return;
  }
  try {
    const response = await fetchWithAuth(`/api/sensors/${id}`, {
      method: 'DELETE',
      token: state.token,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = payload.error || 'Impossibile cancellare il sensore';
      throw new Error(message);
    }
    flash('Sensore eliminato.', 'success');
    if (state.editingId === id) {
      resetForm();
    }
    await loadSensors();
  } catch (error) {
    flash(error.message || 'Errore durante la cancellazione del sensore', 'danger');
    console.error(error);
  }
}

function resetForm() {
  state.editingId = null;
  form.reset();
  saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salva sensore';
  cancelEditButton.classList.add('d-none');
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
  }, 3500);
}
