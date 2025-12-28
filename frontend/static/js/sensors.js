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
const saveButton = document.querySelector('#sensorSaveButton');
const searchInput = document.querySelector('#sensorSearch');
const typeFilter = document.querySelector('#sensorTypeFilter');
const formStatus = document.querySelector('#sensorFormStatus');
const formTitle = document.querySelector('#sensorFormTitle');
const deleteButton = document.querySelector('#sensorDeleteButton');
const editModalEl = document.querySelector('#sensorEditModal');
const editModal = editModalEl ? new bootstrap.Modal(editModalEl) : null;

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

  form.addEventListener('submit', (event) => event.preventDefault());
  saveButton.addEventListener('click', handleSubmit);
  refreshButton.addEventListener('click', loadSensors);
  searchInput.addEventListener('input', renderTable);
  typeFilter.addEventListener('change', renderTable);
  deleteButton.addEventListener('click', () => {
    if (!state.editingId) return;
    removeSensor(state.editingId);
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
      const sensorId = (state.editingId || '').trim();
      if (!sensorId) {
        flash('Sensore non valido.', 'danger');
        return;
      }
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
      const message = data.error || Object.values(data.errors || {}).join(', ') || 'Operazione non riuscita';
      throw new Error(message);
    }

    flash(state.editingId ? 'Sensore aggiornato.' : 'Sensore creato.', 'success');
    resetForm();
    if (editModal) {
      editModal.hide();
    }
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
  const controlTopic = form.sensorControlTopic?.value.trim() || undefined;
  const threshold = thresholdRaw ? Number(thresholdRaw) : undefined;

  if (!name || !topic) {
    flash('Nome e topic sono obbligatori.', 'danger');
    return null;
  }

  if (thresholdRaw && Number.isNaN(threshold)) {
    flash('La soglia deve essere un numero valido.', 'danger');
    return null;
  }

  return { name, topic, unit, icon, type, description, threshold, control_topic: controlTopic };
}

function renderTable() {
  tableBody.innerHTML = '';
  const search = searchInput.value.trim().toLowerCase();
  const type = typeFilter.value;

  const filtered = state.sensors.filter((sensor) => {
    const matchesText =
      !search ||
      (sensor.name || '').toLowerCase().includes(search) ||
      (sensor.topic || '').toLowerCase().includes(search);
    const matchesType = !type || sensor.type === type;
    return matchesText && matchesType;
  });

  if (!filtered.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML =
      '<td colspan="6" class="text-center p-4 text-muted">Nessun sensore trovato. Modifica i filtri o aggiungi un sensore.</td>';
    tableBody.appendChild(emptyRow);
    return;
  }

  filtered.forEach((sensor) => {
    const row = document.createElement('tr');
    if (state.editingId === sensor.id) {
      row.classList.add('table-active');
    }
    row.innerHTML = `
      <td>
        <div class="fw-semibold">${escapeHtml(sensor.name)}</div>
        <div class="text-muted small">${escapeHtml(sensor.description || 'Nessuna descrizione')}</div>
      </td>
      <td><code>${escapeHtml(sensor.topic)}</code></td>
      <td>
        <span class="badge bg-light text-dark">${escapeHtml(sensor.type || 'generic')}</span>
        ${sensor.unit ? `<span class="badge bg-primary-subtle text-primary ms-1">${escapeHtml(sensor.unit)}</span>` : ''}
      </td>
      <td>${sensor.threshold ?? '-'}</td>
      <td class="text-muted small">${formatDate(sensor.updated_at || sensor.created_at)}</td>
      <td class="text-end">
        <div class="btn-group btn-group-sm" role="group">
          <button class="btn btn-outline-secondary" data-action="edit" data-id="${sensor.id}">Modifica</button>
          <button class="btn btn-outline-danger" data-action="delete" data-id="${sensor.id}">Elimina</button>
        </div>
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
  state.editingId = (id || '').trim();
  formTitle.textContent = `Modifica ${sensor.name}`;
  formStatus.textContent = `Stai modificando "${sensor.name}". Salva per applicare i cambi o annulla.`;
  formStatus.classList.remove('d-none');
  form.sensorName.value = sensor.name;
  form.sensorTopic.value = sensor.topic;
  form.sensorUnit.value = sensor.unit || '';
  form.sensorIcon.value = sensor.icon || '';
  form.sensorType.value = sensor.type || 'generic';
  form.sensorDescription.value = sensor.description || '';
  form.sensorThreshold.value = sensor.threshold ?? '';
  if (form.sensorControlTopic) {
    form.sensorControlTopic.value = sensor.control_topic || '';
  }
  saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Aggiorna sensore';
  if (editModal) {
    editModal.show();
  }
}

async function removeSensor(id) {
  if (!confirm('Vuoi eliminare questo sensore?')) {
    return;
  }
  try {
    const response = await fetchWithAuth(`/api/sensors/${id}`, {
      method: 'DELETE',
      token: state.token,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = payload.error || 'Impossibile eliminare il sensore';
      throw new Error(message);
    }
    flash('Sensore eliminato.', 'success');
    if (state.editingId === id) {
      resetForm();
    }
    if (editModal) {
      editModal.hide();
    }
    await loadSensors();
  } catch (error) {
    flash(error.message || "Errore durante l'eliminazione del sensore", 'danger');
    console.error(error);
  }
}

function resetForm() {
  state.editingId = null;
  form.reset();
  saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salva sensore';
  formStatus.classList.add('d-none');
  formTitle.textContent = 'Aggiungi un nuovo sensore';
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

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
}
