# Direct

Chattapp utan server emellan. Meddelanden, samtal, röst- och videomeddelanden samt filer går direkt mellan telefonerna, krypterade. Gjord för människors integritet.

Det här repot innehåller **skärmdesignen** (mockups). Ingen app-kod ännu.

## Förhandsvisa designen
Öppna `design/index.html` i en webbläsare. Med GitHub Pages (Settings → Pages → branch `main`, mapp `/design`) får du en publik länk.

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
11. Lagring (rensa cache, per kontakt, allt)
12. Rensa allt (bekräftelse)
13. Om Direct (integritet)

Källfilerna ligger i `design/screens/*.dc.html`. `design/gen.py` genererar dem (kör `python3 ../gen.py` i `design/screens`, med `canvas.json` i den mappen).

## Stil
Ljus gråbeige med antracit och brons som accent. Fraunces (rubriker) och IBM Plex Sans (brödtext). Reserverat utrymme upptill för Androids statusfält.

## Filer på telefonen
`Download/Direct/<kontakt>/Ljud` (.m4a) och `Download/Direct/<kontakt>/Video` (.mp4). Användaren kan rensa cache, enskilda kontakter eller allt.

## Arkitektur (förslag)
Se `docs/ARCHITECTURE.md`.
