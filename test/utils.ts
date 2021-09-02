import { getContractAddress } from '@ethersproject/address';
import { JsonRpcSigner } from '@ethersproject/providers';
import { BigNumber, Contract, ContractTransaction } from 'ethers';
import { ethers, network } from 'hardhat';

export const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

export const sendEtherTo = (address: string, amount: BigNumber = getBigNumber(1)) => withSigner(WETH, async (signer) => {
  const factory = await ethers.getContractFactory('SendEth');
  const tx = await factory.getDeployTransaction(address);
  await signer.sendTransaction({ data: tx.data, value: amount });
});

export function getBigNumber(n: number, decimals = 18) {
  return BigNumber.from(10).pow(decimals).mul(n);
}

export async function getContractBase<C extends Contract>(address: string, name: string): Promise<C> {
  let contract = await ethers.getContractAt(name, address);
  return contract as C;
}

export async function getNextContractAddress(account: string): Promise<string> {
  const nonce = await ethers.provider.getTransactionCount(account);
  return getContractAddress({ from: account, nonce });
}

export async function getTransactionCost(tx: ContractTransaction | Promise<ContractTransaction>) {
  const { wait, gasPrice } = await Promise.resolve(tx);
  const { gasUsed } = await wait()
  return gasUsed.mul(gasPrice);
}

//#region Chain utils
export async function pauseMining() {
  await network.provider.send("evm_setAutomine", [false]);
  const resume = () => network.provider.send("evm_setAutomine", [true]);
  const mineBlock = () => network.provider.send("evm_mine");
  return { resume, mineBlock }
}

export async function resetFork() {
  await network.provider.request({
    method: 'hardhat_reset',
    params: [{
      forking: {
        jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
        blockNumber: 12667185
      }
    }]
  })
}

export async function createSnapshot() {
  let snapshotId = await network.provider.request({
    method: 'evm_snapshot'
  });
  return async () => {
    await network.provider.request({
      method: 'evm_revert',
      params: [snapshotId]
    });
    snapshotId = await network.provider.request({
      method: 'evm_snapshot'
    });
  }
}
//#endregion

//#region Impersonation utils

export async function impersonate(address: string) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address]
  });
  return ethers.provider.getSigner(address);
}

export async function stopImpersonating(address: string) {
  await network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [address]
  });
}

export async function withSigner<T = void>(address: string, fn: (signer: JsonRpcSigner) => Promise<T>): Promise<T> {
  const signer = await impersonate(address);
  const result: T = await fn(signer);
  await stopImpersonating(address);
  return result;
}

export async function getContract<C extends Contract>(address: string, name: string, signer?: string | JsonRpcSigner): Promise<C> {
  let contract = await getContractBase(address, name);
  if (signer) {
    const _signer = typeof signer === 'string' ? await impersonate(signer) : signer;
    contract = contract.connect(_signer);
  }
  return contract as C;
}
//#endregion

/* Other Utils */
export async function deploy(bytecode: string): Promise<string> {
  const [signer] = await ethers.getSigners();
  const tx = await signer.sendTransaction({ data: bytecode });
  const { contractAddress } = await tx.wait();
  return contractAddress;
}

export async function deployContract<C extends Contract>(name: string, ...args: any[]): Promise<C> {
  const f = await ethers.getContractFactory(name);
  const c = await f.deploy(...args);
  return c as C;
}