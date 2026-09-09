# PFDA demo workstation

This is the PFDA product workstation. It combines a Unichain Sepolia read-only runtime with a deliberately separate local auction simulator.

It demonstrates:

- domain-bound sealed-bid secret generation and JSON export/recovery;
- the commit, reveal, settlement and active-right lifecycle using clearly labelled local receipts;
- a deterministic comparison of an ordinary caller and active winner, with the LP fee retained and only the app surcharge waived.
- injected-wallet detection and a Unichain Sepolia network guard;
- a public contract registry, read-only immutable-wiring check, and Uniscan address links for the deployed stack.

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

The lifecycle receipt ledger is a simulator, not a transaction explorer, and the fee comparison is not a price or execution quote. The runtime does not request an approval or submit a contract transaction in this chunk. The next bidder-flow chunk adds allowance, commit, reveal and refund actions with explicit wallet confirmations.
