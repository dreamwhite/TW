import dotenv from 'dotenv';

dotenv.config();

const parseNumber = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const config = {
  port: parseNumber(process.env.PORT, 5000),
  secret: process.env.SECRET_KEY || 'change-me',
  jwtSecret: process.env.JWT_SECRET_KEY || 'change-me-too',
  jwtExpiresIn: parseNumber(process.env.JWT_ACCESS_TOKEN_EXPIRES, 900),
  mongoUri: process.env.MONGO_URI || 'mongodb://mongo:27017',
  mongoDbName: process.env.MONGO_DB_NAME || 'gateway',
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '*')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  defaults: {
    adminEmail: process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com',
    adminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
  },
  mqtt: {
    host: process.env.MQTT_BROKER_HOST || 'mqtt',
    port: parseNumber(process.env.MQTT_BROKER_PORT, 1883),
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    clientId: process.env.MQTT_CLIENT_ID || 'web-gateway',
    subscribeTopic: process.env.MQTT_SUBSCRIBE_TOPIC || 'gateway/in/#',
    publishTopic: process.env.MQTT_PUBLISH_TOPIC || 'gateway/out',
    qos: parseNumber(process.env.MQTT_QOS, 1),
  },
};
