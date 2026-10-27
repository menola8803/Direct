# Arkitektur (förslag)

- **Identitet:** nyckelpar (Ed25519) skapas på telefonen. Privat nyckel lämnar aldrig telefonen. Återställning via återställningsfras (12 ord).
- **Kontakter:** telefonboken läses lokalt, nummer normaliseras (E.164), hashas och slås upp i ett decentraliserat nät (DHT). Inget laddas upp till ett företag.
- **Inbjudan:** länk via SMS med publik nyckel. Verifiera med säkerhetskod/QR.
- **Meddelanden och filer:** libp2p (Noise) eller WebRTC data channels, lokal krypterad utkorg (SQLCipher) när mottagaren är offline.
- **Samtal:** WebRTC (DTLS-SRTP). Mesh upp till 4 med video, 8 med bara ljud. Fler med video kräver SFU.
- **Servrar som ändå behövs:** signalering (lätt), STUN (gratis), TURN (relay, ca 10–20 % av anslutningarna), push (FCM/APNs). Ingen av dem ser innehållet.
- **Signera signaleringsmeddelanden** med användarens nyckel för att motverka man-in-the-middle.

## Uppdatering i appen (Android)
- Standardkälla: GitHub Releases, `https://api.github.com/repos/menola8803/direct/releases/latest` (stabila releaser, inte förhandsversioner).
- Appen jämför versionen med den installerade, laddar ner APK-filen och kontrollerar SHA-256 (publiceras i release-texten) samt signatur.
- Installation via `PackageInstaller` ovanpå befintlig app. Kräver samma paketnamn, **samma signeringsnyckel** och högre `versionCode`. Data behålls.
- Användaren bekräftar alltid installationen. Första gången krävs tillstånd för "Installera okända appar".
- Sökningen är valbar (automatisk sökning kan stängas av) eftersom GitHub ser användarens IP-adress.
- iOS: uppdatering via App Store/TestFlight. Google Play: använd Plays egen in-app-uppdatering.
- Förlorad signeringsnyckel betyder att befintliga installationer inte kan uppdateras. Säkerhetskopiera den.
