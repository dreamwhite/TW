import { collection, ObjectId } from '../db.js';

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
    created_at: now,
    updated_at: now,
  };
  const result = await collection('sensors').insertOne(document);
  document._id = result.insertedId;
  return normalize(document);
}

async function updateSensor(id, payload) {
  let objectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return null;
  }

  const updates = { updated_at: new Date() };
  ['name', 'topic', 'unit', 'icon', 'type', 'description', 'threshold'].forEach((key) => {
    if (payload[key] !== undefined) {
      updates[key] = payload[key];
    }
  });

  const result = await collection('sensors').findOneAndUpdate(
    { _id: objectId },
    { $set: updates },
    { returnDocument: 'after' },
  );

  return normalize(result.value);
}

async function deleteSensor(id) {
  let objectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return false;
  }
  const result = await collection('sensors').deleteOne({ _id: objectId });
  return result.deletedCount > 0;
}

async function getSensor(id) {
  let objectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return null;
  }
  const doc = await collection('sensors').findOne({ _id: objectId });
  return normalize(doc);
}

export { listSensors, createSensor, updateSensor, deleteSensor, getSensor };
