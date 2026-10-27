# Arkitektur (förslag)

- **Identitet:** nyckelpar (Ed25519) skapas på telefonen. Privat nyckel lämnar aldrig telefonen. Återställning via återställningsfras (12 ord).
- **Kontakter:** telefonboken läses lokalt, nummer normaliseras (E.164), hashas och slås upp i ett decentraliserat nät (DHT). Inget laddas upp till ett företag.
- **Inbjudan:** länk via SMS med publik nyckel. Verifiera med säkerhetskod/QR.
- **Meddelanden och filer:** libp2p (Noise) eller WebRTC data channels, lokal krypterad utkorg (SQLCipher) när mottagaren är offline.
- **Samtal:** WebRTC (DTLS-SRTP). Mesh upp till 4 med video, 8 med bara ljud. Fler med video kräver SFU.
- **Servrar som ändå behövs:** signalering (lätt), STUN (gratis), TURN (relay, ca 10–20 % av anslutningarna), push (FCM/APNs). Ingen av dem ser innehållet.
- **Signera signaleringsmeddelanden** med användarens nyckel för att motverka man-in-the-middle.
