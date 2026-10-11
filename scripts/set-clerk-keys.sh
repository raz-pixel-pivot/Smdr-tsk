#!/bin/zsh
# Asks for the two Clerk keys (input hidden) and saves them to .env.local
# and to all three Vercel environments. Values are never printed.
set -e
cd "$(dirname "$0")/.."
umask 077

save() {
  local name=$1 value=$2
  # .env.local: drop any old line, append the new one
  grep -v "^$name=" .env.local > .env.local.tmp 2>/dev/null || true
  mv .env.local.tmp .env.local
  printf '%s=%s\n' "$name" "$value" >> .env.local
  for env in production preview development; do
    printf '%s' "$value" | vercel env add "$name" "$env" --force >/dev/null 2>&1
  done
  echo "  ✓ $name saved (.env.local + Vercel)"
}

echo "Paste the Publishable key (starts with pk_), then press Enter:"
read -rs PK; echo
[[ $PK == pk_* ]] || { echo "  ✗ That doesn't start with pk_. Nothing was saved."; exit 1; }

echo "Paste the Secret key (starts with sk_), then press Enter:"
read -rs SK; echo
[[ $SK == sk_* ]] || { echo "  ✗ That doesn't start with sk_. Nothing was saved."; exit 1; }

save NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY "$PK"
save CLERK_SECRET_KEY "$SK"
unset PK SK
echo "Done. You can close this tab."
