# Architettura del Gateway

## Panoramica

- Lo stack è composto da quattro container principali orchestrati tramite Docker Compose:

- **frontend** (Nginx): serve l'interfaccia statica e funge da reverse proxy per le API REST (`/api`).
- **backend** (Express): espone API JSON con autenticazione JWT e incapsula la logica di bridge con il broker MQTT.
- **mongo** (MongoDB): storage persistente di utenti e log dei messaggi transitati (bind mount `./data/mongo`).
- **mongo-express**: pannello web per esplorare il database (porta 8081, basic auth admin/admin).

Il broker MQTT non è incluso nello stack Compose: il gateway si collega a un'istanza esistente, configurabile dal wizard iniziale.

Porte di default:
- Frontend/proxy: 8080
- Backend diretto: 5001 (mappa la 5000 interna)
- Mongo: 27017 (persistenza su `data/mongo`)
- Mongo Express: 8081

## Moduli backend

```
services/api/src
├── config.js         # Lettura env + default
├── db.js             # Connessione Mongo e indici
├── mqttBridge.js     # MQTT client (mqtt.js) con log automatico
├── middleware/       # requireAuth/requireAdmin per JWT
├── routes/           # Auth, status, setup, messages, sensors
└── services/         # Helper per utenti, sensori, messaggi, settings
```

- AuthService (funzioni) garantisce un utente admin al bootstrap e gestisce i JWT.
- MessageService centralizza la persistenza dei messaggi con index su `received_at`.
- MQTTBridge mantiene la connessione verso Mosquitto, iscrive ai topic in ascolto e registra i messaggi in Mongo.
- Settings/Setup salvano le info di configurazione (stato wizard, parametri MQTT) in MongoDB.
- Sensors API forniscono CRUD sui sensori configurati (nome, topic, unità, soglie).

## Flussi principali

### Autenticazione
1. Il client effettua `POST /api/auth/login` con credenziali.
2. Il backend valida l'utente tramite Mongo e ritorna un JWT.
3. Il token viene usato nelle chiamate successive (`Authorization: Bearer …`).

### Pubblicazione da interfaccia Web
1. L'utente autenticato invia un messaggio dal form.
2. Il browser invia una richiesta REST `POST /api/messages`.
3. Il backend valida il token, pubblica su MQTT (`mqtt.js`) e registra l'evento in Mongo.
4. Il broker recapita il messaggio ad eventuali subscriber; il backend salva comunque il log per la consultazione.

### Messaggi in arrivo da MQTT
1. `MQTTBridge` riceve un payload dal topic configurato.
2. Il messaggio viene normalizzato e salvato in Mongo (con direzione `inbound`).
3. Il frontend può recuperare gli ultimi messaggi via `GET /api/messages`.

## Sicurezza

- Tutte le chiamate protette richiedono JWT firmato (`HS256`).
- Mongo e Mosquitto sono esposti solo in locale (porte mappate per sviluppo, disattivabili in produzione).
- Le chiavi applicative sono esternalizzate in `.env`.

## Estensioni future

- Introduzione di ruoli granulari (già supportati nel JWT) per autorizzare azioni specifiche.
- Persistenza e dashboard più avanzate (filtri per topic, statistiche).
- Integrazione con certificati TLS per Nginx / MQTT in ambienti non locali.
- Migliorare il wizard di setup con validazione avanzata e test connessione MQTT.
- Persistenza di layout avanzati e raggruppamenti di sensori con viewer real-time.
