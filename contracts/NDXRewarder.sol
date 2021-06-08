// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./libraries/SignedSafeMath.sol";
import "./libraries/BoringMath.sol";
import "./libraries/TransferHelper.sol";
import "./interfaces/IMasterChefV2.sol";
import "./interfaces/INDXRewarder.sol";
import "./interfaces/IERC20.sol";
import "./DummyERC20.sol";


contract NDXRewarder is Ownable(), INDXRewarder {
  using TransferHelper for address;
  using BoringMath for uint256;
  using BoringMath128 for uint128;
  using SignedSafeMath for int256;

  uint256 private constant ACC_REWARDS_PRECISION = 1e12;
  address public constant rewardToken = 0x86772b1409b61c639EaAc9Ba0AcfBb6E238e5F83;
  IMasterChefV2 public constant multiTokenStaking = IMasterChefV2(0xC46E0E7eCb3EfCC417f6F89b940FFAFf72556382);
  IMasterChefV2 public constant masterChefV2 = IMasterChefV2(0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d);
  IRewardsSchedule public constant rewardsSchedule = IRewardsSchedule(0x131BA0fC3e4e866E5daF3d16526846FdD3E67623);
  address public immutable dummyToken;

  uint256 public ownPid;
  uint256 public totalAllocPoint;
  mapping(uint256 => PoolInfo) public poolInfo;
  mapping (uint256 => mapping (address => UserInfo)) public userInfo;
  uint256[] public poolIds;

  modifier onlyMasterChefV2 {
    require(msg.sender == address(masterChefV2), "Not MasterChefV2");
    _;
  }

  constructor() {
    dummyToken = address(new DummyERC20());
  }

  function massUpdatePools() external override {
    uint256 len = poolIds.length;
    for (uint256 i = 0; i < len; i++) {
      updatePool(poolIds[i]);
    }
  }

  function init(uint256 _pid) external override {
    require(ownPid == 0, "initialized");
    ownPid = _pid;
    multiTokenStaking.deposit(_pid, 1e18, address(this));
  }

  function add(uint256 _pid) external override onlyOwner {
    require(poolInfo[_pid].lastRewardBlock == 0, "pool exists");
    uint64 allocPoint = masterChefV2.poolInfo(_pid).allocPoint;
    poolInfo[_pid] = PoolInfo({
      accRewardsPerShare: 0,
      lastRewardBlock: block.number.to64(),
      allocPoint: allocPoint
    });
    poolIds.push(_pid);
    emit LogPoolAddition(_pid, allocPoint);
  }

  function getRewardsForBlockRange(uint256 from, uint256 to) public view override returns (uint256) {
    PoolInfo memory info = multiTokenStaking.poolInfo(ownPid);
    uint256 total = rewardsSchedule.getRewardsForBlockRange(from, to);
    return total.mul(info.allocPoint) / multiTokenStaking.totalAllocPoint();
  }

  function updatePool(uint256 _pid) public override onlyMasterChefV2 returns (PoolInfo memory pool) {
    pool = poolInfo[_pid];
    require(pool.lastRewardBlock != 0, "pool does not exist");
    if (block.number > pool.lastRewardBlock) {
      multiTokenStaking.harvest(_pid, address(this));
      uint64 allocPoint = masterChefV2.poolInfo(_pid).allocPoint;
      if (allocPoint != pool.allocPoint) {
        totalAllocPoint = totalAllocPoint.sub(pool.allocPoint).add(allocPoint);
        pool.allocPoint = allocPoint;
        emit LogSetPool(_pid, allocPoint);
      }
      uint256 lpSupply = IERC20(masterChefV2.lpToken(_pid)).balanceOf(address(masterChefV2));
      if (lpSupply > 0) {
        uint256 rewardsTotal = getRewardsForBlockRange(pool.lastRewardBlock, block.number);
        uint256 poolReward = rewardsTotal.mul(pool.allocPoint) / totalAllocPoint;
        pool.accRewardsPerShare = pool.accRewardsPerShare.add((poolReward.mul(ACC_REWARDS_PRECISION) / lpSupply).to128());
      }
      pool.lastRewardBlock = block.number.to64();
      poolInfo[_pid] = pool;
      emit LogUpdatePool(_pid, pool.lastRewardBlock, lpSupply, pool.accRewardsPerShare);
    }
  }

  function pendingToken(uint256 _pid, address _user) public view returns (uint256 pending) {
    PoolInfo memory pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_user];
    require(pool.lastRewardBlock != 0, "pool does not exist");
    uint256 lpSupply = IERC20(masterChefV2.lpToken(_pid)).balanceOf(address(masterChefV2));
    if (lpSupply > 0) {
      if (block.number > pool.lastRewardBlock) {
        uint256 _totalAllocPoint = totalAllocPoint;
        uint64 allocPoint = masterChefV2.poolInfo(_pid).allocPoint;
        if (allocPoint != pool.allocPoint) {
          _totalAllocPoint = _totalAllocPoint.sub(pool.allocPoint).add(allocPoint);
          pool.allocPoint = allocPoint;
        }
        uint256 rewardsTotal = getRewardsForBlockRange(pool.lastRewardBlock, block.number);
        uint256 poolReward = rewardsTotal.mul(pool.allocPoint) / _totalAllocPoint;
        pool.accRewardsPerShare = pool.accRewardsPerShare.add((poolReward.mul(ACC_REWARDS_PRECISION) / lpSupply).to128());
      }
      int256 accumulatedRewards = int256(user.amount.mul(pool.accRewardsPerShare) / ACC_REWARDS_PRECISION);
      return accumulatedRewards.sub(user.rewardDebt).toUInt256();
    }
  }

  function pendingTokens(uint256 pid, address user, uint256)
    external
    view
    override
    returns (address[] memory rewardTokens, uint256[] memory rewardAmounts)
  {
    rewardTokens = new address[](1);
    rewardTokens[0] = rewardToken;
    rewardAmounts = new uint256[](1);
    rewardAmounts[0] = pendingToken(pid, user);
  }

  function onSushiReward(uint256 pid, address _user, address to, uint256, uint256 lpToken) external override {
    PoolInfo memory pool = updatePool(pid);
    UserInfo storage user = userInfo[pid][_user];
    int256 accumulatedRewards = int256(user.amount.mul(pool.accRewardsPerShare) / ACC_REWARDS_PRECISION);
    uint256 _pendingRewards = accumulatedRewards.sub(user.rewardDebt).toUInt256();
    if (_pendingRewards > 0) {
      rewardToken.safeTransfer(to, _pendingRewards);
    }
    user.amount = lpToken;
    user.rewardDebt = accumulatedRewards;
    emit LogOnReward(_user, pid, _pendingRewards, to);
  }
}