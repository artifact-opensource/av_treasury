"use client"

import { useQuery } from '@tanstack/react-query'
import { TokenMetaData } from '../types/coingecko'

interface PriceData {
  au: TokenMetaData | null
  ag: TokenMetaData | null
  [key: string]: TokenMetaData | null | any
}

async function fetchCoinGeckoPrices(): Promise<PriceData> {
  try {
    const coingeckoResponse = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&symbols=au,ag,eth,usdc&order=market_cap_desc&per_page=50&page=1&sparkline=false',
      {
        next: { revalidate: 60 },
        headers: {
          'User-Agent': 'AV-Treasury-Dapp/1.0'
        }
      }
    )

    if (!coingeckoResponse.ok) {
      throw new Error(`CoinGecko API error: ${coingeckoResponse.status}`)
    }

    const coingeckoData = await coingeckoResponse.json()

    const prices: PriceData = {
      au: null,
      ag: null,
      eth: null,
      usdc: null
    }

    if (coingeckoData && Array.isArray(coingeckoData)) {
      coingeckoData.forEach((token: TokenMetaData) => {
        const symbol = token.symbol.toLowerCase()
        if (symbol === 'au' || symbol === 'ag' || symbol === 'eth' || symbol === 'usdc') {
          prices[symbol] = token
        }
      })
    }

    return prices
  } catch (error) {
    console.error('Error fetching CoinGecko prices:', error)
    return {
      au: null,
      ag: null,
      eth: null,
      usdc: null
    }
  }
}

async function fetchProductPrices(): Promise<Record<string, any>> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=artifact-utility,artifact-governance&vs_currencies=usd&include_24hr_change=true',
      {
        next: { revalidate: 60 },
        headers: {
          'User-Agent': 'AV-Treasury-Dapp/1.0'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching product prices:', error)
    return {}
  }
}

export function useAllPrices() {
  const { data: coingeckoData, isLoading: cgLoading, error: cgError } = useQuery({
    queryKey: ['coingecko-prices'],
    queryFn: fetchCoinGeckoPrices,
    refetchInterval: 60000,
    staleTime: 30000,
  })

  const { data: productData, isLoading: prodLoading, error: prodError } = useQuery({
    queryKey: ['product-prices'],
    queryFn: fetchProductPrices,
    refetchInterval: 60000,
    staleTime: 30000,
  })

  const loaded = !cgLoading && !prodLoading

  return {
    loaded,
    au: coingeckoData?.au?.current_price ?? 0,
    ag: coingeckoData?.ag?.current_price ?? 0,
    eth: coingeckoData?.eth?.current_price ?? 0,
    usdc: coingeckoData?.usdc?.current_price ?? 1,
    artu: productData?.['artifact-utility']?.usd ?? 0,
    artg: productData?.['artifact-governance']?.usd ?? 0,
    changes: {
      au: coingeckoData?.au?.price_change_percentage_24h ?? 0,
      ag: coingeckoData?.ag?.price_change_percentage_24h ?? 0,
      artu: productData?.['artifact-utility']?.usd_24h_change ?? 0,
      artg: productData?.['artifact-governance']?.usd_24h_change ?? 0,
    },
    isLoading: cgLoading || prodLoading,
    error: cgError || prodError,
  }
}

export { useAllPrices as useLivePrices }
