# Network: STUN, TURN and privacy mode

## What they are for
Two phones talk to each other directly (WebRTC). To do that they must find each other's public address and get through NAT and firewalls.

- **STUN** only tells a phone its own public address. It never sees messages and is cheap to run, so there are many free public servers.
- **TURN** is a relay. When a direct path is impossible (many mobile networks, strict firewalls) all traffic goes through it. It cannot read the content (everything is encrypted end to end), but it sees IP addresses, timing and volume. Relaying costs bandwidth, which is why free TURN is rare.

## STUN defaults
Cloudflare (`stun.cloudflare.com:3478`), Nextcloud on port 443 (`stun.nextcloud.com:443`) and Telnyx (`stun.telnyx.com:3478`). Telnyx replaced `stun.stunprotocol.org`, which did not answer. It is on the list the Tor Project validated for Snowflake in 2026 ([tor-browser-build issue 41775](https://gitlab.torproject.org/tpo/applications/tor-browser-build/-/issues/41775)). The build environment has no UDP, so none of these could be tested there: Settings → STUN servers → *Test* tells you what works on your phone and network. Free public servers have no guarantee, so keep two or three.

## TURN: why there are no built-in defaults
- **Free TURN needs an account.** Metered's Open Relay gives 20 GB/month but needs a free account and an API key; freeturn.net calls itself a development and test resource; turnix.io has a free tier with an API for credentials. None of this was testable from the build environment.
- **Keys in a public repository get scraped.** Credentials shipped inside the app are found within days and the quota is gone or the account banned.
- **Everybody's connection data would go to one third party** the user never chose.

So Settings → TURN servers is an empty list with room for five servers, a test button (✓ means the server really handed out a relay address) and one server per row. If you have three servers you have tested and are happy to ship, the defaults are a single constant in `app/src/net/ice.ts`.

### Your own TURN server (about 10 minutes, any small VPS)
One server gives you three entries, which is the usual way to get through every kind of firewall:

```
turn:turn.example.com:3478                 direct SECRET     (UDP, fastest)
turn:turn.example.com:3478?transport=tcp   direct SECRET     (TCP)
turns:turn.example.com:5349                direct SECRET     (TLS, looks like HTTPS)
```

With Docker (coturn):

```
docker run -d --name turn --network=host coturn/coturn \
  -n --log-file=stdout --fingerprint --lt-cred-mech \
  --user=direct:SECRET --realm=turn.example.com \
  --no-multicast-peers --total-quota=100 \
  --min-port=49152 --max-port=65535
```

Open on the firewall: 3478 (UDP and TCP), 5349 (TCP, needs a certificate: add `--cert` and `--pkey` from Let's Encrypt) and 49152–65535 (UDP). Use a long random `SECRET`. The same user and password go into all three rows in the app. Anyone who has them can use your bandwidth, so only share them with people you trust.

## Privacy and Tor/VPN (Settings → Privacy and Tor/VPN)
- **Hide my IP address:** only relayed connections, no STUN. Your contact never sees your address; the TURN server does. Needs at least one TURN server. Without one nothing connects (it no longer falls back to a direct connection silently).
- **Tor/VPN mode (TCP only):** only TURN over TCP/TLS, no STUN, relay only. Plain `turn:` addresses get `?transport=tcp`.

### Tor
There is no Tor inside Direct. Reasons: the library and its native code would add many megabytes, and WebRTC in React Native cannot be pointed at a SOCKS proxy. Tor also carries only TCP; UDP support is still an open proposal ([Tor proposal 348](https://spec.torproject.org/proposals/348-udp-app-support.html)). Apps that work over Tor today (the proposal lists Signal, WhatsApp, Zoom and others) fall back to TCP relays.

What works: start **Orbot** (VPN mode, with Direct selected) or a VPN app, switch on *Tor/VPN mode* in Direct and add a TURN server that is reachable over TCP, preferably `turns:` on port 443. Messages and files work; calls will be sluggish. The signal server (if you use one) is reached through the same tunnel. Tor hides your address from the TURN operator, but the operator can still see that a Direct user connected.
