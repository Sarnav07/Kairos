// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";
import {PFDAAuction} from "../src/PFDAAuction.sol";

/// @notice Schedules one explicit, human-reviewed testnet auction for a bootstrapped pool.
/// @dev The caller supplies the pool ID and timing in `.env`; no bidder secret or private key is
///      included in this script. Times are relative to the block that schedules the auction.
contract SchedulePFDAAuction is Script {
    uint256 internal constant UNICHAIN_SEPOLIA_CHAIN_ID = 1301;
    uint64 internal constant MINUTE = 60;

    error UnsupportedChain(uint256 actual);
    error UnexpectedDeployer(address actual, address expected);
    error MissingCode(address target);
    error InvalidDurations();

    struct Config {
        PoolId poolId;
        uint64 commitDelay;
        uint64 commitDuration;
        uint64 revealDuration;
        uint64 activationDelay;
        uint64 rightDuration;
        uint128 bond;
        uint128 minimumBid;
    }

    function run() external returns (uint256 auctionId) {
        if (block.chainid != UNICHAIN_SEPOLIA_CHAIN_ID) revert UnsupportedChain(block.chainid);

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        if (deployer != vm.envAddress("DEPLOYER_ADDRESS")) {
            revert UnexpectedDeployer(deployer, vm.envAddress("DEPLOYER_ADDRESS"));
        }

        PFDAAuction auction = PFDAAuction(vm.envAddress("PFDA_AUCTION"));
        if (address(auction).code.length == 0) revert MissingCode(address(auction));
        if (auction.deployer() != deployer) {
            revert UnexpectedDeployer(deployer, auction.deployer());
        }

        Config memory config = _config();
        PFDAAuction.Schedule memory schedule = _schedule(config);

        vm.startBroadcast(deployerKey);
        auctionId = auction.createAuction(config.poolId, schedule, config.bond, config.minimumBid);
        vm.stopBroadcast();

        console2.log("PFDA auction scheduled", auctionId);
        console2.log("commit start", schedule.commitStart);
        console2.log("commit end", schedule.commitEnd);
        console2.log("reveal end", schedule.revealEnd);
        console2.log("activation", schedule.activation);
        console2.log("expiry", schedule.expiry);
    }

    function _config() internal view returns (Config memory config) {
        config = Config({
            poolId: PoolId.wrap(vm.envBytes32("PFDA_POOL_ID")),
            commitDelay: uint64(vm.envOr("AUCTION_COMMIT_DELAY_SECONDS", uint256(5 * MINUTE))),
            commitDuration: uint64(
                vm.envOr("AUCTION_COMMIT_DURATION_SECONDS", uint256(20 * MINUTE))
            ),
            revealDuration: uint64(
                vm.envOr("AUCTION_REVEAL_DURATION_SECONDS", uint256(20 * MINUTE))
            ),
            activationDelay: uint64(
                vm.envOr("AUCTION_ACTIVATION_DELAY_SECONDS", uint256(35 * MINUTE))
            ),
            rightDuration: uint64(vm.envOr("AUCTION_RIGHT_DURATION_SECONDS", uint256(30 * MINUTE))),
            bond: uint128(vm.envOr("AUCTION_BOND_USDC", uint256(1e6))),
            minimumBid: uint128(vm.envOr("AUCTION_MINIMUM_BID_USDC", uint256(10e6)))
        });
        if (
            config.commitDuration == 0 || config.revealDuration == 0 || config.rightDuration == 0
                || config.bond == 0 || config.minimumBid == 0
        ) revert InvalidDurations();
    }

    function _schedule(Config memory config)
        internal
        view
        returns (PFDAAuction.Schedule memory schedule)
    {
        uint64 commitStart = uint64(block.timestamp) + config.commitDelay;
        uint64 commitEnd = commitStart + config.commitDuration;
        uint64 revealEnd = commitEnd + config.revealDuration;
        uint64 activation = revealEnd + config.activationDelay;
        schedule = PFDAAuction.Schedule(
            commitStart, commitEnd, revealEnd, activation, activation + config.rightDuration
        );
    }
}
