import express from 'express';
import { config } from '../config.js';
import { startBridge } from '../mqttBridge.js';
import { hasUsers, createUser, findByEmail } from '../services/userService.js';
import { fetchSettings, upsertSettings } from '../services/settingsService.js';

const router = express.Router();

router.get('/status', async (_req, res) => {
  const settings = await fetchSettings();
  const ready = settings.configured && (await hasUsers());
  res.json({ configured: ready });
});

router.post('/', async (req, res) => {
  const payload = req.body || {};
  const adminEmail = (payload.admin_email || '').trim().toLowerCase();
  const adminPassword = payload.admin_password || '';

  if (!adminEmail || !adminPassword) {
    return res.status(400).json({ error: 'Email e password amministratore sono obbligatorie' });
  }

  const mqttConfig = {
    host: payload.mqtt_host || config.mqtt.host,
    port: payload.mqtt_port ? Number(payload.mqtt_port) : config.mqtt.port,
    username: payload.mqtt_username || config.mqtt.username,
    password: payload.mqtt_password || config.mqtt.password,
    clientId: config.mqtt.clientId,
    subscribeTopic: config.mqtt.subscribeTopic,
    publishTopic: config.mqtt.publishTopic,
    qos: config.mqtt.qos,
  };

  await upsertSettings({
    configured: true,
    mqtt_host: mqttConfig.host,
    mqtt_port: mqttConfig.port,
    mqtt_username: mqttConfig.username,
    mqtt_client_id: mqttConfig.clientId,
  });

  const existing = await findByEmail(adminEmail);
  if (!existing) {
    await createUser({ email: adminEmail, password: adminPassword, roles: ['admin'] });
  }

  config.mqtt = mqttConfig;
  startBridge(mqttConfig);

  return res.json({ configured: true });
});

export default router;
