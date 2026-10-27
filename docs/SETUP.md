# Komma igång (0.8.0)
## Utan server (inget att hosta)
1. Bygg APK: `cd app && npm i && npx eas-cli build -p android --profile preview` (WebRTC fungerar inte i Expo Go).
2. Installera på två telefoner, skapa nyckel, lägg till varandra: Kontakter → Lägg till (QR eller kod).
3. Öppna chatten → *Anslut utan server*: en skapar förfrågan, den andra klistrar in/skannar och svarar, första klistrar in svaret.
   Både måste vara online samtidigt. Kopplingen måste göras om när anslutningen brutits.

## Med signalserver (automatisk återanslutning)
`cd server && npm i && PORT=8080 node server.js` bakom TLS, ange `wss://din.domän` under Inställningar → Anslutning.
Servern förmedlar bara krypterade anslutningsmeddelanden, aldrig chatt, filer eller samtal.

## Begränsningar (ärligt)
- Direktanslutning går inte alltid över mobilnät/strikta brandväggar utan TURN-server (valfritt under Anslutning).
- Inga pushnotiser utan server: samtal och meddelanden tas emot när appen är öppen och ansluten.
- Konferens är mesh: varje deltagare skickar till alla. Max 4 med video, 8 med röst.
- Uppdatering i appen kräver en publik GitHub-release med en `.apk` bifogad och att användaren tillåter installation.
- Forward secrecy per uppkoppling; ingen post-compromise-säkerhet (Double Ratchet) än.
- Tester körs i Node (`npm test`). Telefonspecifik kod (kamera, mikrofon, WebRTC i RN, installation) är inte provkörd på enhet.

## Uppdatering i appen
Bifoga APK:n på en publik GitHub Release med tagg `vX.Y.Z` (workflow i `.github/workflows/release.yml`).
