import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { config } from './config.js';
import { connectMongo } from './db.js';
import { startBridge } from './mqttBridge.js';
import authRoutes from './routes/auth.js';
import messagesRoutes from './routes/messages.js';
import sensorsRoutes from './routes/sensors.js';
import setupRoutes from './routes/setup.js';
import statusRoutes from './routes/status.js';
import { ensureDefaultAdmin } from './services/userService.js';
import { ensureSetupDocument, fetchSettings } from './services/settingsService.js';

// Bootstrap sequenziale: DB -> setup -> MQTT -> server HTTP
async function bootstrap() {
  await connectMongo(config.mongoUri, config.mongoDbName);
  await ensureSetupDocument();
  await ensureDefaultAdmin();

  const settings = await fetchSettings();
  if (!settings.configured) {
    console.warn('Setup non completato: vai su /setup.html per configurare admin e MQTT');
  } else {
    const mqttConfig = { ...config.mqtt };
    if (settings.mqtt_host) mqttConfig.host = settings.mqtt_host;
    if (settings.mqtt_port) mqttConfig.port = settings.mqtt_port;
    if (settings.mqtt_username) mqttConfig.username = settings.mqtt_username;
    if (settings.mqtt_password) mqttConfig.password = settings.mqtt_password;
    if (settings.mqtt_client_id) mqttConfig.clientId = settings.mqtt_client_id;
    config.mqtt = mqttConfig;
    startBridge(mqttConfig);
  }

  const app = express();
  app.use(
    cors({
      origin: config.corsAllowedOrigins.includes('*') ? true : config.corsAllowedOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('dev'));

  // Routing REST
  app.use('/api/auth', authRoutes);
  app.use('/api/status', statusRoutes);
  app.use('/api/messages', messagesRoutes);
  app.use('/api/sensors', sensorsRoutes);
  // Mount setup also at /setup for dev proxies that strip /api
  app.use(['/api/setup', '/setup'], setupRoutes);

  // Fallback error handler minimale
  app.use((err, _req, res, _next) => {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(config.port, () => {
    console.log(`API running on port ${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});
