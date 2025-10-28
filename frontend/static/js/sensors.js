import { ensureConfigured, showSetupLinks } from './shared.js';

const state = {
  sensors: [],
  useDemo: false,
};

const form = document.querySelector('#sensorForm');
const alertBox = document.querySelector('#sensorsAlert');
const tableBody = document.querySelector('#sensorsTableBody');
const refreshButton = document.querySelector('#sensorsRefresh');
const demoToggleButton = document.querySelector('#sensorsDemoToggle');
const newSensorButton = document.querySelector('#newSensorButton');

init();

async function init() {
  const status = await ensureConfigured();
  showSetupLinks(status.setupRequired);
  if (status.setupRequired) {
    return;
  }

  form.addEventListener('submit', handleSubmit);
  refreshButton.addEventListener('click', () => {
    flash('I sensori reali saranno visibili non appena collegati al broker.', 'info');
  });
  demoToggleButton.addEventListener('click', toggleDemoMode);
  newSensorButton.addEventListener('click', () => {
    form.scrollIntoView({ behavior: 'smooth' });
    form.sensorName.focus();
  });

  renderTable();
}

function handleSubmit(event) {
  event.preventDefault();
  const payload = {
    name: form.sensorName.value.trim(),
    topic: form.sensorTopic.value.trim(),
    unit: form.sensorUnit.value.trim(),
    icon: form.sensorIcon.value.trim() || defaultIcon(form.sensorType.value),
    type: form.sensorType.value,
    description: form.sensorDescription.value.trim(),
    threshold: form.sensorThreshold.value ? Number(form.sensorThreshold.value) : undefined,
    demo: form.sensorDemoData.checked,
  };

  if (!payload.name || !payload.topic) {
    flash('Nome e topic sono obbligatori.', 'danger');
    return;
  }

  if (state.useDemo || payload.demo) {
    addDemoSensor(payload);
    flash('Sensore demo aggiunto. Collegalo a un topic reale per live data.', 'success');
    form.reset();
  } else {
    flash('Per sensori reali collega il topic su MQTT. Qui visualizzi solo lo schema.', 'info');
  }
}

function addDemoSensor(sensor) {
  const id = crypto.randomUUID();
  state.sensors.push({ ...sensor, id });
  renderTable();
}

function toggleDemoMode() {
  state.useDemo = !state.useDemo;
  updateDemoToggleButton();
  renderTable();
  flash(state.useDemo ? 'Demo attiva: puoi inserire sensori fittizi.' : 'Demo disattivata.', state.useDemo ? 'success' : 'info');
}

function renderTable() {
  tableBody.innerHTML = '';
  const data = state.useDemo ? (state.sensors.length ? state.sensors : defaultDemoSensors()) : [];

  if (!data.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="7" class="text-center p-4 text-muted">Nessun sensore configurato.</td>';
    tableBody.appendChild(emptyRow);
    return;
  }

  data.forEach((sensor) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(sensor.name)}</td>
      <td><code>${escapeHtml(sensor.topic)}</code></td>
      <td>${escapeHtml(sensor.unit || '-')}</td>
      <td><i class="${escapeHtml(sensor.icon)}"></i></td>
      <td>${escapeHtml(sensor.type)}</td>
      <td>${sensor.threshold ?? '-'}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger" data-id="${sensor.id}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    row.querySelector('button').addEventListener('click', () => removeSensor(sensor.id));
    tableBody.appendChild(row);
  });
}

function removeSensor(id) {
  state.sensors = state.sensors.filter((sensor) => sensor.id !== id);
  renderTable();
}

function defaultIcon(type) {
  const mapping = {
    temperature: 'fa-solid fa-temperature-half',
    humidity: 'fa-solid fa-droplet',
    presence: 'fa-solid fa-person-walking',
  };
  return mapping[type] || 'fa-solid fa-puzzle-piece';
}

function defaultDemoSensors() {
  return [
    {
      id: 'demo-temp-1',
      name: 'Demo temperatura',
      topic: 'gateway/demo/temperature',
      unit: '°C',
      icon: defaultIcon('temperature'),
      type: 'temperature',
      description: 'Sensore demo temperatura ambiente',
      threshold: 28,
    },
    {
      id: 'demo-hum-1',
      name: 'Demo umidità',
      topic: 'gateway/demo/humidity',
      unit: '%',
      icon: defaultIcon('humidity'),
      type: 'humidity',
      description: 'Sensore demo umidità serra',
      threshold: 60,
    },
  ];
}

function updateDemoToggleButton() {
  if (state.useDemo) {
    demoToggleButton.classList.remove('btn-outline-success');
    demoToggleButton.classList.add('btn-success');
    demoToggleButton.innerHTML = '<i class="fa-solid fa-toggle-off"></i> Disattiva demo';
  } else {
    demoToggleButton.classList.remove('btn-success');
    demoToggleButton.classList.add('btn-outline-success');
    demoToggleButton.innerHTML = '<i class="fa-solid fa-vial"></i> Attiva demo';
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
  }, 3500);
}
