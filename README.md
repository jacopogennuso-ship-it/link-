# Surveillance Chat System

Un sistema di sorveglianza mascherato da chat che permette al server di accedere alle fotocamere dei client tramite browser.

## Caratteristiche Implementate

### ✅ Miglioramenti Video
- **Streaming ottimizzato**: Frame rate ottimizzato a 8 FPS per migliori prestazioni
- **Qualità adattiva**: Compressione JPEG ottimizzata per ridurre la latenza
- **Controllo server**: Il server può decidere quale fotocamera utilizzare (frontale/posteriore)

### ✅ Sistema Chat Avanzato
- **Interfaccia WhatsApp-like**: Design moderno e intuitivo
- **Allegati**: Supporto per foto, video e documenti
- **Upload automatico**: File caricati automaticamente sul server
- **Timestamp**: Messaggi con orario di invio

### ✅ Dashboard Admin
- **Gestione stanze**: Lista dinamica delle stanze attive
- **Selezione stanza**: Click per accedere ai dettagli di una stanza
- **Controllo fotocamera**: Switch tra fotocamera frontale e posteriore
- **Chat integrata**: Chat in tempo reale per ogni stanza
- **Video live**: Visualizzazione simultanea di entrambe le fotocamere

### ✅ Funzionalità Server
- **Gestione file**: Upload e servizio di file statici
- **WebSocket ottimizzato**: Comunicazione real-time migliorata
- **Controllo fotocamera**: Il server decide quale fotocamera utilizzare
- **Gestione stanze**: Tracking automatico delle stanze attive

## Installazione

```bash
npm install
npm start
```

## Utilizzo

### Client (Vittima)
1. Apri `http://localhost:3000`
2. Inserisci un ID utente quando richiesto
3. La fotocamera si attiverà automaticamente
4. L'interfaccia appare come una normale chat WhatsApp

### Admin (Controllore)
1. Apri `http://localhost:3000/admin?pass=secret123`
2. Seleziona una stanza dalla lista
3. Controlla le fotocamere e la chat
4. Usa i pulsanti per cambiare fotocamera (frontale/posteriore)

## Struttura File

- `server.js` - Server Node.js con WebSocket e upload file
- `index.html` - Interfaccia client (WhatsApp-like)
- `admin.html` - Dashboard admin con gestione stanze
- `package.json` - Dipendenze del progetto

## Sicurezza

⚠️ **ATTENZIONE**: Questo sistema è progettato per scopi di sorveglianza. Utilizzare solo in contesti legali e con consenso esplicito.

## Tecnologie

- **Backend**: Node.js, Express, WebSocket
- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Upload**: Multer per gestione file
- **Video**: getUserMedia API per accesso fotocamera
