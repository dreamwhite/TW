import dotenv from 'dotenv';

// Carica le variabili d'ambiente definite in .env (comodo in locale)
dotenv.config();

// Parsing numerico con fallback semplice
const parseNumber = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

// Configurazione centralizzata dell'API
export const config = {
  // Porta HTTP per Express
  port: parseNumber(process.env.PORT, 5000),
  // Segreto per firmare/verificare i JWT
  jwtSecret: process.env.JWT_SECRET_KEY || 'change-me-too',
  jwtExpiresIn: parseNumber(process.env.JWT_ACCESS_TOKEN_EXPIRES, 900),
  // Parametri MongoDB
  mongoUri: process.env.MONGO_URI || 'mongodb://mongo:27017',
  mongoDbName: process.env.MONGO_DB_NAME || 'gateway',
  // Origini consentite per il CORS
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '*')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  // Credenziali di default per l'admin (solo bootstrap)
  defaults: {
    adminEmail: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com',
    adminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
  },
  // Parametri MQTT di base; possono essere sovrascritti dal setup salvato su Mongo
  mqtt: {
    host: process.env.MQTT_BROKER_HOST || 'mqtt',
    port: parseNumber(process.env.MQTT_BROKER_PORT, 1883),
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    clientId: process.env.MQTT_CLIENT_ID || 'web-gateway',
    // Lasciato vuoto di default: i topic dei sensori vengono sottoscritti dinamicamente.
    subscribeTopic: process.env.MQTT_SUBSCRIBE_TOPIC || '',
    publishTopic: process.env.MQTT_PUBLISH_TOPIC || 'gateway/out',
    controlTopic: process.env.MQTT_CONTROL_TOPIC || '/threshold',
    qos: parseNumber(process.env.MQTT_QOS, 1),
  },
};
