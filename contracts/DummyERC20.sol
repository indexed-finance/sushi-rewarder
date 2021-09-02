// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;


contract DummyERC20 {
  string public name = "MultiTokenStaking Dummy";
  string public symbol = "MTSDUMMY";

  uint256 public constant totalSupply = 1;
  address public constant multiTokenStaking = 0xC46E0E7eCb3EfCC417f6F89b940FFAFf72556382;

  address public immutable factory;
  address public rewarder;

  constructor() {
    factory = msg.sender;
  }

  function setRewarder(address _rewarder) external {
    require(rewarder == address(0), "Rewarder already set");
    require(msg.sender == factory, "Not factory");
    rewarder = _rewarder;
  }

  function balanceOf(address account) external pure returns (uint256) {
    if (account == multiTokenStaking) {
      return totalSupply;
    }
    return 0;
  }

  function transferFrom(address from, address to, uint256 amount) external view returns (bool) {
    if (
      from == rewarder &&
      msg.sender == multiTokenStaking &&
      to == multiTokenStaking &&
      amount == totalSupply
    ) {
      return true;
    }
    return false;
  }
}