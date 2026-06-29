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

  // getPrice returns (uint256 price, uint8 source)
  const auResult = data?.[0]?.result as [bigint, number] | undefined
  const agResult = data?.[1]?.result as [bigint, number] | undefined
  // getTvl returns (uint256 tvl, uint256 twatvl, uint256 timestamp, bool valid)
  const tvlResult = data?.[2]?.result as [bigint, bigint, bigint, boolean] | undefined

  return {
    au: auResult ? {
      price: auResult[0],
      source: auResult[1],
    } : null,
    ag: agResult ? {
      price: agResult[0],
      source: agResult[1],
    } : null,
    tvl: tvlResult ? {
      tvl: tvlResult[0],
      twatvl: tvlResult[1],
      timestamp: tvlResult[2],
      valid: tvlResult[3],
    } : null,
    isLoading,
    refetch,
  }
}
