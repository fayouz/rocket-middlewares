#!/usr/bin/env bash
# Starts the suite (default) or one brick alone: bash .devcontainer/start.sh [suite|auth|print|cloud|mailer|pms]
set -euo pipefail
cd "$(dirname "$0")/.."

stack="${1:-suite}"
case "$stack" in
  suite) file=compose.yaml ;;
  auth|print|cloud|mailer|pms) file="compose.$stack.yaml" ;;
  *) echo "Usage : $0 [suite|auth|print|cloud|mailer|pms]" >&2; exit 1 ;;
esac

# The suite and the bricks alone use the same ports: stop the others first (their data is kept).
for other in compose.yaml compose.auth.yaml compose.print.yaml compose.cloud.yaml compose.mailer.yaml compose.pms.yaml; do
  [ "$other" = "$file" ] || docker compose -f "$other" down --remove-orphans >/dev/null 2>&1 || true
done

docker compose -f "$file" up -d --build

if [ "$stack" = suite ]; then
  cat <<'INFO'

✅ Suite démarrée (connexion : marie.martin@example.org / password)
   Rocket Auth   : http://localhost:3100
   Rocket Print  : http://localhost:3300
   Rocket Cloud  : http://localhost:3200
   Rocket Mailer : http://localhost:3000
   Rocket PMS    : http://localhost:3700
   Mailpit       : http://localhost:8025
   Les adresses sont en localhost : ouvre le Codespace dans VS Code (bureau), ou
   gh codespace ports forward 3100:3100 3300:3300 3200:3200 3000:3000 3700:3700 8025:8025
INFO
else
  echo; echo "✅ rocket-$stack démarré seul (compose.$stack.yaml) : voir ses adresses en tête du fichier."
fi
