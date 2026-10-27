#!/usr/bin/env bash
# Skapar GitHub-releaser för alla taggar som saknar release. Kräver: gh auth login
set -euo pipefail
for TAG in $(git tag --sort=version:refname); do
  if gh release view "$TAG" >/dev/null 2>&1; then echo "Finns redan: $TAG"; continue; fi
  git archive --format=zip --prefix="direct-design-$TAG/" -o "/tmp/direct-design-$TAG.zip" "$TAG"
  gh release create "$TAG" "/tmp/direct-design-$TAG.zip" --title "Direct $TAG" --generate-notes
done
