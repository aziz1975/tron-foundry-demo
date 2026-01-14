// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

contract Counter {
    uint256 public number;

    function setNumber(uint256 n) external {
        number = n;
    }

    function increment() external {
        number += 1;
    }
}
