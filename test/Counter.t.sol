// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../src/Counter.sol";

contract CounterTest is Test {
    Counter private c;

    function setUp() public {
        c = new Counter();
    }

    function test_setNumber() public {
        c.setNumber(10);
        assertEq(c.number(), 10);
    }

    function test_increment_usesLibrary() public {
        c.setNumber(1);
        c.increment();
        assertEq(c.number(), 2);
    }

    function test_decrement() public {
        c.setNumber(2);
        c.decrement();
        assertEq(c.number(), 1);
    }

    function test_decrement_revertsWhenZero() public {
        // number starts at 0
        vm.expectRevert(bytes("Counter: number cannot be negative"));
        c.decrement();
    }

    function test_reset() public {
        c.setNumber(99);
        c.reset();
        assertEq(c.number(), 0);
    }
}
