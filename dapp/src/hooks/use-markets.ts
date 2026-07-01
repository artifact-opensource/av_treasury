"use client"

import { useQuery } from '@tanstack/react-query'

export interface MarketToken {
  id: string
  symbol: string
  name: string
  current_price: number
  market_cap: number
  market_cap_rank: number
  price_change_percentage_24h: number
  total_volume: number
  image: string
}

async function fetchMarketData(): Promise<MarketToken[]> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h',
      {
        headers: {
          'User-Agent': 'AV-Treasury-Dapp/1.0'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching market data:', error)
    return []
  }
}

export function useMarkets() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['markets'],
    queryFn: fetchMarketData,
    refetchInterval: 60000,
    staleTime: 30000,
  })

  return {
    markets: data || [],
    isLoading,
    error,
    refetch,
  }
}
