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

    function testPermitSetsExactAllowanceAndCannotReplay() public {
        uint256 signerKey = 0xA11CE;
        address signer = vm.addr(signerKey);
        uint256 amount = 25 * 1e6;
        uint256 deadline = block.timestamp + 15 minutes;
        token.mint(signer, amount);

        (uint8 v, bytes32 r, bytes32 s) =
            _permitSignature(signerKey, signer, escrow, amount, deadline);
        token.permit(signer, escrow, amount, deadline, v, r, s);

        assertEq(token.allowance(signer, escrow), amount);
        assertEq(token.nonces(signer), 1);
        vm.expectRevert();
        token.permit(signer, escrow, amount, deadline, v, r, s);
    }

    function testPermitRejectsExpiredAuthorization() public {
        uint256 signerKey = 0xB0B;
        address signer = vm.addr(signerKey);
        uint256 deadline = block.timestamp + 1;
        (uint8 v, bytes32 r, bytes32 s) = _permitSignature(signerKey, signer, escrow, 1, deadline);
        vm.warp(deadline + 1);
        vm.expectRevert();
        token.permit(signer, escrow, 1, deadline, v, r, s);
        assertEq(token.nonces(signer), 0);
    }

    function _permitSignature(
        uint256 signerKey,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 typeHash = keccak256(
            "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
        );
        bytes32 structHash =
            keccak256(abi.encode(typeHash, owner, spender, value, token.nonces(owner), deadline));
        bytes32 digest =
            keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        return vm.sign(signerKey, digest);
    }
}
