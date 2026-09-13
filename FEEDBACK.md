# Uniswap developer feedback

Status: collection started; feedback form not submitted.

## Verified documentation observations

- The official deployment page lists v4 contracts for Unichain Sepolia (1301).
- Hooks provide pool customization, but LP fees and native protocol fees require distinct treatment when prototyping PFDA.
- A worked custom-accounting example that combines a separate input surcharge with LP fees, rounding order, and exact-input partial-fill behavior would reduce integration risk.
- A concise end-to-end hook-address permission-mining example would make CREATE2 deployment failures easier to diagnose.

## To record during implementation

### Chunk 1: custom accounting

- Tested unmodified v4 core commit `46c6834698c48bc4a463a86d8420f4eb1d7f3b75` using Solidity 0.8.26 and Foundry 1.7.1.
- The core CustomAccounting tests and DeltaReturningHook example clarified how PoolManager.take is balanced by a returned positive hook delta.
- An input surcharge reduces the amount reaching core, so simple addition of surcharge and LP rates is not exact. Our comparison tests document the composition and confirm native protocol fees still apply to discounted executors.
- Suggested documentation improvement: a worked input-surcharge example that covers fee composition, partial-fill handling and the distinction between LP and native protocol fees.

Record specific SDK/contracts versions, reproduction steps, errors, useful documentation, and suggested improvements as encountered. Do not invent feedback.

## Submission

Public file: https://github.com/Sarnav07/Kairos/blob/main/FEEDBACK.md

Submit https://developers.uniswap.org/hackathon-feedback with that public URL after the build feedback is complete.

Suggested form summary: Kairos uses unmodified v4 core, PoolManager, hook permissions, custom hook accounting, and a hook-enabled Unichain Sepolia pool. The hardest part was composing a separate input surcharge with LP fee accounting without overstating the result as a native protocol-fee waiver. The hook architecture made the application-level PFDA analogue possible without modifying core.

## Submission readiness

- The public GitHub repository and this file's public URL have been verified. The feedback form has not been submitted.
- The user must complete that account-bound action and verify the submitted form contains the resolving public URL above.
