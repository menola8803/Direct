# Getting started (0.8.0)

## Without a server (nothing to host)
1. Build the APK: `cd app && npm i && npx eas-cli build -p android --profile preview` (WebRTC does not work in Expo Go).
2. Install it on two phones, create your key, add each other: Contacts → Add (QR or code).
3. Open the chat → *Connect without a server*: one creates a request, the other pastes/scans it and replies, the first pastes the reply.
   Both must be online at the same time. Pairing has to be repeated after the connection has dropped.

## With a signaling server (automatic reconnect)
`cd server && npm i && PORT=8080 node server.js` behind TLS, then enter `wss://your.domain` under Settings → Connection.
The server only relays encrypted connection messages, never chat, files or calls.

## Limitations (honest list)
- Direct connections do not always work over mobile networks / strict firewalls without a TURN server (optional, under Connection).
- No push notifications without a server: messages and calls are received while the app is open and connected.
- Conference is a mesh: every participant sends to all others. Max 4 with video, 8 audio only.
- In-app update needs a public GitHub release with an `.apk` attached, and the user must allow the install.
- Forward secrecy per connection; no post-compromise security (Double Ratchet) yet.
- Tests run in Node (`npm test`). Phone-specific code (camera, microphone, WebRTC in React Native, installing) has not been run on a device.

## In-app update
Attach the APK to a public GitHub release tagged `vX.Y.Z` (workflow in `.github/workflows/release.yml`). The app checks `menola8803/Direct`.
