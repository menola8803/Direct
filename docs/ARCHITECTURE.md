# Architecture

## What is built (0.8.0)
- **Identity:** two NaCl key pairs (X25519 for encryption, Ed25519 for signing) created on the phone and kept in secure storage. A contact is added by exchanging a card (`direct1:` code or QR). The contact id is derived from both public keys.
- **Transport:** WebRTC data channels, straight between phones. STUN for address discovery; TURN is optional (also enables "hide my IP").
- **Introduction (two options):**
  1. *No server:* phones exchange compressed, encrypted offer/answer codes (QR, SMS, e-mail, paste).
  2. *Signaling relay (optional, `server/`):* forwards sealed offer/answer/ICE messages between authenticated keys (challenge/response with an Ed25519 signature). Stores nothing, never sees chat, files or calls.
- **Session encryption with forward secrecy (`app/src/core/session.ts`):** on every connection each side sends a one-time X25519 key (authenticated by the long-term keys), derives a shared secret, then ratchets a hash chain so every message has its own key which is erased after use. Stolen long-term keys cannot decrypt past sessions. There is no post-compromise security (that needs a Double Ratchet).
- **Messages:** outbox with queued / sent / delivered (ack), de-duplicated by id and resent on reconnect.
- **Files, voice and video messages:** chunked (8 kB) over the encrypted channel with back-pressure, max 50 MB, stored in the app's private folder per contact.
- **Calls:** media tracks are added to the same peer connection and renegotiated over the encrypted data channel (works with no server). Conference is a mesh: every participant sends to all others (max 4 with video, 8 audio only). More video participants would need an SFU.
- **Updates:** latest GitHub release is checked, the APK is downloaded and the Android installer is started. Requires a public release with an `.apk` attached, the same package name and signing key, and a higher version.

## Limits
- No push notifications without a server: messages and calls arrive while the app is open.
- Direct connections can fail on strict networks (symmetric NAT, some mobile networks) without TURN.
- Without a server, pairing must be repeated whenever the connection has dropped.

## Security notes
- Use proven libraries (tweetnacl, WebRTC). Have an independent party review the app before a public launch.
- Verify contacts by comparing the safety code.
- Lost signing key means installed apps can no longer be updated. Back it up.
