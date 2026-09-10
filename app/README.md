# PFDA demo workstation

This is the PFDA product workstation. It combines a Unichain Sepolia wallet runtime with a deliberately separate local auction simulator.

It demonstrates:

- domain-bound sealed-bid secret generation and JSON export/recovery;
- the commit, reveal, settlement and active-right lifecycle using clearly labelled local receipts;
- a deterministic comparison of an ordinary caller and active winner, with the LP fee retained and only the app surcharge waived.
- injected-wallet detection and a Unichain Sepolia network guard;
- a public contract registry, read-only immutable-wiring check, and Uniscan address links for the deployed stack.
- wallet-confirmed exact-amount MockUSDC approval, commit, reveal and refund actions;
- AES-GCM/PBKDF2 encrypted bid-secret records in local browser storage; and
- an immutable-deployer-gated schedule/proceeds panel with fixed pool configuration.
- a read-only event dashboard with live phase/countdown, state, receipts, and a two-bidder rehearsal checklist.
- an editable bid worksheet showing assumed captured volume, surcharge savings, bid plus gas cost, break-even flow, and half/expected/double-volume sensitivity.

## Run locally

```sh
cd app
npm install
npm run dev
```

Run quality checks with:

```sh
npm run lint
npm run test
npm run build
```

## Important boundary

The lifecycle receipt ledger is a simulator, not a transaction explorer, and the fee comparison is not a price or execution quote. The bid worksheet is editable arithmetic, not financial advice, an execution quote, a volume forecast, or a guarantee that a bidder will win or capture the assumed flow. The live dashboard reads a bounded recent RPC event window; it is useful for a rehearsal but not a permanent indexer. A live-write button always requires the user’s connected wallet confirmation; the app does not hold a wallet key. Vault passwords are never stored, and a forgotten password cannot be recovered. No auction is created unless the verified immutable deployer explicitly confirms the schedule transaction.
