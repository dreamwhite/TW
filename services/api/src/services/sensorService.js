import { collection, ObjectId } from '../db.js';

function buildIdFilter(id) {
  const trimmed = (id || '').trim();
  if (!trimmed) return null;
  const clauses = [];
  try {
    clauses.push({ _id: new ObjectId(trimmed) });
  } catch {
    // ignore
  }
  // Sempre aggiungi anche la variante stringa (per documenti legacy o importati)
  clauses.push({ _id: trimmed });
  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

// Trasforma il documento Mongo in DTO per la dashboard
function normalize(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    name: doc.name,
    topic: doc.topic,
    unit: doc.unit || null,
    icon: doc.icon || null,
    type: doc.type || null,
    description: doc.description || null,
    threshold: doc.threshold ?? null,
    control_topic: doc.control_topic || null,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

async function listSensors() {
  const items = await collection('sensors').find().sort({ created_at: -1 }).toArray();
  return items.map(normalize);
}

async function createSensor(payload) {
  const now = new Date();
  const document = {
    name: (payload.name || '').trim(),
    topic: (payload.topic || '').trim(),
    unit: payload.unit || null,
    icon: payload.icon || null,
    type: payload.type || null,
    description: payload.description || null,
    threshold: typeof payload.threshold === 'number' ? payload.threshold : payload.threshold ?? null,
    control_topic: payload.control_topic || null,
    created_at: now,
    updated_at: now,
  };
  const result = await collection('sensors').insertOne(document);
  document._id = result.insertedId;
  return normalize(document);
}

async function updateSensor(id, payload) {
  const filter = buildIdFilter(id);
  if (!filter) return null;

  const updates = { updated_at: new Date() };
  ['name', 'topic', 'unit', 'icon', 'type', 'description', 'threshold', 'control_topic'].forEach((key) => {
    if (payload[key] !== undefined) {
      updates[key] = payload[key];
    }
  });

  const result = await collection('sensors').updateOne(filter, { $set: updates });
  if (!result.matchedCount) return null;

  const updated = await collection('sensors').findOne(filter);
  return normalize(updated);
}

async function deleteSensor(id) {
  const filter = buildIdFilter(id);
  if (!filter) return false;
  const result = await collection('sensors').deleteOne(filter);
  return result.deletedCount > 0;
}

async function getSensor(id) {
  const filter = buildIdFilter(id);
  if (!filter) return null;
  const doc = await collection('sensors').findOne(filter);
  return normalize(doc);
}

export { listSensors, createSensor, updateSensor, deleteSensor, getSensor };
