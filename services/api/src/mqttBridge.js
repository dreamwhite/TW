import mqtt from 'mqtt';
import { config } from './config.js';
import { logMessage } from './services/messageService.js';

let client;
let currentConfig = { ...config.mqtt };

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
    client.subscribe(subscribeTopic, { qos }, (err) => {
      if (err) {
        console.error('MQTT subscribe error:', err.message);
      } else {
        console.log(`MQTT connected. Subscribed to ${subscribeTopic}`);
      }
    });
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

export { startBridge, publish, getCurrentConfig };
