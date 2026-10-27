# Direct

**Version 0.6.0** (se `CHANGELOG.md`)

Chattapp utan server emellan. Meddelanden, samtal, röst- och videomeddelanden samt filer går direkt mellan telefonerna, krypterade. Gjord för människors integritet.

Det här repot innehåller **skärmdesignen** (`design/`) och en **körbar app** (`app/`, Expo/React Native) med både teman.

## Appen (`app/`)
Expo SDK 58, React Native 0.88, TypeScript. Funktioner i v0.6.0:
- Välkomst, Chattar, Kontakter (läser telefonboken lokalt med tillstånd, sök, håll in för att blockera, bjud in via SMS), Chatt, Inställningar.
- **Temaval Beige eller USB** med förhandsbild, sparas på telefonen.
- Språk: telefonens språk, svenska eller engelska.
- Blockerade kontakter med avblockering, rensa chattar, Om Direct.
- Reserverat utrymme upptill för Androids statusfält och nederkant (safe area).

Ännu **inte** byggt: riktig kommunikation mellan telefoner (P2P/WebRTC), kryptering, samtal, röst-/videomeddelanden, filer och uppdatering via GitHub Releases. Chatten är en lokal demo med en demo-kontakt. Se `docs/ARCHITECTURE.md` för planen.

Riktig APK att installera på Android (utan Expo Go): se `app/README.md`.

Köra: `cd app && npm install && npx expo start`, och öppna med Expo Go på telefonen. Typkontroll: `npx tsc --noEmit`.


## Förhandsvisa designen
Öppna `design/index.html` i en webbläsare (byggs med `python3 design/build_gallery.py <version>`). Med GitHub Pages (Settings → Pages → branch `main`, mapp `/design`) får du en publik länk.

## Skärmar
1. Välkomst
2. Kontakter (scrollbar lista, import från telefonboken, matchas lokalt)
3. Chatt (text, röst, video, fil)
4. Dela (fil, foto, röst, video)
5. Röstmeddelande
6. Videomeddelande
7. Verifiera kontakt (säkerhetskod)
8. Ny videokonferens (max 4 med video)
9. Pågående konferens
10. Inställningar (tema, språk, uppdatering, rensa)
10b. Tema (Beige eller USB, med förhandsbild av båda)
11. Säkerhet (appslås, dölj IP, privat lagring, nyckelvarning, blockerade)
12. Språk (telefonens språk, svenska, English)
13. Uppdateringar (aktuell version, ingen uppdatering finns)
13b. Ny version finns (nedladdning och installation)
14. Lagring
15. Rensa allt (bekräftelse)
16. Om Direct (integritet, utvecklare)
17. Nyckeln har ändrats (varning)
18. Applås
19. Kontaktmeny (håll in en kontakt)
20. Blockera kontakt
21. Blockerade kontakter

Källfilerna ligger i `design/screens/*.dc.html`.

## Teman
- **Beige** (standard): ljus gråbeige, antracit och brons. Fraunces + IBM Plex Sans.
- **USB**: mörk teal med guld och mint, hämtat från USB Portlås-appen.
- USB-skärmarna ligger som `design/screens/Usb_*.dc.html` (Välkomst, Kontakter, Chatt, Tema, Inställningar). Övriga skärmar finns i beige.
- Generera: `python3 design/gen.py beige <mapp> "" --canvas` (kräver en `canvas.json` i mappen) och `python3 design/gen.py usb <mapp> Usb_`.

## Stil
Reserverat utrymme upptill för Androids statusfält.

## Filer på telefonen
Som standard lagras filer krypterat i appens privata lagring. Om användaren slår på "Spara kopior i Download/Direct" sparas de även som `Download/Direct/<kontakt>/Ljud` (.m4a) och `.../Video` (.mp4). Användaren kan rensa cache, enskilda kontakter eller allt.

## Arkitektur (förslag)
Se `docs/ARCHITECTURE.md`.

## Releaser
Taggar `vX.Y.Z` skapar automatiskt en release med zip (se `.github/workflows/release.yml`). Äldre taggar kan läggas upp med `scripts/release-all.sh`.

## Utvecklare
Claes Sundman SNC AB - 2026
