'use client'

import { useState, useMemo } from 'react'
import { useMarkets, MarketToken } from '@/hooks/use-markets'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Plus, Minus, ArrowRight, ArrowLeft, ArrowUpDown } from 'lucide-react'

export default function MarketsPage() {
  const { markets: marketData = [], isLoading, error } = useMarkets()
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('market_cap')
  const [showTrending, setShowTrending] = useState(false)

  // Filter tokens based on search
  const filteredTokens = useMemo(() => {
    if (!marketData) return []
    let filtered = marketData.filter(token =>
      token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Sort tokens
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'market_cap':
          return (b.market_cap || 0) - (a.market_cap || 0)
        case '24h_change':
          const changeA = a.price_change_percentage_24h || 0
          const changeB = b.price_change_percentage_24h || 0
          return changeB - changeA
        case 'price':
          return (b.current_price || 0) - (a.current_price || 0)
        case 'volume':
          return (b.total_volume || 0) - (a.total_volume || 0)
        default:
          return 0
      }
    })

    return filtered
  }, [marketData, searchTerm, sortBy])

  // Get trending tokens (top gainers/losers)
  const trendingGainers = useMemo(() => {
    if (!marketData) return []
    return marketData
      .filter(token => (token.price_change_percentage_24h || 0) > 5)
      .sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0))
      .slice(0, 5)
  }, [marketData])

  const trendingLosers = useMemo(() => {
    if (!marketData) return []
    return marketData
      .filter(token => (token.price_change_percentage_24h || 0) < -5)
      .sort((a, b) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0))
      .slice(0, 5)
  }, [marketData])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Markets</h1>
            <p className="text-muted-foreground">Loading market data...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 w-24 bg-muted animate-pulse" />
                <div className="h-3 w-16 bg-muted animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-32 bg-muted animate-pulse" />
                <div className="h-3 w-20 bg-muted animate-pulse mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Markets</h1>
          <p className="text-destructive">Error loading market data. Please try again later.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Markets</h1>
          <p className="text-muted-foreground">Track top 100+ cryptocurrencies with real-time prices</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {marketData.length} tokens
          </Badge>
        </div>
      </div>

      {/* Search and Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search tokens (e.g., Bitcoin, ETH, USDT)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market_cap">Market Cap</SelectItem>
                <SelectItem value="24h_change">24h Change</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="volume">Volume</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showTrending ? "default" : "outline"}
              onClick={() => setShowTrending(!showTrending)}
              className="gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Trending
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Trending Section */}
      {showTrending && (trendingGainers.length > 0 || trendingLosers.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Trending Gainers */}
          {trendingGainers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-5 w-5" />
                  Top Gainers (24h)
                </CardTitle>
                <CardDescription>Tokens with the highest gains today</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trendingGainers.slice(0, 5).map((token) => (
                    <div key={token.id} className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-sm font-bold">
                          {token.symbol.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{token.symbol}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-32">{token.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sm">${token.current_price?.toFixed(2)}</div>
                        <div className="text-xs text-green-600">+{token.price_change_percentage_24h?.toFixed(2)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trending Losers */}
          {trendingLosers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <TrendingDown className="h-5 w-5" />
                  Top Losers (24h)
                </CardTitle>
                <CardDescription>Tokens with the biggest drops today</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trendingLosers.slice(0, 5).map((token) => (
                    <div key={token.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center text-sm font-bold">
                          {token.symbol.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{token.symbol}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-32">{token.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sm">${token.current_price?.toFixed(2)}</div>
                        <div className="text-xs text-red-600">{token.price_change_percentage_24h?.toFixed(2)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* AV Treasury Highlight */}
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">AV</span>
            </div>
            AV Treasury Tokens
          </CardTitle>
          <CardDescription>
            Au & Ag - Production ready tokens with real oracles and market data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Au Token */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-card border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#FFD700] dark:bg-[#FFD700]/20 flex items-center justify-center text-sm font-bold">
                  Au
                </div>
                <div>
                  <div className="font-semibold text-sm">Au - Artifact Utility</div>
                  <div className="text-xs text-muted-foreground">Launch Soon</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg text-yellow-600">$Price TBD</div>
                <div className="text-xs text-muted-foreground">On-Chain Oracle</div>
              </div>
            </div>

            {/* Ag Token */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-card border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#C0C0C0] dark:bg-[#C0C0C0]/20 flex items-center justify-center text-sm font-bold">
                  Ag
                </div>
                <div>
                  <div className="font-semibold text-sm">Ag - Artifact Governance</div>
                  <div className="text-xs text-muted-foreground">Launch Soon</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg text-gray-600">$Price TBD</div>
                <div className="text-xs text-muted-foreground">On-Chain Oracle</div>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-sm">
            <div className="text-blue-800 dark:text-blue-200">
              💡 AV Treasury tokens are launching soon with full market data integration, CoinGecko price feeds, and professional analytics.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Token Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Market Overview - Top {filteredTokens.length} Tokens
          </CardTitle>
          <CardDescription>
            Real-time cryptocurrency prices and market data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredTokens.slice(0, 20).map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between p-4 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer border"
                onClick={() => window.open(`/swap?from=${token.symbol}`, '_blank')}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                    {token.symbol.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{token.symbol}</div>
                    <div className="text-sm text-muted-foreground truncate">{token.name}</div>
                  </div>
                </div>

                <div className="text-right hidden md:block">
                  <div className="font-semibold">
                    ${token.current_price?.toFixed(2) || 'N/A'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Market Cap: ${(token.market_cap / 1e9 || 0).toFixed(2)}B
                  </div>
                </div>

                <div className="text-right hidden lg:block">
                  <div className={`font-semibold flex items-center gap-1 justify-end ${((token.price_change_percentage_24h || 0) >= 0 ? 'text-green-600' : 'text-red-600')}`}>
                    {((token.price_change_percentage_24h || 0) >= 0 ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />)}
                    {Math.abs(token.price_change_percentage_24h || 0).toFixed(2)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    24h Volume: {(token.total_volume / 1e6 || 0).toFixed(2)}M
                  </div>
                </div>

                <div className="text-right">
                  <Badge variant={((token.price_change_percentage_24h || 0) >= 0 ? "default" : "destructive")} className="text-xs">
                    {token.symbol}/ETH
                  </Badge>
                  <Button
                    size="sm"
                    className="ml-2 h-7 px-3"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(`/swap?from=${token.symbol}&to=ETH`, '_blank')
                    }}
                  >
                    <ArrowRight className="h-3 w-3 mr-1" />
                    Swap
                  </Button>
                </div>
              </div>
            ))}

            {filteredTokens.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No tokens found matching your search.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common trading actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              onClick={() => window.open('/swap', '_blank')}
              className="h-20 flex-col gap-2"
              variant="outline"
            >
              <ArrowUpDown className="h-5 w-5" />
              <span className="text-xs">Start Swap</span>
            </Button>
            <Button
              onClick={() => window.open('/liquidity', '_blank')}
              className="h-20 flex-col gap-2"
              variant="outline"
            >
              <ArrowUpDown className="h-5 w-5" />
              <span className="text-xs">Add Liquidity</span>
            </Button>
            <Button
              onClick={() => window.open('/stake', '_blank')}
              className="h-20 flex-col gap-2"
              variant="outline"
            >
              <BarChart3 className="h-5 w-5" />
              <span className="text-xs">Stake</span>
            </Button>
            <Button
              onClick={() => setShowTrending(!showTrending)}
              className="h-20 flex-col gap-2"
              variant="outline"
            >
              <TrendingUp className="h-5 w-5" />
              <span className="text-xs">View Trending</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
