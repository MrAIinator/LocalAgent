#!/bin/sh
set -eu
cd "$(dirname "$0")"
echo "LocalAgent 0.1_beta"
if ! command -v node >/dev/null 2>&1; then
  echo "Нужен Node.js 20+"
  exit 1
fi
exec node electron/launch.cjs
