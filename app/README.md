# Direct (app)

Expo/React Native-app. Se rotens README för status och vad som återstår.

```
npm install
npx expo start      # öppna med Expo Go
npx tsc --noEmit    # typkontroll
```

Teman definieras i `src/theme.ts` (Beige och USB), texter i `src/i18n.ts`, tillstånd i `src/store.tsx`.

## Bygga en riktig APK (Android)
Moln-bygge med EAS (gratis Expo-konto, ingen Android Studio behövs):
```
npm install -g eas-cli
eas login
eas build -p android --profile preview
```
När bygget är klart får du en länk till en `.apk`. Öppna länken på telefonen och installera (tillåt "Installera okända appar").

Lokalt bygge (kräver Android Studio/SDK och Java 17):
```
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```
APK-filen hamnar i `android/app/build/outputs/apk/release/`.
