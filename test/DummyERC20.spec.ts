import { expect } from "chai"
import { constants } from "ethers"
import { waffle } from "hardhat"
import { DummyERC20 } from "../typechain"
import { createSnapshot, deployContract, impersonate, stopImpersonating } from "./utils"

describe('DummyERC20', () => {
  const [wallet, wallet1] = waffle.provider.getWallets()
  const multiTokenStaking = '0xC46E0E7eCb3EfCC417f6F89b940FFAFf72556382';
  let dummy: DummyERC20
  let reset: () => Promise<void>

  before(async () => {
    dummy = await deployContract('DummyERC20')
    reset = await createSnapshot()
  })

  beforeEach(() => reset())

  it('Should set factory address', async () => {
    expect(await dummy.factory()).to.eq(wallet.address)
  })

  describe('setRewarder()', () => {
    it('Should revert if not factory', async () => {
      await expect(dummy.connect(wallet1).setRewarder(constants.AddressZero))
        .to.be.revertedWith('Not factory')
    })

    it('Should revert if rewarder already set', async () => {
      await dummy.setRewarder(wallet1.address)
      await expect(dummy.setRewarder(wallet1.address))
        .to.be.revertedWith('Rewarder already set')
    })

    it('Should set rewarder', async () => {
      await dummy.setRewarder(wallet1.address)
      expect(await dummy.rewarder()).to.eq(wallet1.address)
    })
  })

  describe('balanceOf()', () => {
    it('Should return 0 if account not rewarder', async () => {
      expect(await dummy.balanceOf(wallet1.address)).to.eq(0)
    })

    it('Should return 1 if account is multiTokenStaking', async () => {
      expect(await dummy.balanceOf(multiTokenStaking)).to.eq(1)
    })
  })

  describe('transferFrom()', () => {
    beforeEach(async () => {
      await dummy.setRewarder(wallet1.address)
    })

    it('Should return false if caller not multiTokenStaking', async () => {
      expect(await dummy.callStatic.transferFrom(
        wallet1.address,
        multiTokenStaking,
        1
      )).to.be.false
    })

    it('Should return false if spender not rewarder', async () => {
      const signer = await impersonate(multiTokenStaking)
      expect(await dummy.connect(signer).callStatic.transferFrom(
        wallet.address,
        multiTokenStaking,
        1
      )).to.be.false
      await stopImpersonating(multiTokenStaking)
    })

    it('Should return false if recipient not multiTokenStaking', async () => {
      const signer = await impersonate(multiTokenStaking)
      expect(await dummy.connect(signer).callStatic.transferFrom(
        wallet1.address,
        wallet.address,
        1
      )).to.be.false
      await stopImpersonating(multiTokenStaking)
    })

    it('Should return false if amount not 1', async () => {
      const signer = await impersonate(multiTokenStaking)
      expect(await dummy.connect(signer).callStatic.transferFrom(
        wallet1.address,
        multiTokenStaking,
        2
      )).to.be.false
      await stopImpersonating(multiTokenStaking)
    })

    it('Should return true if all vars correct', async () => {
      const signer = await impersonate(multiTokenStaking)
      expect(await dummy.connect(signer).callStatic.transferFrom(
        wallet1.address,
        multiTokenStaking,
        1
      )).to.be.true
      await stopImpersonating(multiTokenStaking)
    })
  })
})