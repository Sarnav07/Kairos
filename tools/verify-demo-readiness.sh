#!/usr/bin/env bash
set -euo pipefail

pfda_root="$(git rev-parse --show-toplevel)"
cd "$pfda_root"

for file in docs/REHEARSAL.md docs/DEMO.md docs/EVIDENCE.md deployments/unichain-sepolia.json; do
  test -s "$file"
done

for phrase in \
  "## Roles and non-negotiables" \
  "## Rehearsal sequence" \
  "## Stop conditions" \
  "Live evidence dashboard" \
  'Do not attempt to demonstrate `commitWithPermit`' \
  "Winner and ordinary swaps"; do
  rg -Fq "$phrase" docs/REHEARSAL.md docs/DEMO.md docs/EVIDENCE.md
done

jq -e '
  .chainId == 1301
  and .contracts.pfdaAuction.address == "0xE30bd1162A9BB02C32EC8a0731014d45e1C15B73"
  and .poolBootstrap.poolId == "0x34626ba06dcca06958a701102c32034d3e0f035d9ea1629ec803e3cc8a093d4d"
' deployments/unichain-sepolia.json >/dev/null

forge fmt --check
forge build
forge test --summary
bash tools/verify-production-readiness.sh

(
  cd app
  npm run lint
  npm run test -- --run
  npm run build
)

echo "Demo readiness verified: local gates pass. The testnet rehearsal, receipt recording, video, and feedback form remain human-run steps in docs/REHEARSAL.md."
