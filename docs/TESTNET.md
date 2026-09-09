# Unichain Sepolia deployment and rehearsal

The first deployment was broadcast and independently verified on-chain on 2026-09-09. This document keeps the reproducible procedure and identifies what still needs to happen for the public end-to-end rehearsal.

## Current network inputs

- Network: Unichain Sepolia (`1301`)
- v4 PoolManager: `0x00b036b58a818b1bc34d502d3fe730db729e62ac`
- Official explorer: `https://sepolia.uniscan.xyz`

The PoolManager address comes from Uniswap’s current [v4 deployment directory](https://developers.uniswap.org/docs/protocols/v4/deployments). The deployment script separately verifies that the selected manager has code and that the RPC reports chain ID 1301.

## Before broadcasting

1. Fund the wallet that will deploy the contracts with Unichain Sepolia test ETH.
2. Copy `.env.example` to `.env` and set `DEPLOYER_PRIVATE_KEY` locally. Never commit or send it in chat. It must derive to `DEPLOYER_ADDRESS` (`0x54560095593B57Ad71572336037435Ff1E50E4EA`); the deployment script rejects any other signer.
3. Keep `POOL_MANAGER` at the official address unless a deliberate test deployment is being used.
4. Run the full local gates:

```sh
forge fmt --check
forge build
forge test --summary
```

## Deploy

```sh
set -a
source .env
set +a
forge script script/DeployPFDA.s.sol:DeployPFDA \
  --rpc-url "$RPC_URL" \
  --broadcast \
  -vvvv
```

`DeployPFDA` derives the immutable auction proceeds recipient from `DEPLOYER_PRIVATE_KEY` and verifies it matches the configured public `DEPLOYER_ADDRESS`; no recipient override is accepted. It deploys MockUSDC, PFDAAuction, PFDAExecutor and PFDAHookDeployer, then mines a local CREATE2 salt and deploys PFDAFeeHook with the three required v4 permission bits: `beforeSwap`, `afterSwap`, and `beforeSwapReturnDelta`.

After broadcast, use `cast code`, `cast call`, and explorer pages to confirm each address. Save the resulting addresses and transaction hashes in a truthful deployment manifest only after verification.

## Verified deployment

All deployment transactions succeeded in Unichain Sepolia block `62101285`. The complete public record, including transaction hashes and the RPC-checked immutable wiring, is in [deployments/unichain-sepolia.json](../deployments/unichain-sepolia.json).

- MockUSDC: `0x7eef5a9C4289ECC5C53E2a35fac7D2Fb770048cd`
- PFDAAuction: `0xE30bd1162A9BB02C32EC8a0731014d45e1C15B73`
- PFDAExecutor: `0x479E644B05876C6AD98cE59C2Fc94FB6C0E6b231`
- PFDAHookDeployer: `0x27cb69EE6b4e50Ef0b26FCEb5663E611F44b0B9C`
- PFDAFeeHook: `0xBeE0b2606fdb9b70Ca3FB24254B674423f1e40c8`

The verified auction proceeds recipient and hook surcharge recipient are both `0x54560095593B57Ad71572336037435Ff1E50E4EA`. The verified hook surcharge is `500` PPM (5 bp).

## Rehearsal record to collect

The final testnet rehearsal needs two funded bidder wallets and a pre-initialized ERC-20/ ERC-20 pool using the deployed PFDA hook. Record transaction links for:

1. Auction schedule creation, with its fixed commit/reveal/activation/expiry windows.
2. Each bidder’s MockUSDC mint/approval, commitment and reveal.
3. Permissionless finalization, loser refund, and `collectProceeds` to the deployer address.
4. A winner swap through PFDAExecutor while the right is active, plus an ordinary swap comparison.

The contracts are deployed, but this public rehearsal has not yet been run. The existing integration suite remains the end-to-end proof until the listed auction and swap transactions are completed and recorded.
