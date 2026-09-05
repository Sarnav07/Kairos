// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC internal token;
    address internal bidder = address(0xB1D);
    address internal escrow = address(0xE5C);

    function setUp() public {
        token = new MockUSDC();
    }

    function testBidTokenUnitsAndEscrowApproval() public {
        assertEq(token.decimals(), 6);
        token.mint(bidder, 100 * 1e6);
        vm.prank(bidder);
        token.approve(escrow, 25 * 1e6);
        vm.prank(escrow);
        assertTrue(token.transferFrom(bidder, escrow, 25 * 1e6));
        assertEq(token.balanceOf(bidder), 75 * 1e6);
        assertEq(token.balanceOf(escrow), 25 * 1e6);
        assertEq(token.allowance(bidder, escrow), 0);
    }

    function testEscrowCannotTakeUnapprovedFunds() public {
        token.mint(bidder, 100 * 1e6);
        vm.prank(escrow);
        vm.expectRevert();
        // The expected revert produces no return value to assert.
        // forge-lint: disable-next-line(erc20-unchecked-transfer)
        token.transferFrom(bidder, escrow, 1);
        assertEq(token.balanceOf(bidder), 100 * 1e6);
    }
}
