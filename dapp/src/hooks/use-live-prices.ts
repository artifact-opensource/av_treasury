'use client'

import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { AV_CONTRACTS, CHAINLINK_FEEDS, TOKENS } from '@/lib/constants'
import { AV_ORACLE_ABI as oracleAbi } from '@/lib/abis'

/**
 * Fetches prices from the AV Oracle contract for Au/Ag
 * Falls back to Chainlink for ETH/USDC
 */
export function useAuPrice() {
  const { data } = useReadContract({
    address: AV_CONTRACTS.oracle,
    abi: oracleAbi,
    functionName: 'getPrice',
    args: [TOKENS.au],
    query: { refetchInterval: 30_000 },
  })
  if (!data) return null
  // getPrice returns (price, timestamp, source, valid)
  const price = (data as readonly [bigint, bigint, number, boolean])[0]
  return Number(formatUnits(price, 18))
}

export function useAgPrice() {
  const { data } = useReadContract({
    address: AV_CONTRACTS.oracle,
    abi: oracleAbi,
    functionName: 'getPrice',
    args: [TOKENS.ag],
    query: { refetchInterval: 30_000 },
  })
  if (!data) return null
  // getPrice returns (price, timestamp, source, valid)
  const price = (data as readonly [bigint, bigint, number, boolean])[0]
  return Number(formatUnits(price, 18))
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
    aero: null, // No direct feed yet
    loaded: au !== null && eth !== null,
  }
}
