#!/usr/bin/env bash
set -euo pipefail

pfda_root="$(git rev-parse --show-toplevel)"
cd "$pfda_root"

for file in docs/PRODUCTION.md docs/THREAT_MODEL.md indexer/README.md indexer/schema.sql; do
  test -s "$file"
done

for heading in \
  "## Monitoring and event operations" \
  "## Incident policy without a pause function" \
  "## Repeatable release procedure" \
  "## Testnet soak plan" \
  "## External audit plan and release blockers"; do
  rg -Fqx "$heading" docs/PRODUCTION.md
done

rg -Fq "The soak run is **pending**" docs/PRODUCTION.md
rg -Fq "No on-chain pause, upgrade, or emergency administrator exists." docs/PRODUCTION.md
rg -Fq "Contract calls and finalized logs remain the source of truth." indexer/README.md indexer/schema.sql
rg -Fq "AuctionCreated" indexer/README.md
rg -Fq "SurchargeCollected" indexer/README.md
rg -Fq "LeaseTakenOver" indexer/README.md
rg -Fq "## Assets and security properties" docs/THREAT_MODEL.md
rg -Fq "## Adversaries, controls, and residual risk" docs/THREAT_MODEL.md
rg -Fq "## Security review evidence required before a production claim" docs/THREAT_MODEL.md

sqlite3 :memory: < indexer/schema.sql

echo "Production-readiness documents and advisory indexer schema verified; soak and audit remain unclaimed release gates."
