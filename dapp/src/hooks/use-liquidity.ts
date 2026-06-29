'use client'

import { useCallback } from 'react'
import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { AERODROME_ROUTER_ABI, AERODROME_POOL_ABI, AERODROME_GAUGE_ABI, AERODROME_VOTER_ABI } from '@/lib/abis'
import { AERODROME } from '@/lib/constants'

export function useLiquidity(poolAddress: `0x${string}` | undefined) {
  const { address } = useAccount()

  const { data: poolReserves, isLoading: isLoadingPool } = useReadContract({
    address: poolAddress,
    abi: AERODROME_POOL_ABI,
    functionName: 'getReserves',
    query: { enabled: !!poolAddress },
  })

  const { data: poolTokens, isLoading: isLoadingTokens } = useReadContracts({
    contracts: poolAddress ? [
      { address: poolAddress, abi: AERODROME_POOL_ABI, functionName: 'token0' as const },
      { address: poolAddress, abi: AERODROME_POOL_ABI, functionName: 'token1' as const },
      { address: poolAddress, abi: AERODROME_POOL_ABI, functionName: 'stable' as const },
      { address: poolAddress, abi: AERODROME_POOL_ABI, functionName: 'totalSupply' as const },
      { address: poolAddress, abi: AERODROME_POOL_ABI, functionName: 'balanceOf' as const, args: [address!] },
    ] : [],
    query: { enabled: !!poolAddress && !!address },
  })

  const { data: txHash, writeContract, isPending: isWriting } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const addLiquidity = useCallback((params: {
    tokenA: `0x${string}`; tokenB: `0x${string}`; stable: boolean;
    amountA: bigint; amountB: bigint; slippageBps?: number
  }) => {
    const { tokenA, tokenB, stable, amountA, amountB, slippageBps = 50 } = params
    const amountAMin = amountA - (amountA * BigInt(slippageBps)) / 10000n
    const amountBMin = amountB - (amountB * BigInt(slippageBps)) / 10000n
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)

    writeContract({
      address: AERODROME.routerV2,
      abi: AERODROME_ROUTER_ABI,
      functionName: 'addLiquidity',
      args: [tokenA, tokenB, stable, amountA, amountB, amountAMin, amountBMin, address!, deadline],
    })
  }, [address, writeContract])

  const removeLiquidity = useCallback((params: {
    tokenA: `0x${string}`; tokenB: `0x${string}`; stable: boolean; liquidity: bigint
  }) => {
    const { tokenA, tokenB, stable, liquidity } = params
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)
    writeContract({
      address: AERODROME.routerV2,
      abi: AERODROME_ROUTER_ABI,
      functionName: 'removeLiquidity',
      args: [tokenA, tokenB, stable, liquidity, 0n, 0n, address!, deadline],
    })
  }, [address, writeContract])

  return {
    reserves: poolReserves as readonly [bigint, bigint, bigint] | undefined,
    token0: (poolTokens?.[0]?.result as `0x${string}` | undefined) ?? undefined,
    token1: (poolTokens?.[1]?.result as `0x${string}` | undefined) ?? undefined,
    stable: (poolTokens?.[2]?.result as boolean | undefined) ?? false,
    totalSupply: (poolTokens?.[3]?.result as bigint | undefined) ?? 0n,
    userLpBalance: (poolTokens?.[4]?.result as bigint | undefined) ?? 0n,
    addLiquidity,
    removeLiquidity,
    txHash,
    isWriting,
    isConfirming,
    isSuccess,
    isLoading: isLoadingPool || isLoadingTokens,
  }
}

export function useGauge(gaugeAddress: `0x${string}` | undefined) {
  const { address } = useAccount()

  const { data, isLoading } = useReadContracts({
    contracts: gaugeAddress ? [
      { address: gaugeAddress, abi: AERODROME_GAUGE_ABI, functionName: 'balanceOf' as const, args: [address!] },
      { address: gaugeAddress, abi: AERODROME_GAUGE_ABI, functionName: 'earned' as const, args: [address!] },
      { address: gaugeAddress, abi: AERODROME_GAUGE_ABI, functionName: 'totalSupply' as const },
      { address: gaugeAddress, abi: AERODROME_GAUGE_ABI, functionName: 'stakingToken' as const },
      { address: gaugeAddress, abi: AERODROME_GAUGE_ABI, functionName: 'isAlive' as const },
    ] : [],
    query: { enabled: !!gaugeAddress && !!address },
  })

  const { data: txHash, writeContract, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const deposit = useCallback((amount: bigint) => {
    writeContract({
      address: gaugeAddress!,
      abi: AERODROME_GAUGE_ABI,
      functionName: 'deposit',
      args: [amount],
    })
  }, [gaugeAddress, writeContract])

  const withdraw = useCallback((amount: bigint) => {
    writeContract({
      address: gaugeAddress!,
      abi: AERODROME_GAUGE_ABI,
      functionName: 'withdraw',
      args: [amount],
    })
  }, [gaugeAddress, writeContract])

  const claimRewards = useCallback(() => {
    writeContract({
      address: gaugeAddress!,
      abi: AERODROME_GAUGE_ABI,
      functionName: 'getReward',
    })
  }, [gaugeAddress, writeContract])

  return {
    stakedBalance: (data?.[0]?.result as bigint) ?? 0n,
    earnedRewards: (data?.[1]?.result as bigint) ?? 0n,
    totalStaked: (data?.[2]?.result as bigint) ?? 0n,
    stakingToken: (data?.[3]?.result as `0x${string}`) ?? undefined,
    isAlive: (data?.[4]?.result as boolean) ?? false,
    deposit,
    withdraw,
    claimRewards,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    isLoading,
  }
}

export function useVoter() {
  const { data: txHash, writeContract, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const vote = useCallback((poolId: bigint, weight: bigint) => {
    writeContract({
      address: AERODROME.voter,
      abi: AERODROME_VOTER_ABI,
      functionName: 'vote',
      args: [poolId, weight],
    })
  }, [writeContract])

  return { vote, txHash, isPending, isConfirming, isSuccess }
}
