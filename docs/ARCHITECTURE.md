# Architecture

## What is built (0.8.0)
- **Identity:** two NaCl key pairs (X25519 for encryption, Ed25519 for signing) created on the phone and kept in secure storage. A contact is added by exchanging a card (`direct1:` code or QR). The contact id is derived from both public keys.
- **Transport:** WebRTC data channels, straight between phones. STUN for address discovery; TURN is optional (up to five servers; also enables "hide my IP" and the TCP-only Tor/VPN mode, see `docs/NETWORK.md`).
- **Introduction (two options):**
  1. *No server:* phones exchange compressed, encrypted offer/answer codes (QR, SMS, e-mail, paste).
  2. *Signaling relay (optional, `server/`):* forwards sealed offer/answer/ICE messages between authenticated keys (challenge/response with an Ed25519 signature). Stores nothing, never sees chat, files or calls.
- **Session encryption with forward secrecy (`app/src/core/session.ts`):** on every connection each side sends a one-time X25519 key (authenticated by the long-term keys), derives a shared secret, then ratchets a hash chain so every message has its own key which is erased after use. Stolen long-term keys cannot decrypt past sessions. There is no post-compromise security (that needs a Double Ratchet).
- **Messages:** outbox with queued / sent / delivered (ack), de-duplicated by id and resent on reconnect.
- **Files, voice and video messages:** chunked (8 kB) over the encrypted channel with back-pressure, max 50 MB, stored per contact in Download/Direct, the app's private folder, or (setting *Private and encrypted*) encrypted in the app's own folder `direct-enc`.
- **Data at rest (`core/vault.ts`, `core/filecrypt.ts`):** a random 32-byte data key lives in the Android Keystore (expo-secure-store, key `direct.datakey.v1`). The saved state (`direct.state.v3`) is `enc1:` + base64(nonce ‖ secretbox). Encrypted files: header `DEF1 | salt | frame size`, then 64 kB frames sealed with a per-file key `SHA-512("direct-file-v1" | data key | salt)[:32]`; the nonce is the frame number plus a last-frame flag, so reordering, removal and truncation are detected.
- **App lock (`lock.tsx`, `core/lock.ts`):** a gate in front of the app using expo-local-authentication (biometric or device credential). It holds no key; the encryption above does not depend on it.
- **Backup (`core/backup.ts`):** JSON `{direct-backup, kdf: scrypt, N, r, p, salt, nonce, ct}`; `ct` = secretbox of the identity and the state under scrypt(passphrase). A file may ask for N between 2^12 and 2^16 only.
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
