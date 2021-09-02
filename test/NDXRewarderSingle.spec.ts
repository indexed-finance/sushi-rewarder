import { expect } from 'chai'
import { BigNumber, constants } from 'ethers'
import { waffle } from 'hardhat'
import { DummyERC20, IERC20, TestERC20, IMasterChefV2, NDXRewarderSingle, IRewardsSchedule, TestCaller } from '../typechain'
import { twoManyChefs } from './shared-contracts'
import { createSnapshot, deployContract, getContract, impersonate, stopImpersonating, sendEtherTo, getBigNumber, withSigner, pauseMining } from './utils'

describe('NDXRewarderSingle', () => {
  const [wallet, wallet1] = waffle.provider.getWallets()

  let multiTokenStaking: IMasterChefV2
  let masterChefV2: IMasterChefV2
  let rewarder: NDXRewarderSingle
  let stakingToken: TestERC20
  let dummyToken: DummyERC20
  let schedule: IRewardsSchedule
  let ndx: IERC20
  let sushi: IERC20
  let reset: () => Promise<void>

  let addToMasterChef: () => Promise<BigNumber>
  let addToMultiTokenStaking: () => Promise<BigNumber>

  before(async () => {
    schedule = await getContract('0x131BA0fC3e4e866E5daF3d16526846FdD3E67623', 'IRewardsSchedule')
    /* multiTokenStaking = await getContract('0xC46E0E7eCb3EfCC417f6F89b940FFAFf72556382', 'IMasterChefV2')
    masterChefV2 = await getContract('0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d', 'IMasterChefV2') */
    rewarder = await deployContract('NDXRewarderSingle')
    dummyToken = await deployContract('DummyERC20')
    stakingToken = await deployContract('TestERC20')
    ;({
      multiTokenStaking,
      masterChefV2,
      addToMasterChef,
      addToMultiTokenStaking
    } = await twoManyChefs(stakingToken.address, dummyToken.address, rewarder.address));
    ndx = await getContract('0x86772b1409b61c639EaAc9Ba0AcfBb6E238e5F83', 'contracts/interfaces/IERC20.sol:IERC20')
    sushi = await getContract('0x6b3595068778dd592e39a122f4f5a5cf09c90fe2', 'contracts/interfaces/IERC20.sol:IERC20')
    await stakingToken.approve(masterChefV2.address, constants.MaxUint256)

    reset = await createSnapshot()
  })

  beforeEach(() => reset())

/*   function addToMasterChef() {
    return withSigner<BigNumber>(masterChefV2Owner, async (signer) => {
      await masterChefV2.connect(signer).add(100, stakingToken.address, rewarder.address)
      return (await masterChefV2.poolLength()).sub(1)
    })
  }

  function addToMultiTokenStaking() {
    return withSigner<BigNumber>(multiTokenStakingAllocator, async (signer) => {
      await multiTokenStaking.connect(signer).add(100, dummyToken.address, constants.AddressZero)
      return (await multiTokenStaking.poolLength()).sub(1)
    })
  } */

  async function initRewarder() {
    await dummyToken.setRewarder(rewarder.address)
    const mtsPid = await addToMultiTokenStaking()
    await rewarder.initMTS(stakingToken.address, dummyToken.address, mtsPid)
    const mcPid = await addToMasterChef()
    await rewarder.initMCV2(mcPid)

    return {mcPid, mtsPid}
  }

  const nextBlockRewards = async () => {
    const nextBlockNumber = (await waffle.provider.getBlockNumber()) + 1
    const totalAllocPoints = await multiTokenStaking.totalAllocPoint()
    const totalRewards = await schedule.getRewardsForBlockRange(nextBlockNumber, nextBlockNumber + 1)
    return totalRewards.mul(100).div(totalAllocPoints)
  }

  const pendingRewards = async (mcPid: BigNumber) => {
    const nextBlockNumber = (await waffle.provider.getBlockNumber()) + 1
    const { lastRewardBlock } = await rewarder.poolInfo(mcPid)
    return rewarder.getRewardsForBlockRange(lastRewardBlock, nextBlockNumber)
  }

  describe('initMTS()', () => {
    it('Should revert if dummy token already set', async () => {
      await dummyToken.setRewarder(rewarder.address)
      await rewarder.initMTS(stakingToken.address, dummyToken.address, await addToMultiTokenStaking())
      await expect(rewarder.initMTS(stakingToken.address, dummyToken.address, 1))
        .to.be.revertedWith('Already initialized MTS')
    })

    it('Should revert if mts PID not set to dummy token', async () => {
      await expect(rewarder.initMTS(stakingToken.address, dummyToken.address, 1))
        .to.be.revertedWith('Bad PID')
    })

    it('Should set dummy token, staking token, mts pid', async () => {
      await dummyToken.setRewarder(rewarder.address)
      const mtsPID = await addToMultiTokenStaking()
      await rewarder.initMTS(stakingToken.address, dummyToken.address, mtsPID)
      expect(await rewarder.stakingToken()).to.eq(stakingToken.address)
      expect(await rewarder.dummyToken()).to.eq(dummyToken.address)
      expect(await rewarder.multiTokenStakingPid()).to.eq(mtsPID)
    })

    it('Should set lastRewardBlock', async () => {
      await dummyToken.setRewarder(rewarder.address)
      const mtsPID = await addToMultiTokenStaking()
      await rewarder.initMTS(stakingToken.address, dummyToken.address, mtsPID)
      const blockNumber = await waffle.provider.getBlockNumber()
      const mcPID = await addToMasterChef()
      await rewarder.initMCV2(mcPID)
      expect((await rewarder.poolInfo(mcPID)).lastRewardBlock).to.eq(blockNumber)
    })
  })

  describe('initMCV2()', () => {
    it('Should revert if masterChefPid already set', async () => {
      await dummyToken.setRewarder(rewarder.address)
      await rewarder.initMTS(stakingToken.address, dummyToken.address, await addToMultiTokenStaking())
      await rewarder.initMCV2(await addToMasterChef())
      await expect(rewarder.initMCV2(0)).to.be.revertedWith('Already initialized MCV2')
    })

    it('Should revert if lpToken on MCV2 not staking token', async () => {
      await dummyToken.setRewarder(rewarder.address)
      await rewarder.initMTS(stakingToken.address, dummyToken.address, await addToMultiTokenStaking())
      await expect(rewarder.initMCV2(0)).to.be.revertedWith('Bad PID')
    })
  })

  describe('getRewardsForBlockRange', () => {
    it('Should return pool share of rewards', async () => {
      await initRewarder()
      const nextBlockNumber = (await waffle.provider.getBlockNumber()) + 1
      const totalAllocPoints = await multiTokenStaking.totalAllocPoint()
      const totalRewards = await schedule.getRewardsForBlockRange(nextBlockNumber, nextBlockNumber + 10)
      const rewards = totalRewards.mul(100).div(totalAllocPoints)
      expect(await rewarder.getRewardsForBlockRange(nextBlockNumber, nextBlockNumber + 10)).to.eq(rewards)
    })
  })

  describe('rewardPerSecond', () => {
    it('Should return pool share of rewards', async () => {
      await initRewarder()
      const rewardPerSecond = (await nextBlockRewards()).div(13)
      expect(await rewarder.rewardPerSecond({ blockTag: 'pending' })).to.eq(rewardPerSecond)
    })
  })

  describe('poolInfo', () => {
    it('Should revert if pid not masterchef pid', async () => {
      const {mcPid} = await initRewarder()
      await expect(rewarder.poolInfo(mcPid.sub(1)))
        .to.be.revertedWith('Invalid PID')
    })

    it('Should return pool info', async () => {
      const {mcPid} = await initRewarder()
      const { number: blockNumber } = await waffle.provider.getBlock('latest')
      const info = await rewarder.poolInfo(mcPid)
      expect(info.lastRewardBlock).to.eq(blockNumber - 2)
      expect(info.accRewardsPerShare).to.eq(0)
    })
  })

  describe('userInfo()', () => {
    it('Should revert if pid not masterchef pid', async () => {
      const {mcPid} = await initRewarder()
      await expect(rewarder.userInfo(mcPid.sub(1), constants.AddressZero))
        .to.be.revertedWith('Invalid PID')
    })
  })

  describe('updatePool()', () => {
    it('Should harvest pending rewards from MTS', async () => {
      const {mcPid, mtsPid} = await initRewarder()
      await stakingToken.mint(wallet.address, getBigNumber(2))
      await masterChefV2.deposit(mcPid, getBigNumber(1), wallet.address)
      const nextBlockNumber = (await waffle.provider.getBlockNumber()) + 1
      let { accRewardsPerShare, lastRewardBlock } = await multiTokenStaking.poolInfo(mtsPid)
      const totalRewards = (await schedule.getRewardsForBlockRange(lastRewardBlock, nextBlockNumber))
        .mul(100)
        .div(await multiTokenStaking.totalAllocPoint())
      accRewardsPerShare = accRewardsPerShare.add(totalRewards.mul(1e12))
      await expect(rewarder.updatePool(mcPid))
        .to.emit(multiTokenStaking, 'LogUpdatePool')
        .withArgs(mtsPid, nextBlockNumber, 1, accRewardsPerShare)
    })

    it('Should not update if already updated in same block', async () => {
      const {mcPid} = await initRewarder()
      const caller: TestCaller = await deployContract('TestCaller', rewarder.address, mcPid)
      await stakingToken.mint(wallet.address, getBigNumber(2))
      await masterChefV2.deposit(mcPid, getBigNumber(1), wallet.address)
      expect((await rewarder.poolInfo(mcPid)).accRewardsPerShare).to.eq(0)
      const tx = await caller.testUpdate()
      const receipt = await tx.wait()
      const events = receipt.events?.filter(e => e.address == rewarder.address && e.topics[0] == rewarder.interface.getEventTopic('LogUpdatePool(uint256,uint64,uint256,uint256)')) ?? []
      expect(events?.length).to.eq(1)
    })

    it('Should not update lastRewardBlock or accRewardsPerShare if no tokens are staked', async () => {
      const {mcPid} = await initRewarder()
      const { accRewardsPerShare, lastRewardBlock } = await rewarder.poolInfo(mcPid)
      await rewarder.updatePool(mcPid)
      const updatedInfo = await rewarder.poolInfo(mcPid)
      expect(updatedInfo.lastRewardBlock).to.eq(lastRewardBlock)
      expect(updatedInfo.accRewardsPerShare).to.eq(accRewardsPerShare)
    })

    it('Should update pool if tokens are staked', async () => {
      const {mcPid} = await initRewarder()
      await stakingToken.mint(wallet.address, getBigNumber(2))
      await masterChefV2.deposit(mcPid, getBigNumber(1), wallet.address)
      expect((await rewarder.poolInfo(mcPid)).accRewardsPerShare).to.eq(0)
      const { lastRewardBlock } = await rewarder.poolInfo(mcPid)
      const tx = await rewarder.updatePool(mcPid)
      const {blockNumber} = await (tx).wait()
      const totalRewards = (await schedule.getRewardsForBlockRange(lastRewardBlock, blockNumber))
        .mul(100)
        .div(await multiTokenStaking.totalAllocPoint())
      const accRewardsPerShare = totalRewards.mul(1e12).div(getBigNumber(1))
      expect(tx)
        .to.emit(rewarder, 'LogUpdatePool')
        .withArgs(mcPid, blockNumber, getBigNumber(1), accRewardsPerShare)
      const updated = await rewarder.poolInfo(mcPid)
      expect(updated.lastRewardBlock).to.eq(blockNumber)
      expect(updated.accRewardsPerShare).to.eq(accRewardsPerShare)
    })
  })

  describe('onSushiReward()', () => {
    it('Should revert if caller is not masterchef', async () => {
      await initRewarder()
      await expect(rewarder.onSushiReward(1, constants.AddressZero, constants.AddressZero, 0, constants.AddressZero))
        .to.be.revertedWith('Only MCV2 can call this function.')
    })

    it('Should not give rewards if none have accumulated', async () => {
      const {mcPid} = await initRewarder()
      await withSigner(masterChefV2.address, async (signer) => {
        const tx = await rewarder.connect(signer).onSushiReward(
          mcPid, wallet.address, wallet.address, 0, getBigNumber(1)
        )
        await expect(tx)
          .to.emit(rewarder, 'LogOnReward')
          .withArgs(wallet.address, mcPid, 0, wallet.address)
      })
      const userInfo = await rewarder.userInfo(mcPid, wallet.address)
      expect(userInfo.rewardDebt).to.eq(0)
      expect(userInfo.amount).to.eq(getBigNumber(1))
    })

    it('Should update userInfo and send rewards', async () => {
      const { mcPid } = await initRewarder()
      await withSigner(masterChefV2.address, async (signer) => {
        await rewarder.connect(signer).onSushiReward(
          mcPid, wallet.address, wallet.address, 0, getBigNumber(1)
        )
        await stakingToken.mint(masterChefV2.address, getBigNumber(1))
        const rewards = await pendingRewards(mcPid)
        const tx = await rewarder.connect(signer).onSushiReward(
          mcPid, wallet.address, wallet.address, 0, getBigNumber(2)
        )
        const { accRewardsPerShare } = await rewarder.poolInfo(mcPid)
        expect(accRewardsPerShare).to.eq(rewards.mul(1e12).div(getBigNumber(1)))
        const e = accRewardsPerShare.mul(getBigNumber(1)).div(1e12)

        await expect(tx)
          .to.emit(rewarder, 'LogOnReward')
          .withArgs(wallet.address, mcPid, e, wallet.address)
        const userInfo = await rewarder.userInfo(mcPid, wallet.address)
        expect(userInfo.amount).to.eq(getBigNumber(2))
        expect(userInfo.rewardDebt).to.eq(accRewardsPerShare.mul(getBigNumber(2)).div(1e12))
      })
    })
  })

  describe('pendingToken()', () => {
    it('Should revert if pid not masterchef pid', async () => {
      const {mcPid} = await initRewarder()
      await expect(rewarder.pendingToken(mcPid.sub(1), wallet.address)).to.be.revertedWith('Invalid PID')
    })

    it('Should return 0 if no tokens staked', async () => {
      const {mcPid} = await initRewarder()
      expect(await rewarder.pendingToken(mcPid, wallet.address)).to.eq(0)
    })

    it('Should return tokens owed to account', async () => {
      const {mcPid} = await initRewarder()
      await stakingToken.mint(wallet.address, getBigNumber(1))
      await masterChefV2.deposit(mcPid, getBigNumber(1), wallet.address)
      const rewards = (await pendingRewards(mcPid)).mul(1e12).div(getBigNumber(1)).mul(getBigNumber(1)).div(1e12)
      expect(await rewarder.pendingToken(mcPid, wallet.address, { blockTag: 'pending' })).to.eq(rewards)
    })

    it('Should not add pending tokens on mts if updated in same block', async () => {
      const {mcPid} = await initRewarder()
      const caller: TestCaller = await deployContract('TestCaller', rewarder.address, mcPid)
      await stakingToken.mint(wallet.address, getBigNumber(1))
      await masterChefV2.deposit(mcPid, getBigNumber(1), wallet.address)
      const rewards = (await pendingRewards(mcPid)).mul(1e12).div(getBigNumber(1)).mul(getBigNumber(1)).div(1e12)
      await expect(caller.testPending(wallet.address))
        .to.emit(caller, 'LogRewards')
        .withArgs(rewards, rewards)
    })
  })

  describe('pendingTokens()', () => {
    it('Should return pendingToken result as array with ndx as token', async () => {
      const {mcPid} = await initRewarder()
      await stakingToken.mint(wallet.address, getBigNumber(1))
      await masterChefV2.deposit(mcPid, getBigNumber(1), wallet.address)
      const rewards = (await pendingRewards(mcPid)).mul(1e12).div(getBigNumber(1)).mul(getBigNumber(1)).div(1e12)
      const { rewardTokens, rewardAmounts } = await rewarder.pendingTokens(mcPid, wallet.address, 0, { blockTag: 'pending' })
      expect(rewardTokens).to.deep.eq([ndx.address])
      expect(rewardAmounts).to.deep.eq([rewards])
    })
  })
})