#!/usr/bin/env bash
# Checks how an APK is signed.
#   scripts/check-apk-signature.sh <apk> [--require-own-key]
# - fails if the signature is not valid
# - fails with --require-own-key if the APK is signed with the public debug key (an update signed with it is refused by
#   phones that have a copy signed with the real key)
# - fails if app/signing/cert-sha256.txt exists and the certificate is a different one
# Needs apksigner (Android build-tools). APKSIGNER can name it; otherwise it is looked for in ANDROID_HOME.
# If it is missing that is an error when a fingerprint is pinned (or --require-own-key is used), otherwise a warning.
set -euo pipefail

APK="${1:?usage: check-apk-signature.sh <apk> [--require-own-key]}"
REQUIRE="${2:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PIN="${DIRECT_PIN_FILE:-$HERE/../app/signing/cert-sha256.txt}"

SIGNER="${APKSIGNER:-}"
if [ -z "$SIGNER" ]; then
  SIGNER="$(ls -d "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/nonexistent}}"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1 || true)"
fi
if [ -z "$SIGNER" ] || [ ! -x "$SIGNER" ]; then
  # Without a known key to compare with, a missing tool is only a warning (the build is not stopped for it).
  if [ -s "$PIN" ] || [ "$REQUIRE" = "--require-own-key" ]; then echo "ERROR: apksigner was not found (set APKSIGNER or ANDROID_HOME), so the signature cannot be checked." >&2; exit 1; fi
  echo "WARNING: apksigner was not found, the signature was not checked." >&2
  exit 0
fi

OUT="$("$SIGNER" verify --print-certs "$APK")" || { echo "The signature of $APK is NOT valid." >&2; exit 1; }
DN="$(printf '%s\n' "$OUT" | grep -m1 'certificate DN:' | sed 's/.*certificate DN: *//')"
SHA="$(printf '%s\n' "$OUT" | grep -m1 'certificate SHA-256 digest:' | sed 's/.*digest: *//' | tr -d ':' | tr 'A-F' 'a-f')"
[ -n "$SHA" ] || { echo "Could not read the certificate of $APK." >&2; exit 1; }

echo "Signed by:    $DN"
echo "SHA-256:      $SHA"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && printf 'APK signed by `%s`\n\nSHA-256 `%s`\n' "$DN" "$SHA" >> "$GITHUB_STEP_SUMMARY"

if printf '%s' "$DN" | grep -qi 'Android Debug'; then
  if [ "$REQUIRE" = "--require-own-key" ]; then
    echo "ERROR: the APK is signed with the public debug key, not with Direct's own key." >&2
    exit 1
  fi
  echo "WARNING: signed with the public debug key. Phones with a copy signed by the real key will refuse this as an update." >&2
fi

if [ -s "$PIN" ]; then
  WANT="$(tr -d ': \r\n' < "$PIN" | tr 'A-F' 'a-f')"
  if [ "$WANT" != "$SHA" ]; then
    echo "ERROR: the certificate is not the expected one." >&2
    echo "  expected (from ${PIN#"$HERE"/../}): $WANT" >&2
    echo "  found:                              $SHA" >&2
    exit 1
  fi
  echo "The certificate matches app/signing/cert-sha256.txt."
elif [ "$REQUIRE" = "--require-own-key" ]; then
  echo "NOTE: app/signing/cert-sha256.txt does not exist, so the certificate was not compared with a known one."
fi
