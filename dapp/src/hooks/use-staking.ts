'use client'

import { useCallback } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useReadContracts, useAccount } from 'wagmi'
import { STAKING_ABI, AG_TOKEN_ABI } from '@/lib/abis'
import { AV_CONTRACTS, TOKENS } from '@/lib/constants'

export function useStaking() {
  const { address } = useAccount()

  const { data, isLoading, refetch } = useReadContracts({
    contracts: address ? [
      { address: AV_CONTRACTS.staking, abi: STAKING_ABI, functionName: '_ownerStakes', args: [address] },
      { address: AV_CONTRACTS.staking, abi: STAKING_ABI, functionName: 'totalWeights' },
      { address: AV_CONTRACTS.staking, abi: STAKING_ABI, functionName: 'totalStakedNFTs' },
      { address: AV_CONTRACTS.staking, abi: STAKING_ABI, functionName: 'auRewardPerBlock' },
      { address: AV_CONTRACTS.staking, abi: STAKING_ABI, functionName: 'agRewardPerBlock' },
      { address: AV_CONTRACTS.staking, abi: STAKING_ABI, functionName: 'agThreshold' },
      { address: AV_CONTRACTS.staking, abi: STAKING_ABI, functionName: 'getAgMultiplier', args: [address] },
      { address: AV_CONTRACTS.staking, abi: STAKING_ABI, functionName: 'minStakeDuration' },
    ] : [],
    query: { enabled: !!address },
  })

  const { data: txHash, writeContract, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const stake = useCallback((tokenId: bigint) => {
    writeContract({
      address: AV_CONTRACTS.staking,
      abi: STAKING_ABI,
      functionName: 'stake',
      args: [tokenId],
    })
  }, [writeContract])

  const unstake = useCallback((tokenId: bigint) => {
    writeContract({
      address: AV_CONTRACTS.staking,
      abi: STAKING_ABI,
      functionName: 'unstake',
      args: [tokenId],
    })
  }, [writeContract])

  const claimRewards = useCallback((tokenIds: bigint[]) => {
    writeContract({
      address: AV_CONTRACTS.staking,
      abi: STAKING_ABI,
      functionName: 'claimRewards',
      args: [tokenIds],
    })
  }, [writeContract])

  const delegate = useCallback(() => {
    writeContract({
      address: TOKENS.ag,
      abi: AG_TOKEN_ABI,
      functionName: 'delegate',
      args: [address!],
    })
  }, [address, writeContract])

  return {
    stakedNFTs: (data?.[0]?.result as bigint[]) ?? [],
    totalWeights: (data?.[1]?.result as bigint) ?? 0n,
    totalStakedNFTs: (data?.[2]?.result as bigint) ?? 0n,
    auRewardPerBlock: (data?.[3]?.result as bigint) ?? 0n,
    agRewardPerBlock: (data?.[4]?.result as bigint) ?? 0n,
    agThreshold: (data?.[5]?.result as bigint) ?? 0n,
    agMultiplier: (data?.[6]?.result as bigint) ?? 10000n,
    minStakeDuration: (data?.[7]?.result as bigint) ?? 86400n,
    stake,
    unstake,
    claimRewards,
    delegate,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    isLoading,
    refetch,
  }
}
