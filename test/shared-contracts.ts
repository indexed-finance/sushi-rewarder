import { BigNumber, constants } from "ethers"
import { IMasterChefV2 } from "../typechain"
import { getContract, sendEtherTo, withSigner } from "./utils"

export async function twoManyChefs(stakingToken: string, dummyToken: string, rewarder: string) {
  const multiTokenStaking = await getContract<IMasterChefV2>('0xC46E0E7eCb3EfCC417f6F89b940FFAFf72556382', 'IMasterChefV2')
  const masterChefV2 = await getContract<IMasterChefV2>('0xEF0881eC094552b2e128Cf945EF17a6752B4Ec5d', 'IMasterChefV2')
  const masterChefV2Owner = await masterChefV2.owner()
  const multiTokenStakingAllocator = await multiTokenStaking.pointsAllocator()

  await sendEtherTo(masterChefV2.address)
  await sendEtherTo(multiTokenStakingAllocator)
  await sendEtherTo(masterChefV2Owner)

  function addToMasterChef() {
    return withSigner<BigNumber>(masterChefV2Owner, async (signer) => {
      await masterChefV2.connect(signer).add(100, stakingToken, rewarder)
      return (await masterChefV2.poolLength()).sub(1)
    })
  }

  function addToMultiTokenStaking() {
    return withSigner<BigNumber>(multiTokenStakingAllocator, async (signer) => {
      await multiTokenStaking.connect(signer).add(100, dummyToken, constants.AddressZero)
      return (await multiTokenStaking.poolLength()).sub(1)
    })
  }

  return {
    multiTokenStaking,
    masterChefV2,
    masterChefV2Owner,
    multiTokenStakingAllocator,
    addToMasterChef,
    addToMultiTokenStaking
  }
}