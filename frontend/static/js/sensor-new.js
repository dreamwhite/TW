import { ensureConfigured, showSetupLinks, requireToken, fetchWithAuth } from './shared.js';

const alertBox = document.querySelector('#newSensorAlert');
const form = document.querySelector('#newSensorForm');

init();

async function init() {
  const status = await ensureConfigured();
  showSetupLinks(status.setupRequired);
  if (status.setupRequired) return;

  const token = requireToken();
  if (!token) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectPayload();
    if (!payload) return;

    try {
      const response = await fetchWithAuth('/api/sensors/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        token,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data.error || Object.values(data.errors || {}).join(', ') || 'Operation failed';
        throw new Error(message);
      }

      flash('Sensor created. Redirecting to list...', 'success');
      setTimeout(() => {
        window.location.href = '/sensors.html';
      }, 1200);
    } catch (error) {
      flash(error.message || 'Error while saving the sensor', 'danger');
      console.error(error);
    }
  });
}

function collectPayload() {
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

function flash(message, type) {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.classList.remove('d-none');
}
