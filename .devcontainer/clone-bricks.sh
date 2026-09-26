#!/usr/bin/env bash
# Clones the bricks next to rocket-suite (where compose.yaml looks for them), on the branch of rocket-suite when the
# brick has it, main otherwise. Already cloned: left as is.
set -euo pipefail
cd "$(dirname "$0")/.."

branch="$(git rev-parse --abbrev-ref HEAD)"
for repo in rocket-auth rocket-print rocket-cloud rocket-mailer rocket-doc-fusion rocket-dispatch; do
  [ -d "../$repo/.git" ] && { echo "$repo: déjà cloné"; continue; }
  # Private repositories (rocket-dispatch) are read with the token of the Codespace (customizations.codespaces).
  url="https://github.com/fayouz/$repo.git"
  ref=main
  git ls-remote --exit-code --heads "$url" "refs/heads/$branch" >/dev/null && ref="$branch"
  echo "$repo: $ref"
  git clone --quiet --branch "$ref" "$url" "../$repo"
done
