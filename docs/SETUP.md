# Getting started (0.8.0)

## Without a server (nothing to host)
1. Build the APK: `cd app && npm i && npx eas-cli build -p android --profile preview` (WebRTC does not work in Expo Go).
2. Install it on two phones, create your key, add each other: Contacts → Add (QR or code).
3. Open the chat → *Connect without a server*: one creates a request, the other pastes/scans it and replies, the first pastes the reply.
   Both must be online at the same time. Pairing has to be repeated after the connection has dropped.

## With a signaling server (automatic reconnect)
`cd server && npm i && PORT=8080 node server.js` behind TLS, then enter `wss://your.domain` under Settings → Connection.
The server only relays encrypted connection messages, never chat, files or calls.

## STUN servers
A STUN server only tells a phone its public address; it never sees messages. Settings → STUN servers lets you paste addresses, test all of them on the phone (✓/✗ with response time), remove single servers or all that do not answer, and restore the defaults. The empty default uses Cloudflare, Nextcloud and stunprotocol.org (not Google).

## Limitations (honest list)
- Direct connections do not always work over mobile networks / strict firewalls without a TURN server (optional, under Connection).
- No push notifications without a server: messages and calls are received while the app is open and connected.
- Conference is a mesh: every participant sends to all others. Max 4 with video, 8 audio only.
- In-app update needs a public GitHub release with an `.apk` attached, and the user must allow the install.
- Forward secrecy per connection; no post-compromise security (Double Ratchet) yet.
- Tests run in Node (`npm test`). Phone-specific code (camera, microphone, WebRTC in React Native, installing) has not been run on a device.

## Build the APK in the cloud (no tools needed)
Push a tag and GitHub Actions builds the APK and attaches it to the release (`.github/workflows/release.yml`):
```
git tag -a v0.8.0 -m "Direct 0.8.0" && git push origin v0.8.0
```
The APK is signed with the Expo template's debug key, which is public. Fine for testing; before a real launch create your own keystore and keep it safe, since updates only install over an app signed with the same key.

## In-app update
Attach the APK to a public GitHub release tagged `vX.Y.Z` (workflow in `.github/workflows/release.yml`). The app checks `menola8803/Direct`.
