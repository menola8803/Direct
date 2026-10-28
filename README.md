# Direct

**Version 0.10.1** (see `CHANGELOG.md`)

A chat app with no server in between. Messages, calls, voice and video messages and files go straight between the phones, encrypted. Built for people's privacy.

This repository contains the **screen designs** (`design/`), a **runnable app** (`app/`, Expo / React Native) with two themes, and an optional tiny **signaling relay** (`server/`).

## The app (`app/`)
Expo SDK 58, React Native 0.88, TypeScript.
- Real identity (NaCl key pairs in secure storage); add contacts by QR or code; safety code to verify a contact.
- Encrypted messages straight between phones over WebRTC, with **forward secrecy** (fresh one-time keys per connection plus a hash ratchet per message).
- **Connect without a server:** exchange pairing codes (QR/text). A signaling server is optional and only helps phones find each other.
- Delivery status (queued / sent / delivered), block contacts, phone-book import and SMS invites.
- Voice and video calls, 1:1 and conference (max 4 with video, 8 audio only; mesh).
- Voice messages, video messages and file transfer (max 50 MB), stored privately per contact; clear per contact, all files or cache.
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
Files are stored in the app's private storage per contact. Users can clear cache, a single contact, or everything.

## Architecture
See `docs/ARCHITECTURE.md`.

## Releases
Tags `vX.Y.Z` automatically create a release with a zip (see `.github/workflows/release.yml`). Attach the built APK to the release so the in-app updater can find it. Older tags can be published with `scripts/release-all.sh`.

## Developer
Claes Sundman SNC AB - 2026
