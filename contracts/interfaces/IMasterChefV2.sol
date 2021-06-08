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
  function userInfo(uint256 pid, address user) external view returns (UserInfo memory);
  function poolInfo(uint256 pid) external view returns (PoolInfo memory);
  function lpToken(uint256 pid) external view returns (address);
  function totalAllocPoint() external view returns (uint256);
  function deposit(uint256 _pid, uint256 _amount, address _to) external;
  function harvest(uint256 _pid, address _to) external;
}