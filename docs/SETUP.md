# Getting started (0.12.1)

## Without a server (nothing to host)
1. Build the APK: `cd app && npm i && npx eas-cli build -p android --profile preview` (WebRTC does not work in Expo Go).
2. Install it on two phones, create your key, add each other: Contacts → Add (QR or code).
3. Open the chat → *Connect without a server*: one creates a request, the other pastes/scans it and replies, the first pastes the reply.
   Both must be online at the same time. Pairing has to be repeated after the connection has dropped.

## With a signaling server (automatic reconnect)
`cd server && npm i && PORT=8080 node server.js` behind TLS, then enter `wss://your.domain` under Settings → Connection.
The server only relays encrypted connection messages, never chat, files or calls.

### Free signaling server on Render (no credit card)
Tested in October 2026: the *Test signal server* button gave 201 ms from a phone.
1. render.com → **New → Web Service → Public Git Repository** → `https://github.com/menola8803/Direct` (the repo must be public).
2. Name `direct-signal`, Region *Frankfurt*, Branch `main`, **Root Directory `server`**, Runtime *Node*, Build Command `npm install`, Start Command `npm start`, Instance Type **Free**. Leave *Health Check Path* empty: the server only answers WebSocket, so a path check would fail.
3. When the log says `Direct signaling listening on port …` and the service is *Live*, take its address and change `https://` to `wss://`, for example `wss://direct-signal.onrender.com` (no port).
4. On every phone: Settings → Connection → paste the address → Save → press and hold *Test signal server*. Everyone must use exactly the same address.

What to expect: the free instance sleeps after 15 minutes without inbound traffic and needs about a minute to wake, so the first test after a pause can fail; try again after a minute. The app reconnects by itself with growing delays (at most 30 seconds). Once two phones are connected, messages and calls go directly between them and the server is not involved. Render's free limits change, so check their pricing page (at the time of writing: 750 free instance hours per month and a monthly bandwidth cap). The server only sees public keys, IP addresses and timing, never content.

## Invite friends (link)
Contacts → *Invite* (or My code → *Share invite*) sends a message with a download link and an invite link. Someone who already has Direct taps the invite link, lands on a page with an **Open in Direct** button, sees the sender's name and safety code, and can add them. After adding, the app offers *Send my code back*, so both sides have each other and can connect.
- **The SMS** (Contacts → Invite, or My code → Share invite) says who invites and what Direct is, links to the newest APK, explains that Android asks to allow installing from the browser, and links to the invite page that adds the sender. It is about 700 characters, so phones send it as several linked SMS parts.
- **Always-newest download link:** `https://github.com/menola8803/Direct/releases/latest/download/Direct.apk`. GitHub sends it to the asset named exactly `Direct.apk` in the latest release. The release workflow uploads the APK under that name (and as `Direct-<tag>.apk`). If you attach an APK by hand to a release, name it `Direct.apk` as well.
- **Recipients are not signed in to GitHub**, so the repository must be **public** (or the releases and `docs/` must live in a public repo). With a private repo the link gives 404.
- The invite page is `docs/i.html`. To make the link work, enable GitHub Pages: repo **Settings → Pages → Branch `main`, folder `/docs`** (needs a public repo). The code sits in the URL fragment (`#…`), which is never sent to GitHub. If Pages is off the link in the SMS gives an error page. The recipient can still copy the whole link from the SMS and paste it under Contacts → + Add (the app finds the `direct1:` code inside it).
- Without a server there is no way to look up *who in your phone book has Direct*: a phone number cannot be matched to a key without a directory. Invite links are the serverless way.

## Files, retention and uninstall
- **Where files go:** Download/Direct, one subfolder per contact (named `Name-<start of the id>`), for received and sent files, voice and video. A hidden `.nomedia` file keeps pictures and videos out of the Gallery. This needs Android's *Allow management of all files* for Direct (Android 11 or later). The app asks once after the start screen; Settings → Storage shows the status and has a button to open the Android setting. Without it, files stay in the app's private storage (also used by files from versions before 0.12.0).
- **Updates:** installing a new version never changes anything in Download/Direct or the private folder, so the next update keeps voice, video and files. Both CI builds and local builds are signed with the same key, so they install over each other.
- **Retention:** Settings → Keep conversations: 1 day, 1 week, 2 weeks (default), 1 month, 2 months, 3 months (longest). Messages and files older than that are deleted from this phone, also files in Download/Direct that no message points to. The first start after updating applies the default (2 weeks) to what is already stored. Everyone sets their own time; nothing is deleted on the other person's phone.
- **Uninstall:** Android does not let an app run code or show a message when it is uninstalled from the phone's own menu, and it keeps public folders like Download/Direct. Use Settings → Storage → *Delete everything and uninstall*: it lists what is removed (messages, contacts, your key, Download/Direct), deletes it and opens Android's uninstall dialog. If you uninstall from Android's menu instead, the app's private data is removed but Download/Direct stays until you delete it; a later install offers to delete those old files. Automatic backup of app data is off, so a reinstall does not bring back old chats.

## STUN servers
A STUN server only tells a phone its public address; it never sees messages. Settings → STUN servers lets you paste addresses, test all of them on the phone (✓/✗ with response time), remove single servers or all that do not answer, and restore the defaults. The empty default uses Cloudflare, Nextcloud (port 443) and Telnyx (not Google).

## TURN and privacy
See `docs/NETWORK.md`: why there are no built-in TURN servers, how to run your own in ten minutes, and what the *Privacy and Tor/VPN* settings do.

## Limitations (honest list)
- Direct connections do not always work over mobile networks / strict firewalls without a TURN server (optional, under Settings → TURN servers).
- No push notifications without a server: messages and calls are received while the app is open and connected.
- Conference is a mesh: every participant sends to all others. Max 4 with video, 8 audio only.
- In-app update needs a public GitHub release with an `.apk` attached, and the user must allow the install.
- Forward secrecy per connection; no post-compromise security (Double Ratchet) yet.
- Tests run in Node (`npm test`). Phone-specific code (camera, microphone, WebRTC in React Native, installing, the Download/Direct permission and the uninstall dialog) has not been run on a device.

## Build the APK in the cloud (no tools needed)
Every push to `main` that touches `app/` builds an APK: open the repo → **Actions** → the latest *Build APK* run → **Artifacts** → download `Direct-<version>-<commit>.apk` and install it.

For a release,
Push a tag and GitHub Actions builds the APK and attaches it to the release (`.github/workflows/release.yml`):
```
git tag -a v0.12.1 -m "Direct 0.12.1" && git push origin v0.12.1
```
The APK is signed with the Expo template's debug key, which is public. Fine for testing; before a real launch create your own keystore and keep it safe, since updates only install over an app signed with the same key.

## In-app update
Attach the APK to a public GitHub release tagged `vX.Y.Z` (workflow in `.github/workflows/release.yml`). The app checks `menola8803/Direct`.
