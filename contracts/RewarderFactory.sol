// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "./libraries/CloneLibrary.sol";
import "./DummyERC20.sol";
import "./NDXRewarderSingle.sol";


contract RewarderFactory {
  using CloneLibrary for address;

  IMasterChefV2 public constant masterChefV2 = IMasterChefV2(0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d);
  address public immutable dummyERC20Implementation;
  address public immutable ndxRewarderSingleImplementation;

  mapping(address => address) public rewarderByStakingToken;

  constructor() {
    dummyERC20Implementation = address(new DummyERC20());
    ndxRewarderSingleImplementation = address(new NDXRewarderSingle());
  }

  function deployRewarder(uint128 masterChefPid) external {
    address stakingToken = masterChefV2.lpToken(masterChefPid);
    require(rewarderByStakingToken[stakingToken] == address(0), "Rewarder exists");
    address dummyToken = dummyERC20Implementation.createClone();
    address rewarder = ndxRewarderSingleImplementation.createClone();
    DummyERC20(dummyToken).setRewarder(rewarder);
    NDXRewarderSingle(rewarder).init(dummyToken, masterChefPid);
  }
}