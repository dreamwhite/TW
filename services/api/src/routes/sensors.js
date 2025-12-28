import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createSensor, deleteSensor, listSensors, updateSensor, getSensor } from '../services/sensorService.js';
import { latestByTopic } from '../services/messageService.js';
import { addSensorSubscription, removeSensorSubscription, syncSensors } from '../mqttBridge.js';

// CRUD sensori configurati
const router = express.Router();

function validatePayload(payload, creating) {
  const errors = {};

  if (creating) {
    if (!payload.name) errors.name = 'Il nome è obbligatorio';
    if (!payload.topic) errors.topic = 'Il topic MQTT è obbligatorio';
  } else {
    if ('name' in payload && !payload.name) errors.name = 'Il nome non può essere vuoto';
    if ('topic' in payload && !payload.topic) errors.topic = 'Il topic non può essere vuoto';
  }

  if ('threshold' in payload) {
    const value = payload.threshold;
    if (value !== undefined && value !== null && Number.isNaN(Number(value))) {
      errors.threshold = 'La soglia deve essere numerica';
    } else if (value !== undefined && value !== null) {
      payload.threshold = Number(value);
    }
  }

  return errors;
}

router.get('/', requireAuth, async (_req, res) => {
  const items = await listSensors();
  res.json({ items });
});

// Forza la risottoscrizione ai topic dei sensori (utile dopo modifiche/config)
router.post('/resubscribe', requireAuth, async (_req, res) => {
  const items = await listSensors();
  syncSensors(items);
  res.json({ status: 'ok', subscribed: items.length });
});

router.post('/', requireAuth, async (req, res) => {
  const payload = req.body || {};
  const errors = validatePayload(payload, true);
  if (Object.keys(errors).length) {
    return res.status(400).json({ errors });
  }

  try {
    const sensor = await createSensor(payload);
    addSensorSubscription(sensor.topic);
    const items = await listSensors();
    syncSensors(items);
    return res.status(201).json(sensor);
  } catch (error) {
    console.error('Sensor creation error:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const payload = req.body || {};
  const errors = validatePayload(payload, false);
  if (Object.keys(errors).length) {
    return res.status(400).json({ errors });
  }

  const existing = await getSensor(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Sensore non trovato' });
  }

  const updated = await updateSensor(req.params.id, payload);
  if (!updated) {
    return res.status(404).json({ error: 'Sensore non trovato' });
  }
  if (existing.topic !== updated.topic) {
    removeSensorSubscription(existing.topic);
    addSensorSubscription(updated.topic);
  }
  const items = await listSensors();
  syncSensors(items);
  return res.json(updated);
});

router.delete('/:id', requireAuth, async (req, res) => {
  const existing = await getSensor(req.params.id);
  const deleted = await deleteSensor(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Sensore non trovato' });
  }
  if (existing?.topic) {
    removeSensorSubscription(existing.topic);
  }
  const items = await listSensors();
  syncSensors(items);
  return res.json({ status: 'deleted' });
});

router.get('/:id/values', requireAuth, async (req, res) => {
  const sensor = await getSensor(req.params.id);
  if (!sensor) {
    return res.status(404).json({ error: 'Sensore non trovato' });
  }
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 25, 100));
  const items = await latestByTopic(sensor.topic, limit);
  return res.json({ sensor, items });
});

export default router;
