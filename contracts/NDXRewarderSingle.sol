// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import "./libraries/BoringMath.sol";
import "./libraries/TransferHelper.sol";
import "./interfaces/IMasterChefV2.sol";
import "./interfaces/INDXRewarderSingle.sol";
import "./interfaces/IERC20.sol";
import "./DummyERC20.sol";
import "hardhat/console.sol";


contract NDXRewarderSingle is INDXRewarderSingle {
  using BoringMath for uint256;
  using BoringMath128 for uint128;
  using TransferHelper for address;

/* ==========  Constants  ========== */

  uint128 private constant ACC_REWARDS_PRECISION = 1e12;
  address public constant rewardToken = 0x86772b1409b61c639EaAc9Ba0AcfBb6E238e5F83;
  IMasterChefV2 public constant multiTokenStaking = IMasterChefV2(0xC46E0E7eCb3EfCC417f6F89b940FFAFf72556382);
  IMasterChefV2 public constant masterChefV2 = IMasterChefV2(0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d);
  IRewardsSchedule public constant rewardsSchedule = IRewardsSchedule(0x131BA0fC3e4e866E5daF3d16526846FdD3E67623);

/* ==========  Storage  ========== */

  address public override stakingToken;
  address public override dummyToken;
  uint128 public override masterChefPid;
  uint128 public override multiTokenStakingPid;
  PoolInfo internal _poolInfo;
  mapping(address => UserInfo) internal _userInfo;

/* ==========  Modifiers  ========== */

  modifier onlyOwnPid(uint256 pid) {
    require(pid == masterChefPid, "Invalid PID");
    _;
  }

  modifier onlyMCV2 {
    require(msg.sender == address(masterChefV2), "Only MCV2 can call this function.");
    _;
  }

/* ==========  Initializer  ========== */

  function initMTS(
    address _stakingToken,
    address _dummyToken,
    uint128 _multiTokenStakingPid
  ) external {
    require(dummyToken == address(0), "Already initialized MTS");
    require(multiTokenStaking.lpToken(_multiTokenStakingPid) == _dummyToken, "Bad PID");
    stakingToken = _stakingToken;
    dummyToken = _dummyToken;
    multiTokenStakingPid = _multiTokenStakingPid;
    multiTokenStaking.deposit(_multiTokenStakingPid, 1, address(this));
    _poolInfo.lastRewardBlock = uint64(block.number);
  }

  function initMCV2(uint128 _masterChefPid) external {
    require(masterChefPid == 0, "Already initialized MCV2");
    require(masterChefV2.lpToken(_masterChefPid) == stakingToken, "Bad PID");
    masterChefPid = _masterChefPid;
  }

/* ==========  Queries  ========== */

  function poolInfo(uint256 pid) external view override onlyOwnPid(pid) returns (PoolInfo memory) {
    return _poolInfo;
  }

  function userInfo(uint256 pid, address user) external view override onlyOwnPid(pid) returns (UserInfo memory) {
    return _userInfo[user];
  }

  function getRewardsForBlockRange(uint256 from, uint256 to) public view override returns (uint256) {
    Structs.PoolInfo memory info = multiTokenStaking.poolInfo(multiTokenStakingPid);
    uint256 total = rewardsSchedule.getRewardsForBlockRange(from, to);
    return total.mul(info.allocPoint) / multiTokenStaking.totalAllocPoint();
  }

  function rewardPerSecond() external view override returns (uint256) {
    uint256 rewardsThisBlock = getRewardsForBlockRange(block.number, block.number + 1);
    return rewardsThisBlock / 13;
  }

/* ==========  Actions  ========== */

  function updatePool(uint256 _pid) public override onlyOwnPid(_pid) returns (PoolInfo memory pool) {
    pool = _poolInfo;
    if (block.number > pool.lastRewardBlock) {
      uint256 lpSupply = IERC20(stakingToken).balanceOf(address(masterChefV2));
      if (lpSupply > 0) {
        uint256 poolRewards = multiTokenStaking.pendingRewards(multiTokenStakingPid, address(this));
        multiTokenStaking.harvest(multiTokenStakingPid, address(this));
        pool.accRewardsPerShare = pool.accRewardsPerShare.add((poolRewards.mul(ACC_REWARDS_PRECISION) / lpSupply).to128());
        pool.lastRewardBlock = block.number.to64();
        _poolInfo = pool;
      }
      emit LogUpdatePool(_pid, pool.lastRewardBlock, lpSupply, pool.accRewardsPerShare);
    }
  }

  function onSushiReward(
    uint256 pid,
    address _user,
    address to,
    uint256,
    uint256 lpToken
  )
    external
    override
    onlyMCV2 // onlyOwnPid not needed because of updatePool call
  {
    PoolInfo memory pool = updatePool(pid);
    UserInfo storage user = _userInfo[_user];
    uint256 accumulatedRewards = user.amount.mul(pool.accRewardsPerShare) / ACC_REWARDS_PRECISION;
    uint256 pending = accumulatedRewards.sub(user.rewardDebt);
    if (pending > 0) {
      rewardToken.safeTransfer(to, pending);
    }
    user.amount = lpToken;
    user.rewardDebt = lpToken.mul(pool.accRewardsPerShare) / ACC_REWARDS_PRECISION;
    emit LogOnReward(_user, pid, pending, to);
  }

  function pendingTokens(
    uint256 pid,
    address user,
    uint256
  )
    external
    view
    override
    returns (address[] memory rewardTokens, uint256[] memory rewardAmounts)
  {
    rewardTokens = new address[](1);
    rewardAmounts = new uint256[](1);
    rewardTokens[0] = rewardToken;
    rewardAmounts[0] = pendingToken(pid, user);
  }

  function pendingToken(uint256 _pid, address _user) public view onlyOwnPid(_pid) returns (uint256 pending) {
    PoolInfo memory pool = _poolInfo;
    UserInfo storage user = _userInfo[_user];
    uint256 lpSupply = IERC20(stakingToken).balanceOf(address(masterChefV2));
    if (lpSupply > 0) {
      if (block.number > pool.lastRewardBlock) {
        uint256 poolRewards = multiTokenStaking.pendingRewards(multiTokenStakingPid, address(this));
        pool.accRewardsPerShare = pool.accRewardsPerShare.add((poolRewards.mul(ACC_REWARDS_PRECISION) / lpSupply).to128());
      }
      uint256 accumulatedRewards = user.amount.mul(pool.accRewardsPerShare) / ACC_REWARDS_PRECISION;
      return accumulatedRewards.sub(user.rewardDebt);
    }
  }
}