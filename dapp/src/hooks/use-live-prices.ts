"use client"

import { useQuery } from '@tanstack/react-query'
import { TokenMetaData } from '../types/coingecko'

interface PriceData {
  au: TokenMetaData | null
  ag: TokenMetaData | null
  eth: TokenMetaData | null
  usdc: TokenMetaData | null
  artu: TokenMetaData | null
  artg: TokenMetaData | null
  aero: TokenMetaData | null
  [key: string]: TokenMetaData | null | any
}

async function fetchCoinGeckoPrices(): Promise<PriceData> {
  try {
    const symbols = 'au,ag,eth,usdc,artifact-utility,artifact-governance,aerodrome-finance'
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${symbols}&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`,
      {
        next: { revalidate: 30 },
        headers: { 'User-Agent': 'AV-Treasury-Dapp/1.0' }
      }
    )

    if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`)
    
    const data = await response.json()
    const prices: PriceData = { au: null, ag: null, eth: null, usdc: null, artu: null, artg: null, aero: null }

    if (Array.isArray(data)) {
      data.forEach((token: TokenMetaData) => {
        const id = token.id.toLowerCase()
        if (id === 'artifact-gold' || token.symbol.toLowerCase() === 'au') prices.au = token
        else if (id === 'artifact-silver' || token.symbol.toLowerCase() === 'ag') prices.ag = token
        else if (id === 'ethereum' || token.symbol.toLowerCase() === 'eth') prices.eth = token
        else if (id === 'usd-coin' || token.symbol.toLowerCase() === 'usdc') prices.usdc = token
        else if (id === 'artifact-utility') prices.artu = token
        else if (id === 'artifact-governance') prices.artg = token
        else if (id === 'aerodrome-finance') prices.aero = token
      })
    }

    return prices
  } catch (error) {
    console.error('Error fetching CoinGecko prices:', error)
    return { au: null, ag: null, eth: null, usdc: null, artu: null, artg: null, aero: null }
  }
}

export function useLivePrices() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['live-prices'],
    queryFn: fetchCoinGeckoPrices,
    refetchInterval: 30000,
    staleTime: 15000,
  })

  return {
    prices: {
      au: data?.au?.current_price ?? 0,
      ag: data?.ag?.current_price ?? 0,
      eth: data?.eth?.current_price ?? 0,
      usdc: data?.usdc?.current_price ?? 1,
      artu: data?.artu?.current_price ?? 0,
      artg: data?.artg?.current_price ?? 0,
      aero: data?.aero?.current_price ?? 0,
    },
    changes: {
      au: data?.au?.price_change_percentage_24h ?? 0,
      ag: data?.ag?.price_change_percentage_24h ?? 0,
      eth: data?.eth?.price_change_percentage_24h ?? 0,
      usdc: data?.usdc?.price_change_percentage_24h ?? 0,
      artu: data?.artu?.price_change_percentage_24h ?? 0,
      artg: data?.artg?.price_change_percentage_24h ?? 0,
      aero: data?.aero?.price_change_percentage_24h ?? 0,
    },
    isLoading,
    error,
    refetch,
  }
}
