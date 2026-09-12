# Advisory event indexer option

The current workstation uses bounded RPC log reads. For a durable activity feed, run one small, read-only indexer against [schema.sql](schema.sql). It is deliberately not part of contract authorization: the UI must continue to read the relevant contract directly before showing a write action, and the worker must never submit transactions.

## Ingestion contract

- Pin chain ID `1301`, an explicit start block, a finalized-confirmation depth chosen for the target network, and the exact deployed address set.
- Fetch logs in ascending block/log order. Store the chain ID, block hash, transaction hash, log index, emitting address, topic0, decoded payload, and ABI version.
- Before advancing `chain_cursor`, confirm the stored finalized block hash still matches the provider. On a mismatch, delete derived logs/projections from the common ancestor forward and replay. Never use unfinalized logs for a final receipt or notification.
- Upsert projections from logs, but treat them as cache. For the current auction phase, winner, refund availability, active right, lease solvency, balance, or allowance, make the matching `eth_call` immediately before display or transaction preflight.

## Required event coverage

| Component | Events |
| --- | --- |
| Auction | `AuctionCreated`, `BidCommitted`, `BidRevealed`, `AuctionFinalized`, `RefundWithdrawn`, `ProceedsCollected` |
| Standard execution and fee hook | `SwapExecuted`, `SurchargeCollected` |
| Future lease execution | `InitialClaimed`, `VacantRightClaimed`, `RentSettled`, `CollateralToppedUp`, `LeaseCured`, `ValuationSet`, `LeaseReleased`, `LeaseTakenOver`, `LeaseLiquidated`, `RentCollected`, `CreditWithdrawn`, `LeaseSwapExecuted` |

## Operational constraints

- Use at least two independent RPC providers for read comparison and alert on a disagreement in chain head or finalized block hash.
- Retain raw decoded logs and ABI/version metadata so projections can be rebuilt after a decoder bug.
- Do not index bid salts, wallet signatures, private keys, vault passwords, or decrypted bid recovery files. None belongs on chain or in the indexer.
- Alerts and dashboard notifications are informational. They must not grant a waiver, settle a lease, liquidate, schedule an auction, collect proceeds, or transfer funds.
