// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import "./IMasterChefV2.sol";

interface INDXRewarderSingle {
  event LogOnReward(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
  event LogPoolAddition(uint256 indexed pid, uint256 allocPoint);
  event LogSetPool(uint256 indexed pid, uint256 allocPoint);
  event LogUpdatePool(uint256 indexed pid, uint64 lastRewardTime, uint256 lpSupply, uint256 accSushiPerShare);
  event LogInit();

  struct UserInfo {
    uint256 amount;
    uint256 rewardDebt;
  }

  struct PoolInfo {
    uint128 accRewardsPerShare;
    uint64 lastRewardBlock;
  }

// Storage

  function dummyToken() external view returns (address);

  function stakingToken() external view returns (address);

  function masterChefPid() external view returns (uint128);

  function multiTokenStakingPid() external view returns (uint128);

  function userInfo(uint256 pid, address user) external view returns (UserInfo memory);

  function poolInfo(uint256 pid) external view returns (PoolInfo memory);

// Queries

  function pendingTokens(uint256 pid, address user, uint256 sushiAmount)
    external
    view
    returns (address[] memory rewardTokens, uint256[] memory rewardAmounts);

  function rewardPerSecond() external view returns (uint256);

  function getRewardsForBlockRange(uint256 from, uint256 to) external view returns (uint256);

// Queries

  function onSushiReward(uint256 pid, address _user, address to, uint256, uint256 lpToken) external;

  function updatePool(uint256) external returns (PoolInfo memory pool);
}