# @indexed-finance/sushi-rewarder

Rewarder contract for distributing NDX to users staking on Sushiswap's MasterChefV2.

This rewarder uses both Sushi's MasterChefV2 and Indexed's MultiTokenStaking (which is a fork of MasterChefV2). Each rewarder should have a staking pool on MultiTokenStaking for a dummy token only used by the rewarder, as well as a staking pool on MasterChefV2 for the actual staking token.

## Rewarder deployment

The following steps must be taken to deploy a new rewarder:
1. Compute the address of the dummy token for the pool with `getDummyTokenAddress`
2. Add the dummy token to MultiTokenStaking
3. Deploy the rewarder through the factory with the MTS pid and staking token, which will initialize staking on MultiTokenStaking
4. Add the staking token to MasterChefV2 and set the rewarder
5. Call `initMCV2` with the MCV2 PID

## Scripts

`yarn test`

Runs all tests in `test/`

`yarn coverage`

Runs all tests with solidity-coverage and generates a coverage report.

`yarn compile`

Compiles artifacts into `artifacts/` and generates typechain interfaces in `typechain/`

`yarn lint`

Runs solhint against the contracts.
