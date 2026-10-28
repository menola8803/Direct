# Signing the APK with Direct's own key

Android only installs an update of an app if the new APK is signed with **the same key** as the installed copy. Until
now Direct was signed with the Expo template's debug key. That key is public (it is in every Expo project), so anyone
could build an APK that Android accepts as an update of your Direct. A key of your own closes that hole: nobody but you can
sign something that Android installs over your app, and Android itself refuses everything else. That is also why Direct
does not add a second signature check of its own inside the app. The phone already makes that check, with a key that
is checked by the operating system.

## What you must know before you switch

1. **Switching key means a fresh install.** Android refuses to install an APK signed with a new key over one signed with
   the old key ("App not installed" / "signatures conflict"). Everyone has to uninstall the old Direct first, which
   removes the app's data. **Make a backup first** (Settings → Backup, new in 0.13.0) and restore it after the install.
   The same backup also moves your identity to a new phone.
2. **If you lose the key file or its password, you can never publish an update again** that installed copies accept.
   Everybody would have to uninstall and start over. Keep the file and the password in a password manager **and** an
   offline copy. The key never goes into the repository.
3. **The switch is controlled by one file.** Until `app/signing/cert-sha256.txt` exists in the repository the release
   build keeps signing with the debug key (so 0.12.x phones update to 0.13.0 in place). Once the file exists, a release
   MUST be signed with the key that has that fingerprint. The build stops if the secret is missing or if the APK was
   signed with anything else.

Recommended order: release 0.13.0 (still debug-signed), let everybody update and make a backup, then create the key and
release the next version. People uninstall, install, restore the backup.

## Create the key (once, on your own computer)

You need `keytool` (comes with the JDK that Android Studio uses) and, to store the secrets from the command line, `gh`
logged in.

```
scripts/new-signing-key.sh              # writes ~/direct-signing/direct-release.p12
```

It asks for a password (at least 12 characters), makes an RSA 4096 key valid for 100 years, prints the certificate
fingerprint, writes it to `app/signing/cert-sha256.txt` and, if you say yes, stores the key as GitHub secrets. Then:

```
git add app/signing/cert-sha256.txt && git commit -m "Pin the signing certificate" && git push
```

That commit is the switch (see point 3 above).

### Secrets by hand
Repository → Settings → Secrets and variables → Actions → *New repository secret*:

| Secret | Value |
|---|---|
| `DIRECT_KEYSTORE_BASE64` | `base64 < ~/direct-signing/direct-release.p12 \| tr -d '\n'` |
| `DIRECT_KEYSTORE_PASSWORD` | the password |
| `DIRECT_KEY_PASSWORD` | the same password (a PKCS12 file has one password) |
| `DIRECT_KEY_ALIAS` | `direct` |

## Build with the key on your own computer
```
export DIRECT_KEYSTORE_FILE="$HOME/direct-signing/direct-release.p12" DIRECT_KEY_ALIAS=direct
read -rs DIRECT_KEYSTORE_PASSWORD; export DIRECT_KEYSTORE_PASSWORD DIRECT_KEY_PASSWORD=$DIRECT_KEYSTORE_PASSWORD
cd app && npx expo prebuild --platform android --no-install && cd android && ./gradlew assembleRelease
```
Without `DIRECT_KEYSTORE_FILE` the build is signed with the debug key as before. A local build and a GitHub build only
install over each other if they use the same key, so use the real key for both once you have switched.

## Check an APK
```
apksigner verify --print-certs Direct.apk        # in <Android SDK>/build-tools/<version>/
scripts/check-apk-signature.sh Direct.apk        # prints the certificate, compares it with app/signing/cert-sha256.txt
```
The two release workflows run the second command after the build.

## How it is wired
`app/plugins/withReleaseSigning.js` is an Expo config plugin. It adds a `release` signing config to the generated
`android/app/build.gradle` that reads `DIRECT_KEYSTORE_FILE`, `DIRECT_KEYSTORE_PASSWORD`, `DIRECT_KEY_ALIAS` and
`DIRECT_KEY_PASSWORD` from the environment and uses it for release builds when `DIRECT_KEYSTORE_FILE` is set. If the
generated file does not look as expected the plugin stops the build instead of guessing (`npm test` covers this against
a copy of the real template).

## Not done, and why
- **A signature check of the update inside the app.** The phone already refuses an APK with another key. An extra key
  held by the same GitHub account would not add protection. An independent check would need a key kept offline.
- **Key rotation with an old-key proof (apksigner `rotate`, Android 9 and later)** would allow the switch without a
  reinstall. It needs the signing lineage to be wired into the Gradle build, which has not been tried here, so it is
  left out. Using it later does not change anything above.
