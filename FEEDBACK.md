# Uniswap developer feedback

Status: collection started; feedback form not submitted.

## Verified documentation observations

- The official deployment page lists v4 contracts for Unichain Sepolia (1301).
- Hooks provide pool customization, but LP fees and native protocol fees require distinct treatment when prototyping PFDA.

## To record during implementation

### Chunk 1: custom accounting

- Tested unmodified v4 core commit `46c6834698c48bc4a463a86d8420f4eb1d7f3b75` using Solidity 0.8.26 and Foundry 1.7.1.
- The core CustomAccounting tests and DeltaReturningHook example clarified how PoolManager.take is balanced by a returned positive hook delta.
- An input surcharge reduces the amount reaching core, so simple addition of surcharge and LP rates is not exact. Our comparison tests document the composition and confirm native protocol fees still apply to discounted executors.
- Suggested documentation improvement: a worked input-surcharge example that covers fee composition, partial-fill handling and the distinction between LP and native protocol fees.

Record specific SDK/contracts versions, reproduction steps, errors, useful documentation, and suggested improvements as encountered. Do not invent feedback.

## Submission

Submit https://developers.uniswap.org/hackathon-feedback with the public URL of this file after the GitHub remote exists and the build feedback is complete.
