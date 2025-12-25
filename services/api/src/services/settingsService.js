import { collection } from '../db.js';

const SETTINGS_ID = 'global';

async function fetchSettings() {
  const doc = await collection('settings').findOne({ _id: SETTINGS_ID });
  if (!doc) {
    return { configured: false };
  }
  return {
    configured: !!doc.configured,
    mqtt_host: doc.mqtt_host,
    mqtt_port: doc.mqtt_port,
    mqtt_username: doc.mqtt_username,
    mqtt_client_id: doc.mqtt_client_id,
  };
}

async function upsertSettings(payload) {
  const toStore = {
    configured: payload.configured ?? false,
    mqtt_host: payload.mqtt_host,
    mqtt_port: payload.mqtt_port,
    mqtt_username: payload.mqtt_username,
    mqtt_client_id: payload.mqtt_client_id,
  };
  Object.keys(toStore).forEach((key) => {
    if (toStore[key] === undefined) {
      delete toStore[key];
    }
  });

  await collection('settings').updateOne(
    { _id: SETTINGS_ID },
    { $set: toStore },
    { upsert: true },
  );
  return fetchSettings();
}

async function ensureSetupDocument() {
  const doc = await collection('settings').findOne({ _id: SETTINGS_ID });
  if (!doc) {
    await upsertSettings({ configured: false });
  }
}

export { fetchSettings, upsertSettings, ensureSetupDocument };
