import { MongoClient, ObjectId } from 'mongodb';

let client;
let database;

async function connectMongo(uri, dbName) {
  if (database) {
    return database;
  }
  client = new MongoClient(uri);
  await client.connect();
  database = client.db(dbName);
  await ensureIndexes();
  return database;
}

function getDb() {
  if (!database) {
    throw new Error('Database not initialized');
  }
  return database;
}

function collection(name) {
  return getDb().collection(name);
}

async function ensureIndexes() {
  const users = collection('users');
  const sensors = collection('sensors');
  const messages = collection('messages');
  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    sensors.createIndex({ topic: 1 }, { unique: true }),
    messages.createIndex({ received_at: -1 }),
  ]);
}

export { connectMongo, collection, ObjectId };
