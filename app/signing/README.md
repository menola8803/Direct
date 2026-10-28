This folder holds only public information.

`cert-sha256.txt` (made by `scripts/new-signing-key.sh`) is the SHA-256 fingerprint of the certificate that Direct is
signed with. The release build compares the APK it made with it and stops if they differ, so a release is never published
signed with the wrong key. The private key is NOT here and never goes into the repository: see `docs/SIGNING.md`.
