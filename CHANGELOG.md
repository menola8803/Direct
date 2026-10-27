# Changelog

## 0.8.0 – No server, calls, files, forward secrecy
- **Configurable STUN servers** with a per-server test; defaults are no longer Google.
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
