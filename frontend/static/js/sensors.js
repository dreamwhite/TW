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
const searchInput = document.querySelector('#sensorSearch');
const typeFilter = document.querySelector('#sensorTypeFilter');
const formStatus = document.querySelector('#sensorFormStatus');
const formTitle = document.querySelector('#sensorFormTitle');

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
    flash('Edit canceled.', 'info');
  });
  searchInput.addEventListener('input', renderTable);
  typeFilter.addEventListener('change', renderTable);

  await loadSensors();
}

async function loadSensors() {
  try {
    const response = await fetchWithAuth('/api/sensors/', { token: state.token });
    if (!response.ok) {
      throw new Error('Unable to load sensors');
    }
    const payload = await response.json();
    state.sensors = payload.items || [];
    renderTable();
  } catch (error) {
    flash(error.message || 'Error while loading sensors', 'danger');
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
      const message = data.error || Object.values(data.errors || {}).join(', ') || 'Operation failed';
      throw new Error(message);
    }

    flash(state.editingId ? 'Sensor updated successfully.' : 'Sensor created successfully.', 'success');
    resetForm();
    await loadSensors();
  } catch (error) {
    flash(error.message || 'Error while saving the sensor', 'danger');
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
    flash('Name and topic are required.', 'danger');
    return null;
  }

  if (thresholdRaw && Number.isNaN(threshold)) {
    flash('Threshold must be a valid number.', 'danger');
    return null;
  }

  return { name, topic, unit, icon, type, description, threshold };
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
    emptyRow.innerHTML = '<td colspan="6" class="text-center p-4 text-muted">No sensors match the current filters. Adjust search or add a new sensor.</td>';
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
        <div class="text-muted small">${escapeHtml(sensor.description || 'No description')}</div>
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
          <button class="btn btn-outline-secondary" data-action="edit" data-id="${sensor.id}">
            <i class="fa-solid fa-pencil"></i> Edit
          </button>
          <button class="btn btn-outline-danger" data-action="delete" data-id="${sensor.id}">
            <i class="fa-solid fa-eraser"></i> Delete
          </button>
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
  state.editingId = id;
  formTitle.textContent = `Editing ${sensor.name}`;
  formStatus.textContent = `You are editing "${sensor.name}". Save to apply changes or cancel to revert the form.`;
  formStatus.classList.remove('d-none');
  form.sensorName.value = sensor.name;
  form.sensorTopic.value = sensor.topic;
  form.sensorUnit.value = sensor.unit || '';
  form.sensorIcon.value = sensor.icon || '';
  form.sensorType.value = sensor.type || 'generic';
  form.sensorDescription.value = sensor.description || '';
  form.sensorThreshold.value = sensor.threshold ?? '';
  saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update sensor';
  cancelEditButton.classList.remove('d-none');
  form.scrollIntoView({ behavior: 'smooth' });
}

async function removeSensor(id) {
  if (!confirm('Do you want to delete this sensor?')) {
    return;
  }
  try {
    const response = await fetchWithAuth(`/api/sensors/${id}`, {
      method: 'DELETE',
      token: state.token,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = payload.error || 'Unable to delete the sensor';
      throw new Error(message);
    }
    flash('Sensor deleted.', 'success');
    if (state.editingId === id) {
      resetForm();
    }
    await loadSensors();
  } catch (error) {
    flash(error.message || 'Error while deleting the sensor', 'danger');
    console.error(error);
  }
}

function resetForm() {
  state.editingId = null;
  form.reset();
  saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save sensor';
  cancelEditButton.classList.add('d-none');
  formStatus.classList.add('d-none');
  formTitle.textContent = 'Add a new sensor';
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
