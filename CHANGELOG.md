# Ändringslogg

## 0.6.0
- Ny körbar app (`app/`, Expo/React Native) med temaval Beige/USB, språkval, kontakter från telefonboken, blockering och lokal chattdemo.
- Design: temaval Beige eller USB med ny skärm Tema (10b) och USB-tema för fem skärmar.
- Generatorn stöder tema via argument.

## 0.5.0
- Kontakter: scrollbar lista (8 kontakter i appen, 4 att bjuda in), fast rubrik, sök och flikrad.
- Blockering: kontaktmeny (håll in en kontakt), bekräftelseskärm och lista över blockerade kontakter med Avblockera.
- Säkerhet: ny rad "Blockerade kontakter".

## 0.4.3
- Mindre ikoner längst ner: flikrad, chattens inmatningsrad, inspelningsknappar och samtalsknappar.
- Kontakter: tydlig mörk knapp "Konferens" för att skapa videokonferens (upp till 4 med video).

## 0.4.2
- Utvecklarraden visas bara på Om Direct (borttagen från Välkomst för att spara utrymme).

## 0.4.1
- Utvecklarrad ("Utvecklare: Claes Sundman SNC AB - 2026") på Välkomst och Om Direct.
- README visar utvecklare.

## 0.4.0
- Uppdateringar visar nu läget "Du har senaste versionen" (0.4.0, ingen uppdatering finns).
- Läget "Ny version finns" ligger kvar som egen skärm (13b).
- Inställningar visar "Aktuell" i stället för "Ny".
- Galleriet byggs med `design/build_gallery.py`.

## 0.3.0
- Ny skärm: Säkerhet (appslås, dölj IP, privat lagring, nyckelvarning).
- Ny skärm: Nyckeln har ändrats (varning).
- Ny skärm: Applås (PIN).
- Privat lagring är standard. Texter om Download/Direct justerade.
- Release-automatik (GitHub Actions) och skript för äldre taggar.

## 0.2.0
- Inställningar byggd om: språk, uppdateringar, rensa cache, rensa per kontakt, rensa allt.
- Ny skärm: Språk (telefonens språk, svenska, English).
- Ny skärm: Uppdateringar via GitHub Releases.
- Skärmarna omnumrerade (nu 15).
- Arkitektur: avsnitt om uppdatering i appen.

## 0.1.0
- Första version: 13 skärmar (chatt, röst, video, filer, lagring, integritet), README och arkitekturförslag.

## 0.7.0 – Riktig P2P-chatt (första steget)
- Riktig identitet (NaCl-nycklar i säker lagring), kontakter via QR/kod, säkerhetskod för verifiering.
- Krypterade meddelanden direkt mellan telefoner över WebRTC; litet signalrelä i `server/` (lagrar inget).
- Utkorg med status (väntar/skickat/levererat), blockering, anslutningsinställningar (signalserver, TURN, dölj IP), uppdateringssök via GitHub Releases.
- Testat: krypto, relä och riktig WebRTC i Node, samt Android-bundle. EJ testat på riktig telefon ännu. Samtal, röst/video, filer och APK-installation kommer i nästa steg.

## 0.8.0 – Utan server, samtal, filer, forward secrecy
- **Anslut utan server:** manuell parkoppling med krypterade koder (QR/text). Signalservern är valfri.
- **Forward secrecy:** nya engångsnycklar för varje uppkoppling + hash-kedja per meddelande (`core/session.ts`).
- **Samtal och konferens:** röst/video 1:1 och upp till 4 personer med video (8 med enbart röst), mesh över WebRTC. Förhandlas över den krypterade datakanalen.
- **Röst- och videomeddelanden, filer:** inspelning i appen, uppdelning i bitar (max 50 MB), sparas privat per kontakt, rensning per kontakt/alla/cache.
- **Röst- och videotest** under Inställningar (mikrofonnivå, kamera, WebRTC-mediastack).
- **Uppdatering i appen:** laddar ner APK från senaste GitHub-release och startar Androids installerare.
- Testat i Node: session/ratchet, serverlös koppling, mediaspår, filöverföring (300 kB), samtalslogik (1:1, konferens, upptagen, tidsgräns). **Ej testat på riktig telefon.**
