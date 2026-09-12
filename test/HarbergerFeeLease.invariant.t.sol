// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {PFDAAuction} from "../src/PFDAAuction.sol";
import {HarbergerFeeLease} from "../src/HarbergerFeeLease.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";

contract HarbergerLeaseHandler is Test {
    HarbergerFeeLease internal immutable lease;
    MockUSDC internal immutable token;
    address[] internal actors;

    constructor(HarbergerFeeLease lease_, MockUSDC token_, address[] memory actors_) {
        lease = lease_;
        token = token_;
        actors = actors_;
    }

    function advance(uint32 rawSeconds) external {
        vm.warp(block.timestamp + bound(rawSeconds, 0, 2 days));
    }

    function settle() external {
        try lease.settle() {} catch {}
    }

    function topUp(uint96 rawAmount) external {
        HarbergerFeeLease.Lease memory state = lease.leaseState();
        if (state.holder == address(0)) return;
        uint128 amount = uint128(bound(rawAmount, 1, 5e6));
        vm.prank(state.holder);
        try lease.topUp(amount) {} catch {}
    }

    function setValuation(uint96 rawValuation, uint96 rawDeposit) external {
        HarbergerFeeLease.Lease memory state = lease.leaseState();
        if (state.holder == address(0)) return;
        uint128 valuation = uint128(bound(rawValuation, 100e6, 500e6));
        uint128 deposit = uint128(bound(rawDeposit, 0, 5e6));
        vm.prank(state.holder);
        try lease.setValuation(valuation, deposit) {} catch {}
    }

    function takeOver(uint8 rawActor, uint96 rawValuation, uint96 rawDeposit) external {
        HarbergerFeeLease.Lease memory state = lease.leaseState();
        if (state.holder == address(0)) return;
        address actor = actors[rawActor % actors.length];
        uint128 valuation = uint128(bound(rawValuation, 100e6, 500e6));
        uint128 deposit = uint128(bound(rawDeposit, 27_398, 5e6));
        vm.prank(actor);
        try lease.takeOver(valuation, deposit) {} catch {}
    }

    function cure(uint96 rawAmount) external {
        HarbergerFeeLease.Lease memory state = lease.leaseState();
        if (state.holder == address(0) || state.arrears == 0) return;
        uint256 minimum = state.arrears + lease.minimumPrepay(state.valuation);
        uint128 amount = uint128(bound(rawAmount, minimum, minimum + 5e6));
        vm.prank(state.holder);
        try lease.cure(amount) {} catch {}
    }

    function liquidate() external {
        try lease.liquidate() {} catch {}
    }

    function claimVacant(uint8 rawActor, uint96 rawValuation, uint96 rawDeposit) external {
        if (lease.leaseState().holder != address(0)) return;
        address actor = actors[rawActor % actors.length];
        uint128 valuation = uint128(bound(rawValuation, 100e6, 500e6));
        uint128 deposit = uint128(bound(rawDeposit, 27_398, 5e6));
        vm.prank(actor);
        try lease.claimVacant(valuation, deposit) {} catch {}
    }

    function withdrawCredits(uint8 rawActor) external {
        vm.prank(actors[rawActor % actors.length]);
        try lease.withdrawCredits() {} catch {}
    }

    function collectRent() external {
        try lease.collectRent() {} catch {}
    }
}

contract HarbergerFeeLeaseInvariantTest is StdInvariant, Test {
    MockUSDC internal token;
    PFDAAuction internal auction;
    HarbergerFeeLease internal lease;
    HarbergerLeaseHandler internal handler;
    PoolId internal pool = PoolId.wrap(bytes32(uint256(89)));
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);
    uint256 internal auctionId;
    bytes32 internal constant SALT = keccak256("harberger invariant initial-auction salt");

    function setUp() public {
        vm.warp(1000);
        token = new MockUSDC();
        auction = new PFDAAuction(token, 60);
        auctionId = auction.createAuction(
            pool, PFDAAuction.Schedule(1010, 1110, 1210, 1270, 3000), 10e6, 1e6
        );
        _fund(alice);
        _fund(bob);
        _fund(carol);
        vm.warp(1010);
        _commit(alice, 100e6);
        _commit(bob, 150e6);
        vm.warp(1110);
        _reveal(alice, 100e6);
        _reveal(bob, 150e6);
        vm.warp(1210);
        auction.finalize(auctionId);
        vm.warp(1270);
        lease = new HarbergerFeeLease(auction, auctionId, pool, 1_000, 100e6, 1 days, 6 hours);
        _approveLease(alice);
        _approveLease(bob);
        _approveLease(carol);
        vm.prank(bob);
        lease.claimInitial(100e6, 1e6);
        address[] memory actors = new address[](3);
        actors[0] = alice;
        actors[1] = bob;
        actors[2] = carol;
        handler = new HarbergerLeaseHandler(lease, token, actors);
        targetContract(address(handler));
    }

    function invariant_leaseTokenBalanceIsFullyAccounted() public view {
        assertEq(token.balanceOf(address(lease)), lease.accountedBalance());
    }

    function invariant_noInsolventOrVacantHolderIsEligible() public view {
        HarbergerFeeLease.Lease memory state = lease.leaseState();
        if (
            state.holder == address(0) || state.arrears != 0
                || block.timestamp > lease.solvencyUntil()
        ) {
            assertEq(lease.activeHolder(pool), address(0));
        }
    }

    function _fund(address account) internal {
        token.mint(account, 1_000e6);
        vm.prank(account);
        token.approve(address(auction), type(uint256).max);
    }

    function _approveLease(address account) internal {
        vm.prank(account);
        token.approve(address(lease), type(uint256).max);
    }

    function _commit(address account, uint128 amount) internal {
        bytes32 commitment = auction.commitmentHash(auctionId, account, amount, SALT);
        vm.prank(account);
        auction.commit(auctionId, commitment);
    }

    function _reveal(address account, uint128 amount) internal {
        vm.prank(account);
        auction.reveal(auctionId, amount, SALT);
    }
}
