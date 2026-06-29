'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, http, formatUnits } from 'viem'
import { base } from 'viem/chains'
import { AV_ORACLE_ABI, CHAINLINK_AGGREGATOR_ABI } from '@/lib/abis'
import { AV_CONTRACTS, CHAINLINK_FEEDS } from '@/lib/constants'

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
})

export interface PriceData {
  price: number
  timestamp: number
  source: number
  valid: boolean
}

// Fetch a single price directly via publicClient (no wallet needed)
async function fetchPrice(tokenAddress: string): Promise<PriceData | null> {
  try {
    const result = await publicClient.readContract({
      address: AV_CONTRACTS.oracle,
      abi: AV_ORACLE_ABI,
      functionName: 'getPrice',
      args: [tokenAddress as `0x${string}`],
    }) as [bigint, bigint, number, boolean]

    return {
      price: Number(formatUnits(result[0], 18)),
      timestamp: Number(result[1]),
      source: result[2],
      valid: result[3],
    }
  } catch {
    return null
  }
}

// Fetch Chainlink price directly
async function fetchChainlinkPrice(feedAddress: string): Promise<number | null> {
  try {
    const [answer, decimals] = await Promise.all([
      publicClient.readContract({
        address: feedAddress as `0x${string}`,
        abi: CHAINLINK_AGGREGATOR_ABI,
        functionName: 'latestRoundData',
      }).then((r) => (r as [bigint, bigint, bigint, bigint, bigint])[1]),
      publicClient.readContract({
        address: feedAddress as `0x${string}`,
        abi: CHAINLINK_AGGREGATOR_ABI,
        functionName: 'decimals',
      }) as Promise<number>,
    ])
    return Number(formatUnits(answer as bigint, decimals))
  } catch {
    return null
  }
}

export function useOraclePrices() {
  const [auPrice, setAuPrice] = useState<number | null>(null)
  const [agPrice, setAgPrice] = useState<number | null>(null)
  const [ethPrice, setEthPrice] = useState<number | null>(null)
  const [usdcPrice, setUsdcPrice] = useState<number | null>(null)
  const [tvl, setTvl] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [au, ag, eth, usdc, tvlData] = await Promise.all([
        fetchPrice(AV_CONTRACTS.auToken),
        fetchPrice(AV_CONTRACTS.agToken),
        fetchChainlinkPrice(CHAINLINK_FEEDS.ethUsd),
        fetchChainlinkPrice(CHAINLINK_FEEDS.usdcUsd),
        publicClient.readContract({
          address: AV_CONTRACTS.oracle,
          abi: AV_ORACLE_ABI,
          functionName: 'getTvl',
        }).catch(() => null) as Promise<[bigint, bigint, bigint, boolean] | null>,
      ])

      if (au?.valid) setAuPrice(au.price)
      if (ag?.valid) setAgPrice(ag.price)
      if (eth) setEthPrice(eth)
      if (usdc) setUsdcPrice(usdc)
      if (tvlData) setTvl(Number(formatUnits(tvlData[0], 18)))

      setLastUpdated(new Date())
    } catch (err: unknown) {
      console.error('Oracle fetch error:', err)
      setError('Failed to fetch oracle prices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [refresh])

  return {
    auPrice,
    agPrice,
    ethPrice,
    usdcPrice,
    tvl,
    loading,
    error,
    lastUpdated,
    refresh,
  }
}


