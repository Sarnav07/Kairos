#!/usr/bin/env bash
set -euo pipefail

spec="docs/HARBERGER.md"
test -f "$spec"

for heading in \
  "## Status and decision boundary" \
  "## Rent and solvency" \
  "## Executor and hook integration" \
  "## Threat model and non-goals" \
  "## Required Chunk 16 verification" \
  "## Approval gate"
do
  rg -Fq "$heading" "$spec"
done

rg -Fq "activeHolder(pool)" "$spec"
rg -Fq "returns zero" "$spec"
rg -Fq "token balance of lease source" "$spec"
rg -Fq "Chunk 16 must not begin" "$spec"
rg -Fq "no Harberger lease contract" "$spec"

echo "Harberger design specification checks passed."
