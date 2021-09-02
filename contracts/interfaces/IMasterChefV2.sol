// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;


interface Structs {
  struct UserInfo {
    uint256 amount;
    int256 rewardDebt;
  }

  struct PoolInfo {
    uint128 accRewardsPerShare;
    uint64 lastRewardBlock;
    uint64 allocPoint;
  }
}


interface IRewardsSchedule {
  function getRewardsForBlockRange(uint256 from, uint256 to) external view returns (uint256);
}


interface IMasterChefV2 is Structs {
  event LogUpdatePool(uint256 indexed pid, uint64 lastRewardBlock, uint256 lpSupply, uint256 accRewardsPerShare);

  function userInfo(uint256 pid, address user) external view returns (UserInfo memory);
  function poolInfo(uint256 pid) external view returns (PoolInfo memory);
  function lpToken(uint256 pid) external view returns (address);
  function rewarder(uint256 pid) external view returns (address);
  function totalAllocPoint() external view returns (uint256);
  function deposit(uint256 _pid, uint256 _amount, address _to) external;
  function add(uint256 _allocPoint, address _lpToken, address _rewarder) external;
  function set(uint256 _pid, uint256 _allocPoint, address _rewarder, bool _overwrite) external;
  function harvest(uint256 _pid, address _to) external;
  function owner() external view returns (address);
  function pointsAllocator() external view returns (address);
  function poolLength() external view returns (uint256);
  function pendingRewards(uint256 _pid, address _user) external view returns (uint256 pending);
}