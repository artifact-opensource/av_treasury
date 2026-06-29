'use client'

import { useReadContracts } from 'wagmi'
import { AV_CONTRACTS, TOKENS } from '@/lib/constants'
import { AV_ORACLE_ABI } from '@/lib/abis'

export function useOraclePrices() {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      {
        address: AV_CONTRACTS.oracle,
        abi: AV_ORACLE_ABI,
        functionName: 'getPrice',
        args: [TOKENS.au],
      },
      {
        address: AV_CONTRACTS.oracle,
        abi: AV_ORACLE_ABI,
        functionName: 'getPrice',
        args: [TOKENS.ag],
      },
      {
        address: AV_CONTRACTS.oracle,
        abi: AV_ORACLE_ABI,
        functionName: 'getTvl',
      },
    ],
  })

  const auPrice = data?.[0]?.result as [bigint, bigint, number, boolean] | undefined
  const agPrice = data?.[1]?.result as [bigint, bigint, number, boolean] | undefined
  const tvl = data?.[2]?.result as [bigint, bigint, bigint, boolean] | undefined

  return {
    au: auPrice ? {
      price: auPrice[0],
      timestamp: auPrice[1],
      source: auPrice[2],
      valid: auPrice[3],
    } : null,
    ag: agPrice ? {
      price: agPrice[0],
      timestamp: agPrice[1],
      source: agPrice[2],
      valid: agPrice[3],
    } : null,
    tvl: tvl ? {
      tvl: tvl[0],
      twatvl: tvl[1],
      timestamp: tvl[2],
      valid: tvl[3],
    } : null,
    isLoading,
    refetch,
  }
}
