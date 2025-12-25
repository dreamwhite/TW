import { MongoClient, ObjectId } from 'mongodb';

let client;
let database;

// Inizializza la connessione Mongo una sola volta e prepara gli indici
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

// Recupera il DB attivo (errori chiari se non è stato inizializzato)
function getDb() {
  if (!database) {
    throw new Error('Database not initialized');
  }
  return database;
}

// Helper rapido per ottenere una collection
function collection(name) {
  return getDb().collection(name);
}

// Indici minimi per vincoli e performance
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
