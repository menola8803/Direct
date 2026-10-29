# Bygga och driva Direct själv (version 0.13.0)

Den här manualen visar hur du bygger appen på din egen dator, skaffar en egen nyckel för den, och vilka tjänster du
själv kan driva för att inte vara beroende av andra. Alla kommandon är för Arch Linux och zsh.

## 1. Är appen fristående?

**Ja i det som spelar roll:** inget konto, ingen central server, inga annonser och ingen insamling av användning i appens egen
kod. Meddelanden, samtal och filer går direkt mellan telefonerna, krypterade. Appen bygger du lokalt, utan Expos molntjänst.

**Men den är inte helt utan tredje part.** Så här ser det ut:

| Del | Behövs? | Vad den ser | Så blir du oberoende |
|---|---|---|---|
| Meddelanden, samtal, filer | – | Går direkt mellan telefonerna. | Inget att göra. |
| **STUN** (standard: Cloudflare, Nextcloud, Telnyx) | Ja, för att telefoner på olika nät ska hitta varandra. På samma wifi behövs den inte. | Telefonens publika IP-adress och tidpunkten. Aldrig innehåll. | Byt lista i Inställningar → STUN-servrar, eller kör egen coturn (`docs/NETWORK.md`). |
| **Signalserver** (valfri) | Nej. Utan den parar ni ihop telefonerna med QR/kod ("Anslut utan server"), båda måste vara online samtidigt. | Vilka publika nycklar som är online och när, samt krypterade anslutningsmeddelanden. Aldrig innehåll. | Egen server, avsnitt 6. |
| **TURN** (valfri, tom som standard) | Bara när direkt väg är omöjlig (vissa mobilnät, strikta brandväggar). | IP-adresser och trafikmängd, inte innehåll. | Egen coturn (`docs/NETWORK.md`). |
| **GitHub** | Nej, men appen är inställd på det. | *Uppdatera:* appen frågar `api.github.com` om senaste release, bara när du öppnar Inställningar → Uppdateringar. *Inbjudan:* SMS-texten länkar till din APK och till inbjudningssidan. | Avsnitt 5: peka om till din egen plats, eller dela APK:n på annat sätt. |
| **Bygget** | Ja, vid bygget. | Npm, Googles Maven och Gradle hämtar beroenden. Det sker bara vid bygget, aldrig i den färdiga appen. | Inget, men du behöver internet första gången. |

Ärligt om gränserna:
- Beroendena (React Native, WebRTC, Expo med flera) har jag inte granskat rad för rad. Det jag har kontrollerat är appens
  egen kod: den kontaktar bara STUN/TURN-servrarna, signalservern du anger och GitHub (uppdateringskontroll och nedladdning
  av APK:n när du trycker på det). Dessutom finns två länkar som öppnas i webbläsaren först när du trycker på dem:
  hjälpsidan om nätverk på GitHub och Orbot-sidan hos Guardian Project under Sekretess.
- Det finns inga push-notiser. Meddelanden och samtal tas emot medan appen körs i telefonen och är ansluten.
- Bara Android är byggt och testat.

## 2. Förbered datorn

```
sudo pacman -S --needed git nodejs npm jdk17-openjdk unzip
```
Node 22 eller 24 fungerar (bygget i GitHub använder 22). Java måste vara **17** eller nyare.

**Android SDK.** Installera Android Studio (AUR: `android-studio`) och öppna *SDK Manager*, eller använd bara
kommandoradsverktygen. Dessa delar behövs, och versionerna är de som den här versionen av React Native ber om:

| Del | Version |
|---|---|
| Android SDK Platform | 37 |
| Android SDK Build-Tools | 37.0.0 |
| NDK (Side by side) | 27.1.12297006 |
| CMake | senaste |
| Platform-Tools | senaste (för `adb`) |

Lägg detta i `~/.zshrc` (justera sökvägen om SDK:n ligger på annat ställe) och öppna ett nytt terminalfönster:
```
export ANDROID_HOME="$HOME/Android/Sdk"
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export PATH="$PATH:$ANDROID_HOME/platform-tools"
```
Godkänn licenserna en gång:
```
yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses
```
Saknas något hämtar Gradle det själv när licenserna är godkända, annars säger felmeddelandet vad som saknas.

## 3. Hämta koden och kontrollera

```
git clone https://github.com/menola8803/Direct.git
cd Direct/app
npm ci
npm run typecheck
npm test
```
`npm test` kör alla tester (krypto, filer, lås, säkerhetskopia, signalserver med mera). Alla ska säga OK.

## 4. Bygg APK:n

```
cd Direct/app
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease
```
APK:n hamnar i `app/android/app/build/outputs/apk/release/app-release.apk`. Första bygget tar lång tid eftersom Gradle och
alla beroenden hämtas, senare bygg går snabbare.

Bra att veta:
- `prebuild` ändrar `app/package.json`. Kör `git restore app/package.json` innan du hämtar nya ändringar med `git pull`,
  annars vägrar git. Mappen `app/android/` är genererad och ligger inte i git.
- Vill du bara testa på en modern telefon går bygget snabbare och APK:n blir mindre med
  `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`. För en APK som ska delas ut till andra, bygg utan flaggan.
- Tar minnet slut under bygget: lägg `org.gradle.jvmargs=-Xmx4g` i `~/.gradle/gradle.properties`.
- Hittas inte SDK:n ("SDK location not found"): kontrollera `ANDROID_HOME`, eller skapa `app/android/local.properties` med raden
  `sdk.dir=/sökväg/till/Android/Sdk`.

**Installera på telefonen:**
```
adb install -r app/android/app/build/outputs/apk/release/app-release.apk
```
eller skicka filen till telefonen och tillåt "Installera okända appar" när Android frågar.
Ett "App not installed" betyder oftast att den redan installerade appen är signerad med en annan nyckel än APK:n du försöker
installera: avinstallera den först (gör en säkerhetskopia i appen innan).

**Bygga i molnet i stället (GitHub Actions):** varje push till `main` som rör `app/` bygger en APK (Actions → *Build APK* →
Artifacts). En tagg `vX.Y.Z` bygger en release, se avsnitt 7.

## 5. Gör appen helt din: egen nyckel, eget namn, egen plats för uppdateringar

### Egen signeringsnyckel
APK:n är som standard signerad med en nyckel som är offentlig. Skapa en egen så att bara du kan ge uppdateringar som Android
godtar. Läs `docs/SIGNING.md` först: byte av nyckel kräver avinstallation och nyinstallation, så gör säkerhetskopior först.
```
bash scripts/new-signing-key.sh
```
Och när du bygger lokalt med nyckeln:
```
export DIRECT_KEYSTORE_FILE="$HOME/direct-signing/direct-release.p12" DIRECT_KEY_ALIAS=direct
read -rs DIRECT_KEYSTORE_PASSWORD; export DIRECT_KEYSTORE_PASSWORD DIRECT_KEY_PASSWORD=$DIRECT_KEYSTORE_PASSWORD
```
Förlorar du nyckelfilen eller lösenordet kan du aldrig mer ge en uppdatering som installerade appar godtar.

**Pinnen `app/signing/cert-sha256.txt`.** När den filen finns i repot kräver bygget i GitHub (både *Build APK* och releaser) att
APK:n är signerad med exakt den nyckeln, annars blir bygget rött med "the certificate is not the expected one". Det är avsikten:
ett bygge med fel nyckel ska aldrig bli en release som telefonerna vägrar installera. Två följder:
- Har du forkat repot och vill bygga med din egen nyckel: ersätt innehållet i pinnen med din nyckels fingeravtryck
  (`scripts/new-signing-key.sh` skriver ut det) och lägg dina hemligheter under Settings → Secrets i ditt repo
  (`DIRECT_KEYSTORE_BASE64`, `DIRECT_KEYSTORE_PASSWORD`, `DIRECT_KEY_PASSWORD`, `DIRECT_KEY_ALIAS`).
- Lokala byggen påverkas inte av pinnen. De kontrolleras bara om du själv kör `bash scripts/check-apk-signature.sh <apk>`
  (kräver `apksigner` från build-tools).

### Peka om uppdateringar och inbjudningar (bara om du flyttar till ett annat repo eller en annan plats)
Följande rader i koden pekar på `menola8803/Direct`. Byt dem och bygg om:

| Fil | Vad |
|---|---|
| `app/src/update.ts` | `UPDATE_REPO` (var appen letar efter nya versioner) |
| `app/src/core/invite.ts` | `INVITE_PAGE`, `RELEASES_URL`, `APK_URL` (länkarna i inbjudnings-SMS:et) |
| `app/src/screens/TurnServers.tsx` | `DOCS` (länk till hjälptexten) |
| `docs/i.html` | länken till APK:n på inbjudningssidan |
| `app/test/invite.test.ts` | testet kontrollerar länkarna, uppdatera det med dem |

Uppdateringskontrollen kräver ett **publikt** GitHub-repo med en release som har en `.apk` bifogad, och den körs bara när
någon trycker på *Sök efter uppdatering* i Inställningar → Uppdateringar. Vill du inte använda GitHub alls: ta bort raden
`<Row title={t.update} … />` i `app/src/screens/Settings.tsx` och dela ut APK:n själv. Då måste varje ny version installeras
för hand.

### Eget namn och eget app-id (om det ska vara en annan app)
I `app/app.json`: `name`, `slug`, `scheme` och `android.package` (nu `se.sncab.direct`). **Ändrar du `android.package` blir det
en annan app** som installeras bredvid den gamla och inte kan uppdatera den.

## 6. Egen signalserver och egen STUN/TURN

**Signalserver** (frivillig, några MB minne räcker). På en liten VPS med Node 22:
```
git clone https://github.com/menola8803/Direct.git && cd Direct/server
npm ci
PORT=8080 node server.js
```
Den måste nås med TLS (`wss://`). Enklast är Caddy framför, som sköter certifikatet och WebSocket själv. `Caddyfile`:
```
direct.example.com {
    reverse_proxy localhost:8080
}
```
Starta servern vid uppstart med en systemd-tjänst, `/etc/systemd/system/direct-signal.service`:
```
[Unit]
Description=Direct signaling server
After=network.target

[Service]
WorkingDirectory=/opt/Direct/server
Environment=PORT=8080
ExecStart=/usr/bin/node server.js
Restart=always
User=nobody

[Install]
WantedBy=multi-user.target
```
Sedan `sudo systemctl enable --now direct-signal`. På varje telefon: Inställningar → Anslutning → `wss://direct.example.com` →
Spara → håll inne knappen *Testa signalserver* (ett tryck visar bara hjälptexten). Alla måste ange exakt samma adress. Gratisalternativet på Render beskrivs i `docs/SETUP.md`.

**STUN och TURN:** lista egna servrar i Inställningar → STUN-servrar och TURN-servrar. Så här sätter du upp en egen coturn,
som ger både STUN och TURN: `docs/NETWORK.md`.

## 7. Släpp en ny version

1. Höj versionen i `app/app.json` (`version` och `android.versionCode`, som alltid ska öka) och i `app/package.json`.
2. Skriv i `CHANGELOG.md`.
3. Kör `npm test`, commita och pusha till `main`.
4. Tagga: `git tag -a v0.13.1 -m "Direct 0.13.1" && git push origin v0.13.1`.

Taggen får GitHub att bygga en release med APK:n (`Direct-<tagg>.apk` och `Direct.apk`). Appens uppdateringskontroll och
inbjudningslänken hittar den. Är releasen inte markerad som *Latest* hittas den inte.

## 8. Säkerhetskopior och data på telefonen
Läs README-avsnittet *Security on the phone* och `docs/SETUP.md`. Kort: spara en säkerhetskopia (Inställningar → Säkerhetskopia)
innan du avinstallerar, byter nyckel eller byter telefon, och använd inte samma nyckel på två telefoner samtidigt.

## 9. Om något går fel
| Symptom | Åtgärd |
|---|---|
| `JAVA_HOME is not set` / fel Java-version | `export JAVA_HOME=/usr/lib/jvm/java-17-openjdk`, kontrollera med `java -version`. |
| `SDK location not found` | Sätt `ANDROID_HOME` eller `sdk.dir` i `app/android/local.properties`. |
| `Failed to install the following Android SDK packages … licenses` | `yes \| sdkmanager --licenses`. |
| Bygget dör med minnesfel | `-Xmx4g` i `~/.gradle/gradle.properties`. |
| `git pull` vägrar på `app/package.json` | `git restore app/package.json`, sedan `git pull`. |
| "App not installed" | Annan signeringsnyckel än den installerade appen: avinstallera (säkerhetskopiera först). |
| Telefoner hittar inte varandra | Testa STUN-servrarna (håll inne en server i listan), prova signalservern, och lägg till en TURN-server om ni sitter på mobilnät. |
