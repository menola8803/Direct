# Direct (app)

Expo / React Native app. See the root README for status and what remains.

```
npm install
npm test            # unit + integration tests (Node)
npm run typecheck
npx expo start      # note: calls and direct connections need the installed APK, not Expo Go
```

Themes are defined in `src/theme.ts` (Beige and USB), texts in `src/i18n.ts` (English and Swedish), state in `src/store.tsx`, networking in `src/net/`, crypto and protocol in `src/core/`.

## Build a real APK (Android)
Cloud build with EAS (free Expo account, no Android Studio needed):
```
npm install -g eas-cli
eas login
eas build -p android --profile preview
```
When the build finishes you get a link to an `.apk`. Open it on the phone and install (allow "Install unknown apps").

Local build (needs Android Studio/SDK and Java 17):
```
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```
The APK ends up in `android/app/build/outputs/apk/release/`.
