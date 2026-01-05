import { ensureConfigured, showSetupLinks, requireToken, fetchWithAuth } from './shared.js';

const form = document.querySelector('#settingsForm');
const alertBox = document.querySelector('#settingsAlert');
const hostInput = document.querySelector('#mqttHost');
const portInput = document.querySelector('#mqttPort');
const userInput = document.querySelector('#mqttUsername');
const passInput = document.querySelector('#mqttPassword');
const clearPasswordInput = document.querySelector('#clearPassword');
const clientIdInput = document.querySelector('#mqttClientId');
const subscribeInput = document.querySelector('#mqttSubscribeTopic');
const publishInput = document.querySelector('#mqttPublishTopic');
const controlInput = document.querySelector('#mqttControlTopic');
const qosSelect = document.querySelector('#mqttQos');
const saveButton = document.querySelector('#settingsSave');

init();

async function init() {
  const status = await ensureConfigured();
  showSetupLinks(status.setupRequired);
  if (status.setupRequired) return;

  const token = requireToken();
  if (!token) return;

  form.addEventListener('submit', handleSubmit);
  await loadSettings(token);
}

async function loadSettings(token) {
  let lockForm = false;
  setSaving(true);
  try {
    const res = await fetchWithAuth('/api/settings/mqtt', { token });
    const data = await res.json().catch(() => ({}));
    if (res.status === 403) {
      lockForm = true;
      throw new Error('Solo gli amministratori possono modificare le impostazioni MQTT.');
    }
    if (!res.ok) {
      throw new Error(data.error || 'Impossibile caricare le impostazioni MQTT');
    }

    hostInput.value = data.mqtt_host || '';
    portInput.value = data.mqtt_port ?? '';
    userInput.value = data.mqtt_username || '';
    clientIdInput.value = data.mqtt_client_id || '';
    subscribeInput.value = data.mqtt_subscribe_topic || '';
    publishInput.value = data.mqtt_publish_topic || '';
    controlInput.value = data.mqtt_control_topic || '';
    qosSelect.value = data.mqtt_qos === undefined || data.mqtt_qos === null ? '' : String(data.mqtt_qos);
    passInput.value = '';
    clearPasswordInput.checked = false;

    flash('Impostazioni caricate', 'success');
  } catch (error) {
    flash(error.message || 'Errore durante il caricamento delle impostazioni', 'danger');
    if (lockForm) {
      disableForm();
    }
  } finally {
    if (!lockForm) {
      setSaving(false);
    }
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  hideAlert();

  const payload = {
    mqtt_host: hostInput.value.trim(),
    mqtt_port: Number(portInput.value),
    mqtt_username: userInput.value.trim(),
    mqtt_client_id: clientIdInput.value.trim() || undefined,
    mqtt_subscribe_topic: subscribeInput.value.trim(),
    mqtt_publish_topic: publishInput.value.trim(),
    mqtt_control_topic: controlInput.value.trim(),
  };

  const qosValue = qosSelect.value;
  if (qosValue !== '') {
    payload.mqtt_qos = Number(qosValue);
  }

  if (clearPasswordInput.checked) {
    payload.mqtt_password = '';
  } else if (passInput.value) {
    payload.mqtt_password = passInput.value;
  }

  setSaving(true);
  try {
    const res = await fetchWithAuth('/api/settings/mqtt', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg =
        data.errors?.mqtt_host ||
        data.errors?.mqtt_port ||
        data.errors?.mqtt_qos ||
        data.error ||
        'Impossibile salvare le impostazioni';
      throw new Error(errorMsg);
    }
    passInput.value = '';
    clearPasswordInput.checked = false;
    flash('Impostazioni MQTT aggiornate. Il ponte MQTT si riconnetterà con i nuovi parametri.', 'success');
  } catch (error) {
    flash(error.message || 'Errore durante il salvataggio', 'danger');
    console.error(error);
  } finally {
    setSaving(false);
  }
}

function setSaving(state) {
  saveButton.disabled = state;
}

function disableForm() {
  form.querySelectorAll('input, select, button').forEach((el) => {
    el.disabled = true;
  });
  saveButton.disabled = true;
}

function flash(message, type) {
  alertBox.textContent = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.classList.remove('d-none');
}

function hideAlert() {
  alertBox.classList.add('d-none');
}
