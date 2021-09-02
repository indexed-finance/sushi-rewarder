import { getCreate2Address } from "@ethersproject/address"
import { keccak256 } from "@ethersproject/keccak256"
import { expect } from "chai"
import { BigNumber } from "ethers"
import { waffle } from "hardhat"
import { DummyERC20, IMasterChefV2, NDXRewarderSingle, RewarderFactory, TestERC20 } from "../typechain"
import { twoManyChefs } from "./shared-contracts"
import { deployContract, getContract } from "./utils"

const hash = (hex: string) => keccak256(Buffer.from(hex, 'hex'))

const toInitCode = (target: string) => `3d602d80600a3d3981f3363d3d373d3d3d363d73${target.slice(2)}5af43d82803e903d91602b57fd5bf3`
const toInitCodeHash = (target: string) => hash(toInitCode(target))
const toSalt = (stakingToken: string) => hash(stakingToken.slice(2).padStart(64, '0'))

describe('RewarderFactory', () => {
  const [wallet, wallet1] = waffle.provider.getWallets()
  let factory: RewarderFactory
  let stakingToken: TestERC20
  let multiTokenStaking: IMasterChefV2
  let masterChefV2: IMasterChefV2
  let dummyClone: string
  let rewarderClone: string
  let mtsPid: BigNumber

  let addToMasterChef: () => Promise<BigNumber>
  let addToMultiTokenStaking: () => Promise<BigNumber>

  before(async () => {
    factory = await deployContract('RewarderFactory')
    stakingToken = await deployContract('TestERC20')
    dummyClone = getCreate2Address(factory.address, toSalt(stakingToken.address), toInitCodeHash(await factory.dummyERC20Implementation()))
    rewarderClone = getCreate2Address(factory.address, toSalt(stakingToken.address), toInitCodeHash(await factory.ndxRewarderSingleImplementation()))
    ;({
      multiTokenStaking,
      masterChefV2,
      addToMasterChef,
      addToMultiTokenStaking
    } = await twoManyChefs(stakingToken.address, dummyClone, rewarderClone));
  })

  describe('getDummyTokenAddress()', () => {
    it('Should return C2 address for dummy ERC20 clone with staking token hash salt', async () => {
      expect(await factory.getDummyTokenAddress(stakingToken.address))
        .to.eq(dummyClone)
    })
  })

  describe('getDummyTokenAddress()', () => {
    it('Should return C2 address for dummy ERC20 clone with staking token hash salt', async () => {
      expect(await factory.getRewarderAddress(stakingToken.address))
        .to.eq(rewarderClone)
    })
  })

  describe('deployRewarder', () => {
    it('Should revert if not called by owner', async () => {
      await expect(factory.connect(wallet1).deployRewarder(stakingToken.address, 1))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('Should deploy rewarder and dummy token clones with create2 and staking token hash salt', async () => {
      mtsPid = await addToMultiTokenStaking()
      await factory.deployRewarder(stakingToken.address, mtsPid)
      expect((await waffle.provider.getCode(dummyClone)).length).to.eq(92)
      expect((await waffle.provider.getCode(rewarderClone)).length).to.eq(92)
    })

    it('Should set rewarderByStakingToken', async () => {
      expect(await factory.rewarderByStakingToken(stakingToken.address)).to.eq(rewarderClone)
    })

    it('Should initialize rewarder and dummy token', async () => {
      const rewarder = await getContract<NDXRewarderSingle>(rewarderClone, 'NDXRewarderSingle')
      const dummy = await getContract<DummyERC20>(dummyClone, 'DummyERC20')
      expect(await rewarder.multiTokenStakingPid()).to.eq(mtsPid)
      expect(await rewarder.stakingToken()).to.eq(stakingToken.address)
      expect(await rewarder.dummyToken()).to.eq(dummyClone)
      expect(await dummy.rewarder()).to.eq(rewarderClone)
    })
  })
})