# Direct

**Version 0.4.0** (se `CHANGELOG.md`)

Chattapp utan server emellan. Meddelanden, samtal, röst- och videomeddelanden samt filer går direkt mellan telefonerna, krypterade. Gjord för människors integritet.

Det här repot innehåller **skärmdesignen** (mockups). Ingen app-kod ännu.

## Förhandsvisa designen
Öppna `design/index.html` (byggs med `python3 design/build_gallery.py <version>`) i en webbläsare. Med GitHub Pages (Settings → Pages → branch `main`, mapp `/design`) får du en publik länk.

## Skärmar
1. Välkomst
2. Kontakter (import från telefonboken, matchas lokalt)
3. Chatt (text, röst, video, fil)
4. Dela (fil, foto, röst, video)
5. Röstmeddelande
6. Videomeddelande
7. Verifiera kontakt (säkerhetskod)
8. Ny videokonferens (max 4 med video)
9. Pågående konferens
10. Inställningar
11. Säkerhet (appslås, dölj IP, privat lagring, nyckelvarning)
12. Språk (telefonens språk, svenska, English)
13. Uppdateringar (aktuell version, ingen uppdatering finns)
13b. Ny version finns (nedladdning och installation)
14. Lagring
15. Rensa allt (bekräftelse)
16. Om Direct (integritet)
17. Nyckeln har ändrats (varning)
18. Applås

Källfilerna ligger i `design/screens/*.dc.html`. `design/gen.py` genererar dem (kör `python3 ../gen.py` i `design/screens`, med `canvas.json` i den mappen).

## Stil
Ljus gråbeige med antracit och brons som accent. Fraunces (rubriker) och IBM Plex Sans (brödtext). Reserverat utrymme upptill för Androids statusfält.

## Filer på telefonen
Som standard lagras filer krypterat i appens privata lagring. Om användaren slår på "Spara kopior i Download/Direct" sparas de även som `Download/Direct/<kontakt>/Ljud` (.m4a) och `.../Video` (.mp4). Användaren kan rensa cache, enskilda kontakter eller allt.

## Arkitektur (förslag)
Se `docs/ARCHITECTURE.md`.

## Releaser
Taggar `vX.Y.Z` skapar automatiskt en release med zip (se `.github/workflows/release.yml`). Äldre taggar kan läggas upp med `scripts/release-all.sh`.
