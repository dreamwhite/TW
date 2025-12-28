import mqtt from 'mqtt';
import { config } from './config.js';
import { logMessage } from './services/messageService.js';

let client;
let currentConfig = { ...config.mqtt };
let sensorTopics = new Set();

function normalizeTopic(topic) {
  const trimmed = (topic || '').trim();
  return trimmed || null;
}

function subscribeTopics(topics, { force = false } = {}) {
  const qos = currentConfig.qos ?? 1;
  if (!client || !client.connected) {
    // Verrà rieseguito al prossimo connect
    return;
  }
  (topics || []).forEach((raw) => {
    const topic = normalizeTopic(raw);
    if (!topic) return;
    if (!force && sensorTopics.has(topic)) return;
    client.subscribe(topic, { qos }, (err) => {
      if (err) {
        console.error(`MQTT subscribe error on ${topic}:`, err.message);
      } else {
        console.log(`MQTT subscribed to sensor topic ${topic}`);
        sensorTopics.add(topic);
      }
    });
  });
}

function unsubscribeTopics(topics) {
  if (!client || !client.connected) {
    topics.forEach((raw) => {
      const topic = normalizeTopic(raw);
      if (topic) sensorTopics.delete(topic);
    });
    return;
  }
  topics.forEach((raw) => {
    const topic = normalizeTopic(raw);
    if (!topic || !sensorTopics.has(topic)) return;
    client.unsubscribe(topic, (err) => {
      if (err) {
        console.error(`MQTT unsubscribe error on ${topic}:`, err.message);
      } else {
        sensorTopics.delete(topic);
        console.log(`MQTT unsubscribed from sensor topic ${topic}`);
      }
    });
  });
}

// Sincronizza i topic dei sensori (list load a startup o aggiornamenti massivi)
function syncSensorTopics(topics = []) {
  const normalized = new Set();
  topics.forEach((raw) => {
    const topic = normalizeTopic(raw);
    if (topic) normalized.add(topic);
  });

  const toRemove = [...sensorTopics].filter((t) => !normalized.has(t));
  const toAdd = [...normalized].filter((t) => !sensorTopics.has(t));

  if (toRemove.length) unsubscribeTopics(toRemove);
  if (toAdd.length) subscribeTopics(toAdd);

  sensorTopics = normalized;
}

function addSensorSubscription(topic) {
  const normalized = normalizeTopic(topic);
  if (!normalized) return;
  if (sensorTopics.has(normalized)) return;
  sensorTopics.add(normalized);
  subscribeTopics([normalized]);
}

function removeSensorSubscription(topic) {
  const normalized = normalizeTopic(topic);
  if (!normalized) return;
  if (!sensorTopics.has(normalized)) return;
  unsubscribeTopics([normalized]);
}

// Avvia (o riavvia) il bridge MQTT usando config di base + override dal setup
function startBridge(overrideConfig = {}) {
  currentConfig = { ...currentConfig, ...overrideConfig };

  if (client) {
    client.end(true);
    client = null;
  }

  const { host, port, username, password, clientId, subscribeTopic, qos } = currentConfig;
  const url = `mqtt://${host}:${port}`;

  client = mqtt.connect(url, {
    clientId,
    username: username || undefined,
    password: password || undefined,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    const qos = currentConfig.qos ?? 1;
    if (subscribeTopic) {
      client.subscribe(subscribeTopic, { qos }, (err) => {
        if (err) {
          console.error('MQTT subscribe error:', err.message);
        } else {
          console.log(`MQTT connected. Subscribed to ${subscribeTopic}`);
        }
      });
    } else {
      console.log('MQTT connected. Nessun topic globale configurato, uso solo quelli dei sensori.');
    }

    // Re-iscrizione ai topic dei sensori (utile dopo reconnect)
    if (sensorTopics.size) {
      subscribeTopics([...sensorTopics], { force: true });
    }
  });

  // Logga ogni messaggio in ingresso per la dashboard
  client.on('message', async (topic, payloadBuffer) => {
    const payload = payloadBuffer.toString();
    try {
      await logMessage({
        direction: 'inbound',
        topic,
        payload,
        meta: { qos },
      });
    } catch (error) {
      console.error('Failed to log inbound MQTT message:', error.message);
    }
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err.message);
  });

  client.on('close', () => {
    console.warn('MQTT connection closed');
  });
}

// Pubblica su MQTT e registra l'evento in Mongo
async function publish(topic, payload, meta = {}) {
  const qos = currentConfig.qos ?? 1;
  let payloadToSend = payload;
  if (typeof payload === 'object') {
    payloadToSend = JSON.stringify(payload);
  }

  if (client && client.connected) {
    client.publish(topic, payloadToSend, { qos });
  } else {
    console.warn('MQTT client not connected, skipping publish');
  }

  await logMessage({
    direction: 'outbound',
    topic,
    payload: payloadToSend,
    meta,
  });
}

function getCurrentConfig() {
  return currentConfig;
}

export {
  startBridge,
  publish,
  getCurrentConfig,
  syncSensorTopics,
  addSensorSubscription,
  removeSensorSubscription,
};
