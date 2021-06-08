// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import "./IMasterChefV2.sol";

interface INDXRewarder is Structs {
  event LogOnReward(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
  event LogPoolAddition(uint256 indexed pid, uint256 allocPoint);
  event LogSetPool(uint256 indexed pid, uint256 allocPoint);
  event LogUpdatePool(uint256 indexed pid, uint64 lastRewardBlock, uint256 lpSupply, uint256 accSushiPerShare);
  event LogInit();

  function pendingTokens(uint256 pid, address user, uint256 sushiAmount)
    external
    view
    returns (address[] memory rewardTokens, uint256[] memory rewardAmounts);
  
  function onSushiReward(uint256 pid, address _user, address to, uint256, uint256 lpToken) external;

  function updatePool(uint256 _pid) external returns (PoolInfo memory pool);

  function getRewardsForBlockRange(uint256 from, uint256 to) external view returns (uint256);

  function add(uint256 _pid) external;

  function massUpdatePools() external;

  function init(uint256 pid) external;
}