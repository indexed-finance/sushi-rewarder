// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract TestERC20 is ERC20("Test", "Test"){
  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }
}