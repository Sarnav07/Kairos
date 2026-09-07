# PFDA demo workstation

This is the local product demo for the PFDA prototype. It deliberately has no wallet connector or deployed contract addresses yet.

It demonstrates:

- domain-bound sealed-bid secret generation and JSON export/recovery;
- the commit, reveal, settlement and active-right lifecycle using clearly labelled local receipts;
- a deterministic comparison of an ordinary caller and active winner, with the LP fee retained and only the app surcharge waived.

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

The UI is a simulator until chunk 5. Its receipt ledger is not a transaction explorer, its demo addresses are placeholders, and its comparison is not a price or execution quote. The next chunk will add deployed Unichain Sepolia addresses, a wallet connector, and on-chain transaction states.
