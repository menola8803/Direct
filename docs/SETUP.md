# Komma igång (0.7.0)
1. Signalserver: `cd server && npm i && PORT=8080 node server.js` (kör bakom TLS, t.ex. Caddy/nginx → `wss://din.domän`).
2. APK: `cd app && npm i && npx eas-cli build -p android --profile preview` (WebRTC fungerar inte i Expo Go).
3. Installera APK på två telefoner, skapa nyckel, ange signalserverns adress under Inställningar → Anslutning.
4. Lägg till varandra via QR/kod under Kontakter → Lägg till.
5. Uppdatering i appen: bifoga APK:n på en publik GitHub Release med tagg `vX.Y.Z`.
