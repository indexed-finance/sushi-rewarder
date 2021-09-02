// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./libraries/CloneLibrary.sol";
import "./DummyERC20.sol";
import "./NDXRewarderSingle.sol";


contract RewarderFactory is Ownable() {
  using CloneLibrary for address;

  IMasterChefV2 public constant masterChefV2 = IMasterChefV2(0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d);
  address public immutable dummyERC20Implementation;
  address public immutable ndxRewarderSingleImplementation;

  mapping(address => address) public rewarderByStakingToken;

  constructor() {
    dummyERC20Implementation = address(new DummyERC20());
    ndxRewarderSingleImplementation = address(new NDXRewarderSingle());
  }

  function getDummyTokenAddress(address stakingToken) public view returns (address) {
    return dummyERC20Implementation.getCloneAddress(keccak256(abi.encode(stakingToken)));
  }

  function getRewarderAddress(address stakingToken) public view returns (address) {
    return ndxRewarderSingleImplementation.getCloneAddress(keccak256(abi.encode(stakingToken)));
  }

  function deployRewarder(
    address stakingToken,
    uint128 multiTokenStakingPid
  ) external onlyOwner {
    bytes32 salt = keccak256(abi.encode(stakingToken));
    address rewarder = ndxRewarderSingleImplementation.createClone(salt);
    address dummyToken = dummyERC20Implementation.createClone(salt);
    rewarderByStakingToken[stakingToken] = rewarder;
    DummyERC20(dummyToken).setRewarder(rewarder);
    NDXRewarderSingle(rewarder).initMTS(stakingToken, dummyToken, multiTokenStakingPid);
  }
}