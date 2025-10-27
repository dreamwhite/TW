# Architettura del Gateway

## Panoramica

Lo stack è composto da quattro container principali orchestrati tramite Docker Compose:

- **frontend** (Nginx): serve l'interfaccia statica e funge da reverse proxy per API REST e WebSocket (`/api` e `/ws`).
- **backend** (Flask): espone API JSON con autenticazione JWT, gestisce le sessioni WebSocket e incapsula la logica di bridge con il broker MQTT.
- **mqtt** (Eclipse Mosquitto): broker MQTT minimal configurato per l'uso in locale.
- **mongo** (MongoDB): storage persistente di utenti e log dei messaggi transitati.

Tutti i servizi condividono la stessa rete interna Docker; solo il frontend espone porte verso l'esterno (`8080`).

## Moduli backend

```
services/api/app
├── auth/          # Registrazione, login, gestione JWT
├── mqtt/          # Client MQTT (paho-mqtt) e logica di subscribe/publish
├── routes/        # Blueprint REST (status, messages)
├── services/      # Servizi applicativi (es. log messaggi su Mongo)
├── websocket/     # Hub connessioni WebSocket e routing (flask-sock)
└── extensions.py  # Inizializzazione componenti (Mongo, JWT, Sock)
```

- **AuthService** garantisce un utente admin al bootstrap e gestisce la generazione dei token.
- **MessageService** centralizza la persistenza dei messaggi con index su `received_at`.
- **MQTTBridge** mantiene la connessione verso Mosquitto, iscrive ai topic in ascolto e notifica l'hub WebSocket su messaggi in ingresso.
- **WebSocketHub** gestisce le connessioni WebSocket attive (JWT richiesto via query string) e instrada i messaggi pubblicati verso MQTT.
- **SettingsRepository/SetupService** memorizzano lo stato di configurazione iniziale in MongoDB e permettono di impostare utente admin e parametri MQTT al primo avvio.

## Flussi principali

### Autenticazione
1. Il client effettua `POST /api/auth/login` con credenziali.
2. Il backend valida l'utente tramite Mongo e ritorna un JWT.
3. Il token viene usato nelle chiamate successive (`Authorization: Bearer …`) e nella query di connessione WebSocket (`/ws?token=…`).

### Pubblicazione da interfaccia Web
1. L'utente autenticato invia un messaggio dal form.
2. Il browser invia un frame JSON sul socket (`{"action":"publish", …}`).
3. Il backend valida il token associato alla connessione, pubblica su MQTT (`paho-mqtt`) e registra l'evento in Mongo.
4. Il broker recapita il messaggio ad eventuali subscriber, incluso il backend stesso che lo ribalta ai client connessi (broadcast `mqtt_message`).

### Messaggi in arrivo da MQTT
1. `MQTTBridge` riceve un payload dal topic configurato.
2. Il messaggio viene normalizzato, salvato in Mongo e passato all'hub tramite `broadcast`.
3. Ogni WebSocket aperto riceve un evento `mqtt_message` con topic, payload e timestamp.

## Sicurezza

- Tutte le chiamate protette richiedono JWT firmato (`HS256`).
- Il WebSocket accetta solo connessioni con token valido nella query string.
- Mongo e Mosquitto sono esposti solo in locale (porte mappate per sviluppo, disattivabili in produzione).
- Le chiavi applicative sono esternalizzate in `.env`.

## Estensioni future

- Introduzione di ruoli granulari (già supportati nel JWT) per autorizzare azioni specifiche.
- Persistenza e dashboard più avanzate (filtri per topic, statistiche).
- Integrazione con certificati TLS per Nginx / MQTT in ambienti non locali.
- Migliorare il wizard di setup con validazione avanzata e test connessione MQTT.
