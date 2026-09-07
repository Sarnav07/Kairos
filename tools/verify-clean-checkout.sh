#!/usr/bin/env bash
set -euo pipefail

pfda_root="$(git rev-parse --show-toplevel)"
pfda_temp="$(mktemp -d "${TMPDIR:-/tmp}/pfda-clean-checkout.XXXXXX")"

cleanup() {
  rm -rf "$pfda_temp"
}
trap cleanup EXIT

git clone --recurse-submodules "$pfda_root" "$pfda_temp/repo"
cd "$pfda_temp/repo"

git submodule status --recursive
forge fmt --check
forge build
forge test --summary

cd app
npm ci --ignore-scripts
npm run lint
npm run test
npm run build
