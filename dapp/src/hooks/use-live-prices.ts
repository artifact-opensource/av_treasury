'use client'

import { useReadContracts } from 'wagmi'
import { base } from 'wagmi/chains'
import { CHAINLINK_AGGREGATOR_ABI } from '@/lib/abis'
import { CHAINLINK_FEEDS } from '@/lib/constants'

// Base mainnet Chainlink feeds
const ETH_USD_FEED = '0x71041dddad3595F968c393B2C632eF1d76e2fc50' as `0x${string}` // Chainlink ETH/USD
const USDC_USD_FEED = '0xd9a0114a5bC16657F048Ce7689483957E13c9446' as `0x${string}` // Chainlink USDC/USD
const BTC_USD_FEED = '0x2435281d254e26C618E659f7C44137086DBd498A' as `0x${string}` // Chainlink BTC/USD

export interface LivePrice {
  symbol: string
  priceUsd: number
  decimals: number
  valid: boolean
}

export function useLivePrices() {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      {
        address: ETH_USD_FEED,
        abi: CHAINLINK_AGGREGATOR_ABI,
        functionName: 'latestRoundData',
        chainId: base.id,
      },
      {
        address: ETH_USD_FEED,
        abi: CHAINLINK_AGGREGATOR_ABI,
        functionName: 'decimals',
        chainId: base.id,
      },
      {
        address: BTC_USD_FEED,
        abi: CHAINLINK_AGGREGATOR_ABI,
        functionName: 'latestRoundData',
        chainId: base.id,
      },
      {
        address: BTC_USD_FEED,
        abi: CHAINLINK_AGGREGATOR_ABI,
        functionName: 'decimals',
        chainId: base.id,
      },
      {
        address: USDC_USD_FEED,
        abi: CHAINLINK_AGGREGATOR_ABI,
        functionName: 'latestRoundData',
        chainId: base.id,
      },
      {
        address: USDC_USD_FEED,
        abi: CHAINLINK_AGGREGATOR_ABI,
        functionName: 'decimals',
        chainId: base.id,
      },
    ],
  })

  const ethRound = data?.[0]?.result as [bigint, bigint, bigint, bigint, bigint] | undefined
  const ethDecimals = (data?.[1]?.result as number) ?? 8
  const btcRound = data?.[2]?.result as [bigint, bigint, bigint, bigint, bigint] | undefined
  const btcDecimals = (data?.[3]?.result as number) ?? 8
  const usdcRound = data?.[4]?.result as [bigint, bigint, bigint, bigint, bigint] | undefined
  const usdcDecimals = (data?.[5]?.result as number) ?? 8

  const prices: LivePrice[] = [
    {
      symbol: 'ETH',
      priceUsd: ethRound ? Number(ethRound[1]) / Math.pow(10, ethDecimals) : 0,
      decimals: ethDecimals,
      valid: !!ethRound && ethRound[1] > 0n,
    },
    {
      symbol: 'BTC',
      priceUsd: btcRound ? Number(btcRound[1]) / Math.pow(10, btcDecimals) : 0,
      decimals: btcDecimals,
      valid: !!btcRound && btcRound[1] > 0n,
    },
    {
      symbol: 'USDC',
      priceUsd: usdcRound ? Number(usdcRound[1]) / Math.pow(10, usdcDecimals) : 0,
      decimals: usdcDecimals,
      valid: !!usdcRound && usdcRound[1] > 0n,
    },
  ]

  return { prices, isLoading, refetch }
}
