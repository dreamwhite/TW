# Tecnologie Web – Gateway MQTT

Repository ufficiale per il progetto di Tecnologie Web. L'applicazione espone un gateway che si occupa di trasformare richieste HTTP in eventi MQTT e viceversa, offrendo anche una dashboard minimale per monitorare il traffico.

## Stack

- **Backend**: Node.js (Express), MongoDB, JWT, bridge MQTT (mqtt.js)
- **Frontend**: HTML minimale basato su Bootstrap 5, JavaScript vanilla serviti da Nginx
- **Infrastruttura**: Docker, Docker Compose, Nginx reverse proxy, broker Eclipse Mosquitto

## Struttura del progetto

- `services/api`: backend Express (auth, MQTT bridge, servizi REST)
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

   Per avvio rapido del solo backend in locale (senza Docker):

   ```bash
   cd services/api
   pnpm install
   pnpm run local
   ```

3. Visita [http://localhost:8080/setup.html](http://localhost:8080/setup.html) per la configurazione guidata:
   - inserisci email/password dell'amministratore
   - imposta i parametri del broker MQTT (opzionali)
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

## Note progettuali

- Persistenza messaggi in MongoDB (`messages`) con timestamp, topic, direzione e payload (anche raw).
- Bridge MQTT asincrono basato su `mqtt` con logging automatico dei messaggi in entrata/uscita.
- Architettura minimale: middleware Express per auth JWT, router REST, servizi per Mongo/MQTT.
- Documentazione aggiuntiva in `docs/` per dettaglio architetturale e flussi.

### Seeding utenti

- Se non ci sono utenti, il backend crea automaticamente un admin usando `DEFAULT_ADMIN_EMAIL` e `DEFAULT_ADMIN_PASSWORD`.
- Puoi sempre ripassare dal wizard `/setup.html` per inserire un admin personalizzato e aggiornare la configurazione MQTT.

### Test rapido interfaccia web

Per provare la parte web (login + dashboard) è sufficiente avviare backend, frontend e MongoDB:

```bash
docker compose up --build frontend backend mongo
```

Collega il backend al tuo broker MQTT (interno o esterno) dal wizard di setup per testare l'inoltro dei messaggi.

## Studente

- Ivan Cafiero — matricola `0124003383`
