import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { latest } from '../services/messageService.js';
import { publish } from '../mqttBridge.js';
import { config } from '../config.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 25;
  const items = await latest(limit);
  res.json({ items, count: items.length });
});

router.post('/', requireAuth, async (req, res) => {
  const topic = req.body.topic || config.mqtt.publishTopic;
  const payload = req.body.payload;

  if (payload === undefined) {
    return res.status(400).json({ error: "Missing 'payload' field" });
  }

  try {
    await publish(topic, payload, { published_by: req.user.email, via: 'http' });
    return res.json({ status: 'queued', topic });
  } catch (error) {
    console.error('Publish error:', error.message);
    return res.status(500).json({ error: 'Unable to publish message' });
  }
});

export default router;
