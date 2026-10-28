# Direct

**Version 0.13.0** (see `CHANGELOG.md`)

A chat app with no server in between. Messages, calls, voice and video messages and files go straight between the phones, encrypted. Built for people's privacy.

This repository contains the **screen designs** (`design/`), a **runnable app** (`app/`, Expo / React Native) with two themes, and an optional tiny **signaling relay** (`server/`).

## The app (`app/`)
Expo SDK 58, React Native 0.88, TypeScript.
- Real identity (NaCl key pairs in secure storage); add contacts by QR or code; safety code to verify a contact.
- Encrypted messages straight between phones over WebRTC, with **forward secrecy** (fresh one-time keys per connection plus a hash ratchet per message).
- **Connect without a server:** exchange pairing codes (QR/text). A signaling server is optional and only helps phones find each other.
- Delivery status (queued / sent / delivered), block contacts, phone-book import and SMS invites.
- Voice and video calls, 1:1 and conference (max 4 with video, 8 audio only; mesh). Conference has its own tab in the bottom bar.
- Voice messages, video messages and file transfer (max 50 MB), kept per contact in a visible folder or **private and encrypted** (your choice in Settings); clear per contact, all files or cache.
- **Encrypted storage:** contacts, messages and settings are encrypted on the phone with a key in the Android Keystore; optional **app lock** (fingerprint, face or screen lock); **encrypted backup** with a passphrase that also moves your identity to a new phone.
- Invite SMS with a link that always points to the newest APK, up to five TURN servers with a test, a privacy mode (hide IP, TCP only for Tor/VPN), see `docs/NETWORK.md`.
- Animated dark start screen with the Direct logo and Voice, Video and Conference icons; new app icon.
- Voice and video test, language (English, Swedish or phone language), two themes (Beige and Dark), in-app update from GitHub Releases.
- Reserved space for the Android status bar and bottom edge (safe area).

Not yet verified on a real phone: camera scanning, recording, WebRTC in React Native, and APK installation (everything else is covered by Node tests, `npm test`).

Setup, hosting the optional server, building the APK and known limitations: `docs/SETUP.md`. APK build details: `app/README.md`.

Run: `cd app && npm install && npx expo start` (WebRTC needs the installed APK, not Expo Go). Type check: `npm run typecheck`. Tests: `npm test`.

## Preview the design
Open `design/index.html` in a browser (built with `python3 design/build_gallery.py <version>`). With GitHub Pages (Settings → Pages → branch `main`, folder `/design`) you get a public link. The design mockups are in Swedish.

## Themes
- **Beige** (default): light grey-beige, charcoal and bronze. Fraunces + IBM Plex Sans.
- **Dark** (default): dark teal with gold and mint, Plus Jakarta Sans and a Cinzel wordmark.

## Files on the phone
Received and sent files, voice and video are saved in the folder **Download/Direct** (one subfolder per contact) when Android has given Direct "all files access" (Android 11 or later, asked once after the start screen; Settings → Storage shows the status). Without that permission they are kept in the app's private storage, as in earlier versions. The folder is never touched by an update of the app.

**Retention:** Settings → Keep conversations sets how long messages, files, voice and video are kept on this phone: 1 day, 1 week, **2 weeks (default)**, 1 month, 2 months or **3 months (longest)**. Older items are deleted automatically (at start, when the app comes back, hourly while it is open). The setting is local: each person chooses their own timeline and nothing is deleted on the other person's phone.

**Uninstall:** Android cannot let an app run code or show a warning when it is uninstalled from the phone's own menu, and it keeps public folders such as Download/Direct. Settings → Storage → *Delete everything and uninstall* therefore shows what will be removed (messages, contacts, your key, Download/Direct), deletes it and then opens Android's uninstall dialog. A new install that finds old files in Download/Direct offers to delete them. Automatic backup of app data is switched off.

## Security on the phone (0.13.0)
- **Encrypted at rest:** the saved state is sealed with a random key that only exists in the phone's secure storage. This protects against a copy of the app's data (backup, forensic dump). It does not stop someone who can unlock your phone and open the app: switch on **Settings → App lock** for that (a gate in the app, on top of the phone's own lock).
- **Files:** Settings → File location: *Visible folder* (Download/Direct, not encrypted) or *Private and encrypted* (in the app's own folder, opened only through Direct).
- **Backup:** Settings → Backup creates a `.direct` file with your key, contacts and messages, encrypted with your passphrase. Without the passphrase nobody can open it, and nobody can recreate it for you. Do not use the same key on two phones at the same time.
- **Signing:** `docs/SIGNING.md` explains the app's own signing key and the one-time switch (it needs a reinstall, so make a backup first).

## Architecture
See `docs/ARCHITECTURE.md`.

## Releases
Tags `vX.Y.Z` automatically create a release with a zip (see `.github/workflows/release.yml`). Attach the built APK to the release so the in-app updater can find it. Older tags can be published with `scripts/release-all.sh`.

## Developer
Claes Sundman SNC AB - 2026
