// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import "../NDXRewarderSingle.sol";

contract TestCaller {
  NDXRewarderSingle public immutable rewarder;
  uint256 public immutable masterChefPid;

  event LogRewards(uint256 rewards1, uint256 rewards2);

  constructor(address _rewarder, uint256 _masterChefPid) {
    rewarder = NDXRewarderSingle(_rewarder);
    masterChefPid = _masterChefPid;
  }

  function testUpdate() external {
    rewarder.updatePool(masterChefPid);
    rewarder.updatePool(masterChefPid);
  }

  function testPending(address account) external {
    uint256 rewards1 = rewarder.pendingToken(masterChefPid, account);
    rewarder.updatePool(masterChefPid);
    uint256 rewards2 = rewarder.pendingToken(masterChefPid, account);
    emit LogRewards(rewards1, rewards2);
  }
}