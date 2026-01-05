import express from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { startBridge } from '../mqttBridge.js';
import { fetchSettings, upsertSettings } from '../services/settingsService.js';

const router = express.Router();

function mergeConfig(stored) {
  const merged = { ...config.mqtt };
  if (stored.mqtt_host !== undefined) merged.host = stored.mqtt_host;
  if (stored.mqtt_port !== undefined) merged.port = stored.mqtt_port;
  if (stored.mqtt_username !== undefined) merged.username = stored.mqtt_username;
  if (stored.mqtt_password !== undefined) merged.password = stored.mqtt_password;
  if (stored.mqtt_client_id !== undefined) merged.clientId = stored.mqtt_client_id;
  if (stored.mqtt_subscribe_topic !== undefined) merged.subscribeTopic = stored.mqtt_subscribe_topic;
  if (stored.mqtt_publish_topic !== undefined) merged.publishTopic = stored.mqtt_publish_topic;
  if (stored.mqtt_control_topic !== undefined) merged.controlTopic = stored.mqtt_control_topic;
  if (stored.mqtt_qos !== undefined && stored.mqtt_qos !== null) merged.qos = stored.mqtt_qos;
  return merged;
}

function serialize(stored, merged) {
  return {
    configured: !!stored.configured,
    mqtt_host: merged.host,
    mqtt_port: merged.port,
    mqtt_username: merged.username || '',
    mqtt_client_id: merged.clientId || '',
    mqtt_subscribe_topic: merged.subscribeTopic || '',
    mqtt_publish_topic: merged.publishTopic || '',
    mqtt_control_topic: merged.controlTopic || '',
    mqtt_qos: merged.qos,
    has_password: !!merged.password,
  };
}

router.get('/mqtt', requireAuth, requireAdmin, async (_req, res) => {
  const stored = await fetchSettings();
  const merged = mergeConfig(stored);
  res.json(serialize(stored, merged));
});

router.put('/mqtt', requireAuth, requireAdmin, async (req, res) => {
  const body = req.body || {};
  const errors = {};

  const host = (body.mqtt_host || '').trim();
  const port = body.mqtt_port !== undefined ? Number(body.mqtt_port) : undefined;
  const qos = body.mqtt_qos !== undefined ? Number(body.mqtt_qos) : undefined;

  if (!host) errors.mqtt_host = 'MQTT host is required';
  if (port === undefined || Number.isNaN(port) || port <= 0) errors.mqtt_port = 'MQTT port is not valid';
  if (qos !== undefined && (Number.isNaN(qos) || !Number.isInteger(qos) || qos < 0 || qos > 2)) {
    errors.mqtt_qos = 'QoS must be 0, 1, or 2';
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({ errors });
  }

  const toStore = {
    configured: true,
    mqtt_host: host,
    mqtt_port: port,
    mqtt_username: body.mqtt_username !== undefined ? (body.mqtt_username || '').trim() : undefined,
    mqtt_password: body.mqtt_password !== undefined ? body.mqtt_password : undefined,
    mqtt_client_id: body.mqtt_client_id !== undefined ? (body.mqtt_client_id || '').trim() : undefined,
    mqtt_subscribe_topic:
      body.mqtt_subscribe_topic !== undefined ? (body.mqtt_subscribe_topic || '').trim() : undefined,
    mqtt_publish_topic: body.mqtt_publish_topic !== undefined ? (body.mqtt_publish_topic || '').trim() : undefined,
    mqtt_control_topic: body.mqtt_control_topic !== undefined ? (body.mqtt_control_topic || '').trim() : undefined,
    mqtt_qos: qos,
  };

  await upsertSettings(toStore);
  const stored = await fetchSettings();
  const merged = mergeConfig(stored);
  config.mqtt = merged;
  startBridge(merged);

  return res.json(serialize(stored, merged));
});

export default router;
