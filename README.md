# Tecnologie Web – Gateway MQTT

Repository ufficiale per il progetto di Tecnologie Web. L'applicazione espone un gateway che si occupa di trasformare messaggi HTTP/WebSocket in eventi MQTT e viceversa, offrendo anche una dashboard minimale per monitorare il traffico.

## Stack

- **Backend**: Flask (API REST + WebSocket raw), MongoDB, JWT, bridge MQTT
- **Frontend**: HTML minimale basato su Bootstrap 5, JavaScript vanilla serviti da Nginx
- **Infrastruttura**: Docker, Docker Compose, Nginx reverse proxy, broker Eclipse Mosquitto

## Struttura del progetto

- `services/api`: codice del backend Flask modulare (auth, MQTT, WebSocket, servizi)
- `frontend`: asset statici e Dockerfile di Nginx per servire l'interfaccia
- `docker-compose.yml`: orchestrazione completa (MongoDB, backend, frontend)

> Nota: il gateway si aspetta un broker MQTT già disponibile in rete. Configura host/porta dal wizard iniziale oppure tramite variabili d'ambiente.
- `.env.example`: variabili d'ambiente richieste dal backend

## Avvio rapido

1. Copia il file `.env.example` in `.env` e personalizza valori sensibili (`SECRET_KEY`, `JWT_SECRET_KEY`, ecc.).
2. Avvia lo stack con Docker Compose:

   ```bash
   docker compose build
   docker compose up
   ```

3. Visita [http://localhost:8080/setup.html](http://localhost:8080/setup.html) per la configurazione guidata:
   - inserisci email/password dell'amministratore
   - imposta i parametri del broker MQTT (opzionali)
   - decidi se avviare la modalità demo
   - salva e verrai reindirizzato alla dashboard

La procedura salva l'utente admin nel database MongoDB e memorizza i parametri MQTT. Puoi rieseguirla in ogni momento tramite il link “Prima configurazione” nel menu laterale.

## API principali

- `POST /api/auth/login` — restituisce un JWT da usare nel header `Authorization: Bearer <token>`.
- `GET /api/status/` — health check pubblico.
- `GET /api/status/me` — dati utente attuale (JWT necessario).
- `GET /api/messages?limit=25` — ultimi messaggi MQTT registrati.
- `POST /api/messages` — pubblica un messaggio su MQTT (richiede body `{ topic?, payload }`).
- `GET /api/sensors` — elenco sensori configurati.
- `POST /api/sensors` — crea un nuovo sensore (nome, topic, unità, icona, soglia, ecc.).
- `PUT /api/sensors/:id` — aggiorna un sensore esistente.
- `DELETE /api/sensors/:id` — rimuove un sensore.

Il websocket è esposto su `/ws` e accetta la connessione con querystring `?token=<JWT>`. Il payload atteso è JSON del tipo:

```json
{
  "action": "publish",
  "topic": "gateway/out",
  "payload": { "example": true }
}
```

In ricezione vengono inviati messaggi JSON con `type` (`connected`, `mqtt_message`, `publish_ack`, `error`).

## Note progettuali

- Persistenza messaggi in MongoDB (`messages`) con timestamp, topic, direzione e payload (anche raw).
- Bridge MQTT asincrono basato su `paho-mqtt` con broadcasting verso i client WebSocket.
- Architettura modulare: separazione per auth, servizi, modelli, MQTT, websocket.
- Documentazione aggiuntiva in `docs/` per dettaglio architetturale e flussi.

### Seeding utenti

- Per garantire l'utente di default usa lo script incluso nell'immagine backend:

  ```bash
  docker compose run --rm backend python scripts/seed_user.py --ensure-default
  ```

- Per creare un utente specifico:

  ```bash
  docker compose run --rm backend \
    python scripts/seed_user.py --email nuovo@esempio.com --password supersegreta --roles user
  ```

### Test rapido interfaccia web

Per provare la parte web (login + dashboard) è sufficiente avviare backend, frontend e MongoDB:

```bash
docker compose up --build frontend backend mongo
```

Collega il backend al tuo broker MQTT (interno o esterno) dal wizard di setup per testare l'inoltro dei messaggi.

### Modalità demo (solo frontend, nessun backend)

Se ti serve soltanto mostrare l'interfaccia senza connettività verso l'API puoi avviare solo Nginx:

```bash
docker compose up --build frontend
```

Poi apri [http://localhost:8080?demo=1](http://localhost:8080?demo=1) e usa qualsiasi credenziale: il login abilita dati fittizi e una simulazione delle notifiche MQTT.

## Studente

- Ivan Cafiero — matricola `0124003383`
