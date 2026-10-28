#!/usr/bin/env bash
# Creates Direct's own signing key. Run it ONCE, on your own computer.
#
# Android only accepts an update of an app if it is signed with the same key as the installed copy. This key is what
# makes "Direct" yours: keep the file and the password safe (a password manager AND an offline copy). If they are lost
# nobody, including you, can publish an update that installed copies accept; everyone would have to uninstall first.
#
#   scripts/new-signing-key.sh [folder]        (default folder: ~/direct-signing)
#
# It writes <folder>/direct-release.p12, prints the certificate fingerprint, writes the fingerprint to
# app/signing/cert-sha256.txt (public information; commit it, the release build then checks against it) and, if you
# answer yes, stores the key in the GitHub secrets of the repository with `gh`.
set -euo pipefail

OUT="${1:-$HOME/direct-signing}"
KS="$OUT/direct-release.p12"
ALIAS="direct"
REPO="${DIRECT_REPO:-menola8803/Direct}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PIN="${DIRECT_PIN_FILE:-$HERE/../app/signing/cert-sha256.txt}"

command -v keytool >/dev/null || { echo "keytool is needed (it comes with Java, for example the JDK that Android Studio uses)." >&2; exit 1; }
[ -e "$KS" ] && { echo "$KS already exists. It is not overwritten. Move it away first if you really want a new key." >&2; exit 1; }

if [ -n "${DIRECT_NEW_KEY_PASSWORD:-}" ]; then   # only used by the tests
  PW="$DIRECT_NEW_KEY_PASSWORD"
else
  read -r -s -p "Choose a password for the key (at least 12 characters): " PW; echo
  read -r -s -p "Repeat the password: " PW2; echo
  [ "$PW" = "$PW2" ] || { echo "The passwords are not the same." >&2; exit 1; }
fi
[ "${#PW}" -ge 12 ] || { echo "The password must be at least 12 characters." >&2; exit 1; }

umask 077
mkdir -p "$OUT"
export DIRECT_PW="$PW"   # keytool reads it from the environment, so it never shows up in the process list
LC_ALL=C keytool -genkeypair -keystore "$KS" -storetype PKCS12 -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 36500 \
  -storepass:env DIRECT_PW -keypass:env DIRECT_PW -dname "CN=Direct, O=SNC AB, C=SE"
chmod 600 "$KS"

SHA="$(LC_ALL=C keytool -list -v -keystore "$KS" -storepass:env DIRECT_PW | grep -m1 'SHA256:' | sed 's/.*SHA256: *//')"
[ -n "$SHA" ] || { echo "Could not read the fingerprint." >&2; exit 1; }
mkdir -p "$(dirname "$PIN")"
echo "$SHA" > "$PIN"

echo
echo "Key file:      $KS"
echo "Alias:         $ALIAS"
echo "Fingerprint:   $SHA   (written to $PIN: commit that file)"
echo
echo "NOW: copy $KS and the password somewhere safe (password manager and an offline copy)."
echo

if [ -z "${DIRECT_SKIP_UPLOAD:-}" ] && [ -t 0 ] && command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  read -r -p "Store the key in the GitHub secrets of $REPO now? [y/N] " ans
  if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
    base64 < "$KS" | tr -d '\n' | gh secret set DIRECT_KEYSTORE_BASE64 -R "$REPO"
    printf %s "$PW"    | gh secret set DIRECT_KEYSTORE_PASSWORD -R "$REPO"
    printf %s "$PW"    | gh secret set DIRECT_KEY_PASSWORD -R "$REPO"
    printf %s "$ALIAS" | gh secret set DIRECT_KEY_ALIAS -R "$REPO"
    echo "Stored. Releases built by GitHub are now signed with this key."
  fi
else
  echo "To store it in GitHub yourself, see docs/SIGNING.md (Settings -> Secrets and variables -> Actions)."
fi
echo
echo "To build with this key on your own computer:"
echo "  export DIRECT_KEYSTORE_FILE=\"$KS\" DIRECT_KEY_ALIAS=$ALIAS"
echo "  read -rs DIRECT_KEYSTORE_PASSWORD; export DIRECT_KEYSTORE_PASSWORD DIRECT_KEY_PASSWORD=\$DIRECT_KEYSTORE_PASSWORD"
