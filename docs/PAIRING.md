# Adding contacts with a one-time code (0.14.0)

Instead of showing and scanning QR codes, two people can add each other with a short code that one of them sends as a text message. This is the default from 0.14.0. QR stays available: choose it under **Settings → How you add contacts**, or tap *Show my QR code* / *Scan a QR code* on the code screen at any time.

## What you do

1. **Person A:** Contacts → **+ Add** → **Make a code**. The screen shows a code like `4829-17305-6`. Tap **Send the code** and pick SMS (or any other app). The text also holds a link to the app, for a friend who does not have it yet.
2. **Person B:** Contacts → **+ Add** → type the code → **Add**.
3. That is all. A and B are added to each other and appear under *In the app*. Neither has to be online when the other acts: the code waits at the signal server for up to 24 hours, and whoever was away finishes the exchange the next time they open Direct.

A code works **once**. The last digit is a check digit, so a mistyped code is caught on the phone before anything is sent and does not use the code up. A phone keeps at most three codes open (made) and three entered at a time. Finished and failed exchanges stay on the code screen until you tap OK (or for a day).

Both phones need to use a signal server of version 0.14.0 or later (Settings → Connection, and `docs/BYGGA.md` to update it). An older server ignores the messages; the code screen then says so after 30 seconds.

## How it works

The code is `4829` + `17305` + `6`: four digits that name a mailbox on the signal server, five secret digits, and a check digit (Verhoeff, which catches every single wrong digit and every swap of two neighbours).

A short code cannot be a key: five secret digits are about 17 bits, and anyone who could see a message encrypted with it could try all 100 000 possibilities in a moment. What is used instead is a **password-authenticated key exchange** (PAKE), where the five digits are only the password:

```
g   = hash-to-group( secret digits, mailbox id )       both phones get the same g only if the digits match
A:  Ya = g^ya                       B:  Yb = g^yb       ya and yb are random and never sent
K   = Yb^ya = Ya^yb
keys = HKDF( hash(mailbox id, K, Ya, Yb) )              one key for A→B and one for B→A
```

It is CPace (the CFRG's balanced PAKE) over ristretto255. Nothing sent over the network lets anyone test a guess of the digits offline: for every guess the values look equally valid. The only way to test a guess is to take part in the exchange, which gives one try per code.

The messages, through the mailbox on the signal server (`server/pair.js`):

| Step | Message | What it holds |
|---|---|---|
| A makes the code | `pair-open` | the mailbox number and A's value `Ya` |
| B types it | `pair-claim` → server answers with `Ya` | B becomes the only phone that may answer this code |
| B answers | `pair-join` | B's value `Yb` and B's contact card, sealed with the B→A key |
| A reads it | pushed, or `pair-poll` | A derives the keys, opens the card; if it does not open, the code is burnt |
| A answers | `pair-reply` | A's contact card, sealed with the other direction key |
| B reads it | pushed, or `pair-poll` | B opens the card, adds A, closes the mailbox with `pair-end` |

(A's card travels A→B and is sealed with the A→B key.) A box that opens proves that the sender knew the secret digits. Each phone stores its pending exchange (secret values included) in its encrypted saved state until it is done, has failed or has run out, so closing the app does not lose it. Pending exchanges are **not** part of a backup, and finished ones hold no secrets.

## What the signal server sees and keeps

- It keeps, in memory only and for at most 24 hours: the mailbox number, A's public value, B's public value, and the two sealed cards. It cannot open the cards and cannot work out the digits from what it holds. A restart empties the mailboxes; A's phone puts its code back when it reconnects.
- It sees which two keys took part (it sees the keys of everyone who connects, and relays between them, anyway), and the time.
- It does not see the five secret digits, the contact cards, or any key.

## What this protects against, and what it does not

- **Someone watching the network or the server** cannot read the cards or find the digits from the exchange.
- **Someone who guesses** has one try per code: about 1 in 100 000, and only if they also name the right mailbox (4 digits) before the real friend does. A wrong try burns the code, A is told, and nobody is added. The server limits failed claims to 12 per 10 minutes per address and 100 per 10 minutes for the whole server, and a phone can have at most five codes open at the server.
- **A text message is not secret.** Whoever reads the SMS before your friend uses the code can use it first. The code then works once, so your friend finds it used and you find a stranger, not your friend, in your contacts. If that matters, send the code another way, or compare the **safety code** in the chat after adding (the same check as for a QR code). A contact added with a code is shown as not verified until you do.
- **Burning a code is possible for a nuisance:** someone who guesses the four-digit mailbox of a code that is open can claim it and spoil it. The cost is a new code, not a leak. This is the price of a code short enough to type; a QR code does not have it.
- **The implementation has not been reviewed by a cryptographer.** It is built from audited primitives (`@noble/curves` and `@noble/hashes`, both pinned exactly) but the way they are put together (`app/src/core/pair.ts`) is our own, because there is no maintained and reviewed PAKE package for JavaScript. The test with fixed values (`test/pair.test.ts`) only checks that versions of the app derive the same keys; it is not an independent test vector. If this matters to you, have it reviewed before you rely on it.

## Changing the length

`SECRET_DIGITS` in `app/src/core/pair.ts` (5) sets the odds for a single try. Raising it to 8 gives 1 in 100 million per try at the cost of a longer code (`4829-17305678-3`). `BOX_DIGITS` (4) sets how many codes can be open on one server at the same time before numbers collide (the phone then makes another code by itself). Phones and server must agree (`server/pair.js` checks the mailbox number with `BOX`; the input field in `PairCode.tsx` has a fixed length), so change them together and release a new version.
