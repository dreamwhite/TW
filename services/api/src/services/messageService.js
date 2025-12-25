import { collection } from '../db.js';

// Tenta di trasformare la stringa in JSON, altrimenti lascia raw
function parsePayload(payload) {
  if (typeof payload !== 'string') {
    return payload;
  }
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

// Normalizzazione per la risposta API
function normalize(doc) {
  const normalized = {
    direction: doc.direction,
    topic: doc.topic,
    payload: doc.payload,
    raw_payload: doc.raw_payload,
    received_at: doc.received_at instanceof Date ? doc.received_at.toISOString() : doc.received_at,
  };
  if (doc.meta) {
    normalized.meta = doc.meta;
  }
  return normalized;
}

// Salva un messaggio (inbound/outbound) nel log Mongo
async function logMessage({ direction, topic, payload, meta }) {
  const normalizedPayload = parsePayload(payload);
  const rawPayload =
    typeof payload === 'string'
      ? payload
      : payload !== undefined
        ? JSON.stringify(payload)
        : '';

  const document = {
    direction,
    topic,
    payload: normalizedPayload,
    raw_payload: rawPayload,
    received_at: new Date(),
    ...(meta ? { meta } : {}),
  };
  await collection('messages').insertOne(document);
  return normalize(document);
}

async function latest(limit = 50) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
  const cursor = collection('messages').find().sort({ received_at: -1 }).limit(safeLimit);
  const items = await cursor.toArray();
  return items.map(normalize);
}

export { logMessage, latest };
