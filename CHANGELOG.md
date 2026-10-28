# Changelog

## 0.11.0 – Getting-started guide, one way to test, centered start screen
- **Getting-started guide:** after the start screen on a fresh install the app shows five pages: welcome (with language choice), how to create your key, how to invite and connect others, everything you can do (chat, files, voice and video calls, voice and video messages, conference) and good to know. Then the key screen. Open it again any time under *Settings → Getting started guide*. Installs that are older than the guide do not get it as a first-run screen.
- **Tests work the same everywhere in Settings:** tap = a box explains the test, press and hold = the test runs, a box says *Testing…*, then *OK* or *Not working*, and fades away by itself. Applies to STUN servers (each address and the test-all button), TURN servers, the voice/video test (microphone, camera, WebRTC) and a new *Test signal server* button on the Connection screen. A hint line on each screen says so.
- **Centered:** the wordmark DIRECT and the tagline on the start screen and in the Dark header are now exactly centered on the logo, and the tagline is stretched to the same width as DIRECT. (Wide letter-spacing used to leave an extra gap after the last letter, so the text sat off-center.)
- **Language:** the *Video* button in the chat was the one text that did not follow the language choice. Every text now comes from the language files (Swedish and English).

## 0.10.1 – Test a TURN server with a long press
- **TURN servers:** tap an address for a short explanation of how to test it. Press and hold the address to test just that server: a box shows *Testing…* and then *OK* (with the time) or *Not working*, and fades away by itself after a few seconds. The result also marks the row. The *Test TURN servers* button still tests all of them.

## 0.10.0 – Better invitations, TURN list, privacy mode
- **Invite SMS:** says who invites and what Direct is, links to the newest APK, explains that Android asks to allow installing from the browser, and links to the invite page. The invite page (`docs/i.html`) now shows who invites, what the app does, a download button and step-by-step install help (Swedish and English).
- **Always-newest download link:** `releases/latest/download/Direct.apk`. The release workflow uploads the APK under that fixed name. Needs a public repo.
- **STUN:** `stun.stunprotocol.org` (did not answer) replaced by `stun.telnyx.com:3478`.
- **TURN servers:** a list of up to five (Settings → TURN servers) with a test that checks the server really hands out a relay address. The old single TURN server is migrated. No built-in TURN defaults, see `docs/NETWORK.md`.
- **Privacy and Tor/VPN:** *Hide my IP* (relay only) no longer falls back to a direct connection when no TURN server is set. New *Tor/VPN mode* (TCP-only relays, no STUN) for use with Orbot or a VPN, with buttons for VPN settings and Orbot.
- Connection screen now only holds the signal server.

## 0.9.3 – Clearer app icon
- The app icon (ring with a D and two peers) is bolder: bigger D, thicker ring, no thin inner ring, so it reads at launcher size.

## 0.9.2 – Start screen and app icon
- **Animated start screen** (always dark): the logo ring draws itself, two peers orbit it, and Voice (sound bars), Video (recording dot) and Conference (connected nodes) light up in turn on a faint network where packets travel straight between nodes. About 3 s, tap to skip, shorter with "reduce motion".
- **New app icon** (ring with a D and two peers) replaces the Expo default; adaptive and themed (monochrome) icons included. `scripts/make-icons.js` regenerates all icon files.
- **Native start screen** is now dark (`expo-splash-screen`), so there is no white flash before the animated screen. New dependency: `expo-splash-screen`.

## 0.9.1 – Dark theme
- The dark theme is now called **Dark** (was "USB"). An existing choice is migrated automatically.

## 0.9.0 – New dark look, invite links, fixes
- **Dark look** (dark teal, gold, mint; Plus Jakarta Sans + Cinzel wordmark) is now the default theme.
- **Fixed phone-book import** (the old `expo-contacts` calls throw in SDK 58; now uses `expo-contacts/legacy`).
- **Invite links:** `direct://add?c=…` deep links, web invite page `docs/i.html`, invite screen with *Send my code back*.
- **STUN servers screen:** add, test all (✓/✗ with ms), remove single or failed servers, restore defaults. Defaults are no longer Google.
- **R8 fix** for release builds (WebRTC keep/dontwarn rules).
- **CI:** every push to `main` builds an APK (Actions → Artifacts); tags build the release APK.
- Android `versionCode` is now set (900 for 0.9.0) so updates install over older builds.

## 0.8.0 – No server, calls, files, forward secrecy
- **Connect without a server:** manual pairing with encrypted codes (QR/text). The signaling server is optional.
- **Forward secrecy:** fresh one-time keys per connection plus a hash chain per message (`core/session.ts`).
- **Calls and conference:** voice/video 1:1 and up to 4 people with video (8 audio only), mesh over WebRTC, negotiated over the encrypted data channel.
- **Voice messages, video messages, files:** recording in the app, chunked transfer (max 50 MB), stored privately per contact, clear per contact / all / cache.
- **Voice and video test** under Settings (microphone level, camera, WebRTC media stack).
- **In-app update:** downloads the APK from the latest GitHub release and starts the Android installer.
- Tested in Node: session/ratchet, serverless pairing, media tracks, file transfer (300 kB), call logic (1:1, conference, busy, timeout). **Not tested on a real phone.**
- Repository documentation translated to English; app defaults to English.

## 0.7.0 – Real P2P chat (first step)
- Real identity (NaCl keys in secure storage), contacts via QR/code, safety code for verification.
- Encrypted messages directly between phones over WebRTC; small signaling relay in `server/` (stores nothing).
- Outbox with status (queued/sent/delivered), blocking, connection settings (signaling server, TURN, hide IP), update check via GitHub Releases.

## 0.6.0
- Runnable app (`app/`, Expo/React Native) with Beige/USB themes, language choice, phone-book contacts, blocking and a local chat demo.
- Design: Beige or USB theme with a new Theme screen (10b) and a USB theme for five screens.
- The generator supports themes through an argument.

## 0.5.0
- Contacts: scrollable list, sticky header, search and tab bar.
- Blocking: contact menu (long-press), confirmation screen and a list of blocked contacts with Unblock.
- Security: new row "Blocked contacts".

## 0.4.3
- Smaller icons at the bottom: tab bar, chat input, record buttons and call buttons.
- Contacts: clear dark "Conference" button to start a video conference (up to 4 with video).

## 0.4.2
- The developer line is only shown on About Direct.

## 0.4.1
- Developer line on Welcome and About Direct; README shows the developer.

## 0.4.0
- Updates shows "You have the latest version"; "New version available" kept as its own screen (13b).
- Settings shows "Current" instead of "New".
- The gallery is built with `design/build_gallery.py`.

## 0.3.0
- New screens: Security, Key changed (warning), App lock (PIN).
- Private storage is the default.
- Release automation (GitHub Actions) and a script for older tags.

## 0.2.0
- Settings rebuilt: language, updates, clear cache, clear per contact, clear everything.
- New screens: Language, Updates via GitHub Releases.
- Architecture: section on in-app updates.

## 0.1.0
- First version: 13 screens (chat, voice, video, files, storage, privacy), README and architecture proposal.
