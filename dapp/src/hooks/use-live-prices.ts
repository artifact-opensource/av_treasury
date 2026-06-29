'use client'

import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { AV_CONTRACTS, CHAINLINK_FEEDS, TOKENS } from '@/lib/constants'
import { AV_ORACLE_ABI as oracleAbi } from '@/lib/abis'
import { useEffect, useState } from 'react'

/**
 * Fetch metal spot price from CoinGecko (no API key needed)
 */
async function fetchCgPrice(symbol: 'au' | 'ag'): Promise<number | null> {
  try {
    const metal = symbol === 'au' ? 'XAU' : 'XAG'
    const res = await fetch(`https://api.gold-api.com/price/${metal}`, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    return json?.price ?? null
  } catch {
    return null
  }
}

/**
 * Try on-chain oracle first, fall back to CoinGecko/metals API
 */
function useMetalPrice(token: `0x${string}`, symbol: 'au' | 'ag') {
  const [fallbackPrice, setFallbackPrice] = useState<number | null>(null)

  const { data } = useReadContract({
    address: AV_CONTRACTS.oracle,
    abi: oracleAbi,
    functionName: 'getPrice',
    args: [token],
    query: { refetchInterval: 30_000 },
  })

  let oraclePrice: number | null = null
  if (data) {
    const result = data as readonly [bigint, bigint, number, boolean]
    const price = Number(formatUnits(result[0], 18))
    const valid = result[3]
    if (valid && price > 0) {
      oraclePrice = price
    }
  }

  // Fetch fallback when oracle fails
  useEffect(() => {
    if (oraclePrice === null) {
      fetchCgPrice(symbol).then(price => {
        if (price !== null) setFallbackPrice(price)
      })
    }
  }, [oraclePrice, symbol])

  return oraclePrice ?? fallbackPrice
}

export function useAuPrice() {
  return useMetalPrice(TOKENS.au, 'au')
}

export function useAgPrice() {
  return useMetalPrice(TOKENS.ag, 'ag')
}

export function useEthPrice() {
  const { data } = useReadContract({
    address: CHAINLINK_FEEDS.ethUsd,
    abi: [{
      name: 'latestAnswer',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'int256' }],
    }],
    functionName: 'latestAnswer',
    query: { refetchInterval: 60_000 },
  })
  if (!data) return null
  return Number(formatUnits(data as bigint, 8))
}

export function useUsdcPrice() {
  const { data } = useReadContract({
    address: CHAINLINK_FEEDS.usdcUsd,
    abi: [{
      name: 'latestAnswer',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'int256' }],
    }],
    functionName: 'latestAnswer',
    query: { refetchInterval: 60_000 },
  })
  if (!data) return null
  return Number(formatUnits(data as bigint, 8))
}

/**
 * Hook that returns all tracked prices
 */
export function useAllPrices() {
  const au = useAuPrice()
  const ag = useAgPrice()
  const eth = useEthPrice()
  const usdc = useUsdcPrice()

  return {
    au,
    ag,
    eth,
    usdc,
    aero: null,
    loaded: au !== null && eth !== null,
  }
}
