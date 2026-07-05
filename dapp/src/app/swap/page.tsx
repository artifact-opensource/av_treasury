'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance, useChainId, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'
import { parseUnits, formatUnits, erc20Abi, maxUint256 } from 'viem'
import { useLivePrices as useAllPrices } from '@/hooks/use-live-prices'
import { TOKENS, TOKEN_META, AERODROME, AV_CONTRACTS, EXPLORER } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeftRight, ChevronUp, ChevronDown, ExternalLink, Wallet, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TradingViewChart } from '@/components/trading-view-chart'

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const

const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)',
  'function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)',
] as const

type TokenKey = keyof typeof TOKENS
type TokenInfo = {
  key: TokenKey
  address: `0x${string}`
  symbol: string
  name: string
  decimals: number
  logo: string
  coingeckoId: string
}

const ALL_TOKENS: TokenInfo[] = Object.entries(TOKEN_META).map(([key, meta]) => ({
  key: key as TokenKey,
  address: TOKENS[key as TokenKey],
  symbol: meta.symbol,
  name: meta.name,
  decimals: meta.decimals,
  logo: meta.logo,
  coingeckoId: meta.coingeckoId,
}))

function TokenSelector({
  label,
  token,
  amount,
  setAmount,
  balance,
  usdValue,
  price,
  onMax,
  onSelect,
}: {
  label: string
  token: TokenInfo
  amount: string
  setAmount: (v: string) => void
  balance: { value: bigint; decimals: number; formatted: string } | undefined
  usdValue: number
  price: number
  onMax?: () => void
  onSelect: (key: TokenKey) => void
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <Select value={token.key} onValueChange={onSelect as any}>
        <SelectTrigger className="w-full justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src={token.logo} alt={token.symbol} className="h-5 w-5 rounded-full" onError={(e) => { e.currentTarget.style.display = 'none' }} />
            <span className="font-medium">{token.symbol}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </SelectTrigger>
        <SelectContent>
          {ALL_TOKENS.map(t => (
            <SelectItem key={t.key} value={t.key}>
              <div className="flex items-center gap-2">
                <img src={t.logo} alt={t.symbol} className="h-5 w-5 rounded-full" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                <span>{t.symbol}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative">
        <Input
          type="number"
          placeholder="0.0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="text-right pr-10"
          inputMode="decimal"
          step="0.000001"
        />
        {onMax && balance && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 text-xs h-6 px-2"
            onClick={onMax}
          >
            Max
          </Button>
        )}
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Balance: {balance?.formatted ?? '0'} {token.symbol}</span>
        {price > 0 && <span>≈ ${usdValue.toFixed(2)}</span>}
      </div>
    </div>
  )
}

function MarketInfoRow({ label, value, change }: { label: string; value: number; change?: number }) {
  const isPositive = (change ?? 0) >= 0
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 text-right">
        <span className="font-medium">${value.toFixed(value < 1 ? 6 : 2)}</span>
        {change !== undefined && (
          <span className={cn('text-xs font-medium', isPositive ? 'text-green-500' : 'text-red-500')}>
            {isPositive ? '+' : ''}{change.toFixed(2)}%
          </span>
        )}
      </div>
    </div>
  )
}

export default function SwapPage() {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const prices = useAllPrices()
  const [fromToken, setFromToken] = useState<TokenKey>('weth')
  const [toToken, setToToken] = useState<TokenKey>('au')
  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [slippage, setSlippage] = useState('0.5')
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const fromTokenInfo = ALL_TOKENS.find(t => t.key === fromToken)!
  const toTokenInfo = ALL_TOKENS.find(t => t.key === toToken)!

  const { writeContract, data: writeData, isPending: isWriting, reset: resetWrite } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: writeData })

  const { data: fromBalance } = useBalance({
    address: fromTokenInfo.address as `0x${string}`,
    query: { enabled: isConnected && !!address },
  })

  const { data: toBalance } = useBalance({
    address: toTokenInfo.address as `0x${string}`,
    query: { enabled: isConnected && !!address },
  })

  const { data: fromAllowance } = useReadContract({
    address: fromTokenInfo.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, AERODROME.router],
    query: { enabled: isConnected && !!address && fromToken !== 'weth' },
  })

  const getAmountOut = useCallback(async (amountIn: string): Promise<string | null> => {
    if (!amountIn || parseFloat(amountIn) <= 0) return null
    try {
      setIsCalculating(true)
      const amountInWei = parseUnits(amountIn, fromTokenInfo.decimals)
      const path = [fromTokenInfo.address, toTokenInfo.address]
      const amounts = await writeContract({
        address: AERODROME.router,
        abi: ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountInWei, path],
      })
      if (amounts && amounts[1]) {
        const amountOut = formatUnits(amounts[1], toTokenInfo.decimals)
        return amountOut
      }
    } catch (err) {
      console.error('Quote error:', err)
      setError('Failed to get quote')
    } finally {
      setIsCalculating(false)
    }
    return null
  }, [fromTokenInfo, toTokenInfo, writeContract])

  useEffect(() => {
    let mounted = true
    const calculate = async () => {
      const out = await getAmountOut(fromAmount)
      if (mounted && out) setToAmount(out)
    }
    const timeout = setTimeout(calculate, 300)
    return () => { mounted = false; clearTimeout(timeout) }
  }, [fromAmount, fromToken, toToken, getAmountOut])

  const handleSwap = async () => {
    if (!address) return setError('Connect wallet first')
    if (!fromAmount || parseFloat(fromAmount) <= 0) return setError('Enter amount')
    if (chainId !== base.id) return switchChain({ chainId: base.id })

    try {
      setError(null)
      const amountInWei = parseUnits(fromAmount, fromTokenInfo.decimals)
      const path = [fromTokenInfo.address, toTokenInfo.address]
      const amounts = await writeContract({
        address: AERODROME.router,
        abi: ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [amountInWei, path],
      })
      if (!amounts || !amounts[1]) return setError('Quote failed')
      const minAmountOut = (amounts[1] * 9950n) / 10000n

      if (fromToken !== 'weth') {
        const allowance = fromAllowance ?? 0n
        if (allowance < amountInWei) {
          writeContract({
            address: fromTokenInfo.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [AERODROME.router, maxUint256],
          })
          return
        }
      }

      writeContract({
        address: AERODROME.router,
        abi: ROUTER_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [amountInWei, minAmountOut, path, address, BigInt(Date.now() + 1800000)],
      })
    } catch (err) {
      console.error('Swap error:', err)
      setError('Swap failed')
    }
  }

  const handleMax = () => {
    if (fromBalance) setFromAmount(formatUnits(fromBalance.value, fromTokenInfo.decimals))
  }

  const handleSwitch = () => {
    setFromToken(toToken)
    setToToken(fromToken)
    setFromAmount(toAmount)
    setToAmount(fromAmount)
  }

  const isWrongChain = chainId !== base.id && isConnected
  const canSwap = isConnected && !isWrongChain && parseFloat(fromAmount) > 0 && !isWriting && !isConfirming

  const fromPrice = prices[fromToken as keyof typeof prices] as number
  const toPrice = prices[toToken as keyof typeof prices] as number
  const fromUsd = fromPrice * parseFloat(fromAmount || '0')
  const toUsd = toPrice * parseFloat(toAmount || '0')

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Swap</h1>
          <p className="text-muted-foreground mt-1">Exchange tokens on Aerodrome Finance</p>
        </div>

        {isWrongChain && (
          <div className="mb-6 p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>Wrong network: Please switch to Base</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => switchChain({ chainId: base.id })}>
              Switch to Base
            </Button>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-lg flex items-center justify-between" onClick={() => setError(null)}>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {isConfirmed && txHash && (
          <div className="mb-6 p-4 border border-green-500/50 bg-green-500/10 text-green-500 rounded-lg flex items-center justify-between" onClick={() => { setTxHash(null); resetWrite() }}>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Swap confirmed!</span>
            </div>
            <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm underline">
              View on BaseScan <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Trade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 lg:col-span-6">
                    <TokenSelector
                      label="From"
                      token={fromTokenInfo}
                      amount={fromAmount}
                      setAmount={setFromAmount}
                      balance={fromBalance}
                      usdValue={fromUsd}
                      price={fromPrice}
                      onMax={handleMax}
                      onSelect={setFromToken}
                    />
                  </div>
                  <div className="col-span-12 lg:col-span-6">
                    <TokenSelector
                      label="To"
                      token={toTokenInfo}
                      amount={toAmount}
                      setAmount={setToAmount}
                      balance={toBalance}
                      usdValue={toUsd}
                      price={toPrice}
                      onSelect={setToToken}
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSwitch}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center gap-2"
                  disabled={isCalculating || isWriting || isConfirming}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  <span>Switch tokens</span>
                </Button>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Slippage tolerance</span>
                  <Select value={slippage} onValueChange={setSlippage}>
                    <SelectTrigger className="w-auto">
                      <SelectValue placeholder="0.5%" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.1">0.1%</SelectItem>
                      <SelectItem value="0.5">0.5%</SelectItem>
                      <SelectItem value="1">1%</SelectItem>
                      <SelectItem value="2">2%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleSwap}
                  disabled={!canSwap}
                  className="w-full py-3 text-lg"
                  size="default"
                >
                  {isWriting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : isConfirming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    `Swap ${fromTokenInfo.symbol} → ${toTokenInfo.symbol}`
                  )}
                </Button>

                {fromUsd > 0 && toUsd > 0 && (
                  <p className="text-center text-sm text-muted-foreground">
                    ≈ ${fromUsd.toFixed(2)} → ≈ ${toUsd.toFixed(2)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Price Chart</CardTitle>
              </CardHeader>
              <CardContent>
                <TradingViewChart
                  symbol={toTokenInfo.coingeckoId}
                  interval="60"
                  height={400}
                />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Market Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <MarketInfoRow label="Au Price" value={prices.au} change={prices.changes?.au} />
                <MarketInfoRow label="Ag Price" value={prices.ag} change={prices.changes?.ag} />
                <MarketInfoRow label="ARTU Price" value={prices.artu} change={prices.changes?.artu} />
                <MarketInfoRow label="ARTG Price" value={prices.artg} change={prices.changes?.artg} />
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Your Balances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ALL_TOKENS.map(token => {
                  const balance = token.key === fromToken ? fromBalance : token.key === toToken ? toBalance : undefined
                  return (
                    <div key={token.key} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <img src={token.logo} alt={token.symbol} className="h-5 w-5 rounded-full" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                        <span className="font-medium">{token.symbol}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {balance ? formatUnits(balance.value, balance.decimals) : '0'}
                      </span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
