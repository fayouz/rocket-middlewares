#!/usr/bin/env bash
# Clones the bricks next to rocket-suite (where compose.yaml looks for them), on the branch of rocket-suite when the
# brick has it, main otherwise. Already cloned: left as is.
set -euo pipefail
cd "$(dirname "$0")/.."

branch="$(git rev-parse --abbrev-ref HEAD)"
for repo in rocket-auth rocket-print rocket-cloud rocket-mailer; do
  [ -d "../$repo/.git" ] && { echo "$repo: déjà cloné"; continue; }
  url="https://github.com/fayouz/$repo.git"
  ref=main
  git ls-remote --exit-code --heads "$url" "refs/heads/$branch" >/dev/null && ref="$branch"
  echo "$repo: $ref"
  git clone --quiet --branch "$ref" "$url" "../$repo"
done
