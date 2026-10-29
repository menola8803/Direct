# Changelog

## 0.13.1 – The invite flow as a picture in the guide
- **Getting-started guide, page "Invite and connect":** the text steps are replaced by a picture of the whole flow: who does what (A invites, B installs and adds A, B sends their code back, A adds B), what travels between the phones (SMS with links, SMS with B's code), the two ways to connect (signal server or without a server) and the warning that skipping steps 4–5 means A cannot receive anything from B. It is drawn with the app's own views, so it follows the theme, the language (Swedish and English) and narrow screens, and it is read out step by step by a screen reader. The tips about QR codes and the safety code stay below it.
- `docs/SETUP.md` and the README show the same diagram (`docs/img/invite-flow-sv.png`, in Swedish).
- Removed the guide texts `g3a`, `g3c` and `g3e`, which the picture replaces; `g3b` is reworded to read after the picture.
- No change to the protocol, storage or signing.

## 0.13.0 – Encrypted storage, app lock, private files, backup, own signing key
- **Encrypted at rest:** contacts, messages, settings and the TURN passwords are sealed (XSalsa20-Poly1305) with a random 32-byte key that lives only in the phone's secure storage (Android Keystore). A copy of the app's data folder is unreadable without it. Older plain-text data is read once and replaced. Saving is now debounced (a short delay, and straight away when the app leaves the screen). If the secure storage cannot be read, nothing is overwritten.
- **App lock (Settings → App lock):** off by default. Asks for fingerprint, face or the phone's screen lock (PIN, pattern, password) at start and after the app has been in the background for the chosen time (immediately, 1 or 5 minutes). Covers the app in the recent-apps picture, shows an incoming call on the lock screen, and switches itself off if the phone's screen lock is removed. The lock is a gate in the app; it does not replace the phone's own lock.
- **File location (Settings → File location):** *Visible folder* (Download/Direct, as before) or *Private and encrypted*. Private files are sealed frame by frame (64 kB, own key per file derived from the data key, changes, reordering and cut-off ends are detected), kept in the app's own folder and not visible in the Files app or the Gallery. Playing and opening decrypt to a short-lived copy in the cache when you ask. The choice applies to new files. Encrypted files are slower for big files.
- **Backup (Settings → Backup, and on the start screen):** a `.direct` file with your key, contacts, blocked list, settings and messages, sealed with a passphrase (at least 12 characters; scrypt N=2^15). Shared through Android's share sheet; restored from Settings or from the start screen. Files are not included, and settings that belong to one phone (file location, app lock) are not carried over. Restored messages with files show that the file is not on this phone.
- **Own signing key:** the build can sign the APK with a key of your own (`app/plugins/withReleaseSigning.js`, secrets or environment variables) and both workflows check the signature (`scripts/check-apk-signature.sh`). Nothing changes until `app/signing/cert-sha256.txt` is committed; before that releases are still debug-signed so 0.12.x updates in place. After the switch phones must reinstall (make a backup first). See `docs/SIGNING.md`, `scripts/new-signing-key.sh`.
- New dependencies: `expo-local-authentication`, `scrypt-js`. New tests: vault, lock, file encryption, file location, backup, signing plugin and scripts; the file tests now cover the encrypted mode.
- Not yet tried on a phone: the unlock dialogs, encrypted files with large videos (speed), the share sheet and file picker for backups, and a build signed with a real key.

## 0.12.1 – Download/Direct is really created
- **Fix:** the folder Download/Direct was never created in 0.12.0, even with "all files access". The file library checks write permission on the exact path being created, and Android says no for a path that does not exist yet. Folders and files are now created inside the existing parent (Download, then Direct, then one folder per contact), which is allowed.
- The test file system is now as strict as Android about this (it failed on the old code), and it also covers "no permission yet": nothing breaks and files go to the private folder until access is given.
- A failed copy of a file you send no longer leaves an empty file in the folder.

## 0.12.0 – Download/Direct, retention, delete-and-uninstall
- **Download/Direct:** received and sent files, voice and video are saved in the folder Download/Direct (a subfolder per contact, `.nomedia` keeps them out of the Gallery) when Direct has Android's *all files access*. The app asks once after the start screen (Android 11 or later); Settings → Storage shows where files go and has a button for the Android setting. Without the permission files stay in the app's private storage, as before. Files you send are copied there too, so they stay in the conversation.
- **Updates keep everything:** nothing in Download/Direct (or the private folder) is changed by an update.
- **Keep conversations (Settings):** 1 day, 1 week, **2 weeks (default)**, 1 month, 2 months, **3 months (longest)**. Messages, voice, video and files older than the choice are deleted from this phone: at start, when the app comes back, hourly while open and at once when the setting changes. It is local, so each person has their own timeline. The first start after the update applies the default to existing data.
- **Delete everything and uninstall (Settings → Storage):** shows what is removed (messages, contacts, your key, Download/Direct), deletes it and opens Android's uninstall dialog. Android does not allow an app to run code or warn when it is uninstalled from the phone's own menu, and it keeps public folders, so a plain uninstall leaves Download/Direct behind. A new install that finds old files there offers to delete them.
- **Backup off:** `allowBackup` is false, so a reinstall does not restore old chats from Android's cloud backup.
- New permissions: `MANAGE_EXTERNAL_STORAGE` (the Download/Direct folder) and `REQUEST_DELETE_PACKAGES` (the uninstall dialog). New tests: `test/retention.test.ts` and `test/files.test.ts` (the file rules against a fake file system).
- Not yet tried on a phone: the permission screen, writing to Download/Direct and the uninstall dialog.

## 0.11.1 – Conference tab, header fix
- **Conference tab:** Conference is now in the bottom bar (Chats, Contacts, Conference, Settings; the bar has icons). The tab shows three short steps, who can be picked (only connected contacts), and the *Call* (audio, up to 8) and *Video call* (up to 4) buttons. The row under Settings is gone.
- **Help:** the getting-started guide has a new page *Conference calls* with the steps (open the tab, pick connected people, call, they answer, mute/camera/hang up) and the rules (everyone must have added each other as contacts, up to 4 with video or 8 audio only, use Wi-Fi).
- **Header fix:** on a real phone the logo, DIRECT and the tagline were spread across the whole width and ran out of the card. The stretch mode is gone: every line is centered with fixed gaps. Applies to the Dark header and the start screen.
- **Invite:** *Send my code back* now names you in the message (it said "Someone invites you").
- Docs: if GitHub Pages is not enabled the invite link in the SMS fails; the whole link can be pasted under Contacts → + Add.

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
