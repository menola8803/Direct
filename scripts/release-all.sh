#!/usr/bin/env bash
# Creates GitHub releases for every tag that has no release yet. Requires: gh auth login
set -euo pipefail
for TAG in $(git tag --sort=version:refname); do
  if gh release view "$TAG" >/dev/null 2>&1; then echo "Already exists: $TAG"; continue; fi
  git archive --format=zip --prefix="direct-$TAG/" -o "/tmp/direct-$TAG.zip" "$TAG"
  gh release create "$TAG" "/tmp/direct-$TAG.zip" --title "Direct $TAG" --generate-notes
done
