// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PFDAAuction} from "../src/PFDAAuction.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";

/// @dev Token fault injection for transaction rollback and reentrancy tests only.
contract AdversarialBidToken is ERC20 {
    bool public tax;
    bool public failTransfer;
    bool public reenter;
    bool public guardObserved;
    PFDAAuction public target;

    constructor() ERC20("Adversarial token", "BAD") {}

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }

    function setTax(bool enabled) external {
        tax = enabled;
    }

    function setFailTransfer(bool enabled) external {
        failTransfer = enabled;
    }

    function arm(PFDAAuction target_) external {
        target = target_;
        reenter = true;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (failTransfer) return false;
        _attemptReentry();
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        _attemptReentry();
        return super.transferFrom(from, to, value);
    }

    function _attemptReentry() private {
        if (!reenter) return;
        reenter = false;
        try target.collectProceeds() {
            revert("reentrancy unexpectedly succeeded");
        } catch (bytes memory reason) {
            require(
                keccak256(reason)
                    == keccak256(
                        abi.encodeWithSelector(
                            ReentrancyGuard.ReentrancyGuardReentrantCall.selector
                        )
                    ),
                "expected the reentrancy guard, not another failure"
            );
            guardObserved = true;
        }
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (tax && from != address(0) && to != address(0) && amount > 0) {
            super._update(from, to, amount - 1);
            super._update(from, address(0), 1);
        } else {
            super._update(from, to, amount);
        }
    }
}

contract PFDAAuctionTokenTest is Test {
    AdversarialBidToken internal token;
    PFDAAuction internal auction;
    address internal bidder = address(0xB1D);
    bytes32 internal constant SALT = bytes32(uint256(123));

    function setUp() public {
        vm.warp(1000);
        token = new AdversarialBidToken();
        auction = new PFDAAuction(token, 60);
        auction.createAuction(
            PoolId.wrap(bytes32(uint256(1))),
            PFDAAuction.Schedule(1000, 1100, 1200, 1260, 1360),
            10,
            1
        );
        token.mint(bidder, 1000);
        vm.prank(bidder);
        token.approve(address(auction), 1000);
    }

    function _commit() internal {
        bytes32 hash = keccak256(
            abi.encode(block.chainid, address(auction), uint256(1), bidder, uint128(100), SALT)
        );
        vm.prank(bidder);
        auction.commit(1, hash);
    }

    function _finalized() internal {
        _commit();
        vm.warp(1100);
        vm.prank(bidder);
        auction.reveal(1, 100, SALT);
        vm.warp(1200);
        auction.finalize(1);
    }

    function testFeeOnTransferDepositRevertsWithoutCreatingLiabilities() public {
        token.setTax(true);
        vm.expectRevert(PFDAAuction.UnsupportedToken.selector);
        _commit();
        assertEq(auction.getAuction(1).commitments, 0);
        assertEq(auction.totalRefundable(), 0);
        assertEq(token.balanceOf(bidder), 1000);
        assertEq(token.balanceOf(address(auction)), 0);
    }

    function testReentryDuringDepositBlocked() public {
        token.arm(auction);
        _commit();
        assertTrue(token.guardObserved());
        assertEq(auction.totalRefundable(), 10);
    }

    function testRefundTransferFailurePreservesClaimForRetry() public {
        _finalized();
        token.setFailTransfer(true);
        vm.prank(bidder);
        vm.expectRevert();
        auction.withdrawRefund(1);
        assertEq(auction.totalRefundable(), 10);
        (,,,, bool withdrawn) = auction.bids(1, bidder);
        assertFalse(withdrawn);
        token.setFailTransfer(false);
        vm.prank(bidder);
        auction.withdrawRefund(1);
        assertEq(token.balanceOf(bidder), 900);
    }

    function testProceedsTransferFailurePreservesCreditForRetry() public {
        _finalized();
        token.setFailTransfer(true);
        vm.expectRevert();
        auction.collectProceeds();
        assertEq(auction.treasuryCredit(), 100);
        token.setFailTransfer(false);
        auction.collectProceeds();
        assertEq(token.balanceOf(address(this)), 100);
    }

    function testReentryDuringProceedsBlocked() public {
        _finalized();
        token.arm(auction);
        auction.collectProceeds();
        assertTrue(token.guardObserved());
        assertEq(token.balanceOf(address(this)), 100);
        assertEq(auction.totalRefundable(), 10);
    }
}
