'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, http, formatUnits } from 'viem'
import { base } from 'viem/chains'
import { CHAINLINK_AGGREGATOR_ABI } from '@/lib/abis'
import { AV_CONTRACTS, CHAINLINK_FEEDS } from '@/lib/constants'

const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
})

// ─── Types ────────────────────────────────────────────────────
export interface OraclePrices {
  auPrice: number | null
  agPrice: number | null
  ethPrice: number | null
  usdcPrice: number | null
  tvl: number | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  source: 'onchain' | 'coingecko' | 'mixed' | 'none'
  refresh: () => void
}

// ─── CoinGecko Price Fetching ─────────────────────────────────
// Free API, no key needed, rate limit ~10-30 calls/min
const COINGECKO_IDS: Record<string, string> = {
  AU: 'ethereum',      // fallback: show ETH price until Au has a market
  AG: 'ethereum',      // fallback
  ETH: 'ethereum',
  USDC: 'usd-coin',
}

interface CoinGeckoPrices {
  [key: string]: { usd: number; last_updated_at: number }
}

async function fetchCoinGeckoPrices(): Promise<CoinGeckoPrices | null> {
  try {
    const ids = ['ethereum', 'usd-coin'].join(',')
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_last_updated_at=true`,
      { next: { revalidate: 30 } }
    )
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

// ─── On-Chain Price Reading ───────────────────────────────────
async function fetchChainlinkPrice(feedAddress: string): Promise<number | null> {
  try {
    const result = await publicClient.readContract({
      address: feedAddress as `0x${string}`,
      abi: CHAINLINK_AGGREGATOR_ABI,
      functionName: 'latestRoundData',
    }) as [bigint, bigint, bigint, bigint, bigint]

    const answer = result[1]
    const decimals = await publicClient.readContract({
      address: feedAddress as `0x${string}`,
      abi: CHAINLINK_AGGREGATOR_ABI,
      functionName: 'decimals',
    }) as number

    return Number(formatUnits(answer, decimals))
  } catch {
    return null
  }
}

async function fetchOnChainOraclePrice(tokenAddress: string): Promise<number | null> {
  try {
    // Try the public getter for cachedPrices mapping
    // cachedPrices(address) selector
    const selector = '0x837479c9'
    const paddedAddr = tokenAddress.slice(2).toLowerCase().padStart(64, '0')
    const data = `${selector}${paddedAddr}`

    const result = await publicClient.call({
      to: AV_CONTRACTS.oracle,
      data: data as `0x${string}`,
    })

    if (!result.data || result.data === '0x') return null

    const raw = BigInt(result.data)
    // First 32 bytes = price
    const priceRaw = Number((raw >> BigInt(0)) & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'))
    // For Au/Ag, price is in 18 decimals representing USD value
    const price = priceRaw / 1e18

    // Sanity check: if price is 0 or absurdly small, it's not valid
    if (price < 0.0001) return null

    return price
  } catch {
    return null
  }
}

async function fetchOnChainTvl(): Promise<number | null> {
  try {
    const result = await publicClient.call({
      to: AV_CONTRACTS.oracle,
      data: '0x766c0e47' as `0x${string}`, // getTvl()
    })
    if (!result.data || result.data === '0x') return null
    const raw = BigInt(result.data)
    const tvl = Number(raw / BigInt(1e12)) / 1e6 // rough 18-decimal conversion
    return tvl > 0 ? tvl : null
  } catch {
    return null
  }
}

// ─── Main Hook ────────────────────────────────────────────────
export function useOraclePrices(): OraclePrices {
  const [auPrice, setAuPrice] = useState<number | null>(null)
  const [agPrice, setAgPrice] = useState<number | null>(null)
  const [ethPrice, setEthPrice] = useState<number | null>(null)
  const [usdcPrice, setUsdcPrice] = useState<number | null>(null)
  const [tvl, setTvl] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [source, setSource] = useState<'onchain' | 'coingecko' | 'mixed' | 'none'>('none')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch everything in parallel
      const [cgPrices, eth, usdc] = await Promise.all([
        fetchCoinGeckoPrices(),
        fetchChainlinkPrice(CHAINLINK_FEEDS.ethUsd),
        fetchChainlinkPrice(CHAINLINK_FEEDS.usdcUsd),
      ])

      // Set Chainlink prices (these always work)
      if (eth) setEthPrice(eth)
      if (usdc) setUsdcPrice(usdc)

      // Try on-chain oracle for Au/Ag
      const onChainAu = await fetchOnChainOraclePrice(AV_CONTRACTS.auToken)
      const onChainAg = await fetchOnChainOraclePrice(AV_CONTRACTS.agToken)
      const onChainTvl = await fetchOnChainTvl()

      let currentSource: 'onchain' | 'coingecko' | 'mixed' | 'none' = 'none'

      if (onChainAu && onChainAu > 0.0001) {
        setAuPrice(onChainAu)
        currentSource = 'onchain'
      } else if (cgPrices?.ethereum?.usd) {
        // Au has no market yet — show ETH as reference
        setAuPrice(cgPrices.ethereum.usd)
        if (currentSource === 'none') currentSource = 'coingecko'
        else currentSource = 'mixed'
      }

      if (onChainAg && onChainAg > 0.0001) {
        setAgPrice(onChainAg)
      } else if (cgPrices?.ethereum?.usd) {
        // Ag has no market yet — show ETH as reference
        setAgPrice(cgPrices.ethereum.usd)
      }

      if (onChainTvl) setTvl(onChainTvl)

      setSource(currentSource)
      setLastUpdated(new Date())

      if (!onChainAu && !onChainAg && !cgPrices) {
        setError('All price sources unavailable')
      }
    } catch (err: unknown) {
      console.error('Price fetch error:', err)
      setError('Failed to fetch prices')
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
    source,
    refresh,
  }
}
