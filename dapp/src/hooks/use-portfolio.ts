'use client'

import { useReadContracts, useAccount } from 'wagmi'
import { AV_CONTRACTS, TOKENS } from '@/lib/constants'
import { AU_TOKEN_ABI, AG_TOKEN_ABI, AERODROME_POOL_ABI, AERODROME_GAUGE_ABI, STAKING_ABI } from '@/lib/abis'

export function usePortfolio() {
  const { address } = useAccount()

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      {
        address: TOKENS.au,
        abi: AU_TOKEN_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
      },
      {
        address: TOKENS.ag,
        abi: AG_TOKEN_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
      },
      {
        address: TOKENS.au,
        abi: AU_TOKEN_ABI,
        functionName: 'totalSupply',
      },
      {
        address: TOKENS.ag,
        abi: AG_TOKEN_ABI,
        functionName: 'totalSupply',
      },
      {
        address: TOKENS.ag,
        abi: AG_TOKEN_ABI,
        functionName: 'getVotes',
        args: address ? [address!] : undefined,
      },
      {
        address: AV_CONTRACTS.staking,
        abi: STAKING_ABI,
        functionName: '_ownerStakes',
        args: address ? [address] : undefined,
      },
      {
        address: AV_CONTRACTS.staking,
        abi: STAKING_ABI,
        functionName: 'auRewardPerBlock',
      },
      {
        address: AV_CONTRACTS.staking,
        abi: STAKING_ABI,
        functionName: 'agRewardPerBlock',
      },
    ],
    query: {
      enabled: !!address,
    },
  })

  return {
    auBalance: (data?.[0]?.result as bigint) ?? 0n,
    agBalance: (data?.[1]?.result as bigint) ?? 0n,
    auSupply: (data?.[2]?.result as bigint) ?? 0n,
    agSupply: (data?.[3]?.result as bigint) ?? 0n,
    votingPower: (data?.[4]?.result as bigint) ?? 0n,
    stakedNFTs: (data?.[5]?.result as bigint[]) ?? [],
    auRewardPerBlock: (data?.[6]?.result as bigint) ?? 0n,
    agRewardPerBlock: (data?.[7]?.result as bigint) ?? 0n,
    isLoading,
    refetch,
  }
}
