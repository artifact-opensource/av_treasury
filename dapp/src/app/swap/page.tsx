'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useReadContracts } from 'wagmi'
import { base } from 'wagmi/chains'
import { ArrowDownUp, Settings, Loader2, ExternalLink, Search, ChevronDown, Info } from 'lucide-react'
import { AERODROME_ROUTER_ABI, ERC20_ABI } from '@/lib/abis'
import { AERODROME, TOKENS, TOKEN_META, EXPLORER } from '@/lib/constants'
import { formatTokenAmount, cn } from '@/lib/utils'

// ─── Extended Token List (searchable) ─────────────────────────────
interface TokenInfo {
  key: string
  address: `0x${string}`
  symbol: string
  name: string
  icon: string
  decimals: number
  isNative?: boolean
}

const ALL_TOKENS: TokenInfo[] = [
  { key: 'eth', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as `0x${string}`, symbol: 'ETH', name: 'Ethereum', icon: '💜', decimals: 18, isNative: true },
  { key: 'weth', address: TOKENS.weth, symbol: 'WETH', name: 'Wrapped ETH', icon: '💜', decimals: 18 },
  { key: 'usdc', address: TOKENS.usdc, symbol: 'USDC', name: 'USD Coin', icon: '💵', decimals: 6 },
  { key: 'usdt', address: '0xfde4C96c8593536E31F229EA8f37b2ADa269FF73' as `0x${string}`, symbol: 'USDT', name: 'Tether', icon: '💲', decimals: 6 },
  { key: 'dai', address: '0x50c572594910f676f7760ec3e7f480616923b61B' as `0x${string}`, symbol: 'DAI', name: 'Dai Stablecoin', icon: '🟡', decimals: 18 },
  { key: 'wbtc', address: '0xc028e103eB2A2e3b3Ff7D7D3A0E5Bf1C1C3Dd1e' as `0x${string}`, symbol: 'WBTC', name: 'Wrapped Bitcoin', icon: '🟠', decimals: 8 },
  { key: 'aero', address: '0x940181a94A35A4519B9f1E322c818B2C76230030' as `0x${string}`, symbol: 'AERO', name: 'Aerodrome', icon: '🚀', decimals: 18 },
  { key: 'cbeth', address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22' as `0x${string}`, symbol: 'cbETH', name: 'Coinbase Wrapped ETH', icon: '🔵', decimals: 18 },
  { key: 'au', address: TOKENS.au, symbol: 'Au', name: 'Artifact Utility', icon: '🥇', decimals: 18 },
  { key: 'ag', address: TOKENS.ag, symbol: 'Ag', name: 'Artifact Governance', icon: '🔘', decimals: 18 },
]

// ─── Popular tokens for quick select ──────────────────────────────
const POPULAR_TOKENS = ['ETH', 'USDC', 'WETH', 'AERO', 'DAI']

export default function SwapPage() {
  const { address, isConnected } = useAccount()
  const [fromToken, setFromToken] = useState<TokenInfo>(ALL_TOKENS[0]) // ETH
  const [toToken, setToToken] = useState<TokenInfo>(ALL_TOKENS[1]) // WETH
  const [amountIn, setAmountIn] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [showSettings, setShowSettings] = useState(false)
  const [showFromSearch, setShowFromSearch] = useState(false)
  const [showToSearch, setShowToSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const fromDecimals = fromToken.decimals
  const toDecimals = toToken.decimals
  const amountInBigInt = parseInput(amountIn, fromDecimals)

  // Swap path
  const path = useMemo(() => buildSwapPath(fromToken.address, toToken.address), [fromToken, toToken])

  // Quote
  const { data: amountsOut, isLoading: isQuoting } = useReadContract({
    address: AERODROME.routerV2,
    abi: AERODROME_ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: [amountInBigInt, path],
    chainId: base.id,
    query: { enabled: amountInBigInt > 0n && path.length >= 2 },
  })

  const amountOut = (amountsOut as bigint[] | undefined)?.[path.length - 1] ?? 0n
  const slippageBps = BigInt(Math.round(slippage * 100))
  const amountOutMin = amountOut > 0n ? amountOut - (amountOut * slippageBps) / 10000n : 0n

  // Balances
  const { data: balances } = useReadContracts({
    contracts: fromToken.isNative
      ? [{ address: toToken.address, abi: ERC20_ABI, functionName: 'balanceOf' as const, args: [address!] }]
      : [
          { address: fromToken.address, abi: ERC20_ABI, functionName: 'balanceOf' as const, args: [address!] },
          { address: toToken.address, abi: ERC20_ABI, functionName: 'balanceOf' as const, args: [address!] },
        ],
    query: { enabled: !!address && !fromToken.isNative ? true : !!address },
  })

  // Native ETH balance
  const { data: nativeBalance } = useReadContract({
    address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    abi: [{ functionName: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'addr', type: 'address' }], outputs: [{ type: 'uint256' }] }],
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address && fromToken.isNative },
  })

  const fromBalance = fromToken.isNative
    ? (nativeBalance as bigint) ?? 0n
    : (balances?.[0]?.result as bigint) ?? 0n
  const toBalance = fromToken.isNative
    ? (balances?.[0]?.result as bigint) ?? 0n
    : (balances?.[1]?.result as bigint) ?? 0n

  // Allowance
  const { data: allowance } = useReadContract({
    address: fromToken.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, AERODROME.routerV2],
    query: { enabled: !!address && amountInBigInt > 0n && !fromToken.isNative },
  })

  // Approve
  const { data: approveHash, writeContract: approveWrite, isPending: isApproving } = useWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  // Swap
  const { data: swapHash, writeContract: swapWrite, isPending: isSwapping } = useWriteContract()
  const { isLoading: isSwapConfirming, isSuccess: isSwapSuccess } = useWaitForTransactionReceipt({ hash: swapHash })

  const needsApproval = !fromToken.isNative && allowance !== undefined && amountInBigInt > 0n && (allowance as bigint) < amountInBigInt

  const handleApprove = useCallback(() => {
    approveWrite({
      address: fromToken.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [AERODROME.routerV2, BigInt(2) ** BigInt(256) - BigInt(1)],
    })
  }, [fromToken.address, approveWrite])

  const handleSwap = useCallback(() => {
    if (amountInBigInt === 0n || !address) return
    swapWrite({
      address: AERODROME.routerV2,
      abi: AERODROME_ROUTER_ABI,
      functionName: 'swapExactTokensForTokens',
      args: [amountInBigInt, amountOutMin, path, address, BigInt(Math.floor(Date.now() / 1000) + 1200)],
    })
  }, [amountInBigInt, amountOutMin, path, address, swapWrite])

  const flipTokens = useCallback(() => {
    setFromToken(toToken)
    setToToken(fromToken)
    setAmountIn('')
  }, [fromToken, toToken])

  // Token search filter
  const filteredTokens = useMemo(() => {
    if (!searchQuery) return ALL_TOKENS
    const q = searchQuery.toLowerCase()
    return ALL_TOKENS.filter(t =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const isBusy = isApproving || isApproveConfirming || isSwapping || isSwapConfirming
  const txHash = swapHash || approveHash

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <ArrowDownUp className="h-8 w-8 text-primary" />
        </div>
        <p className="text-muted-foreground">Connect your wallet to swap tokens</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Swap</h1>
        <button onClick={() => setShowSettings(!showSettings)} className="rounded-lg p-2 hover:bg-accent transition-colors">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {showSettings && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-medium">Slippage Tolerance</div>
          <div className="flex gap-2">
            {[0.1, 0.5, 1.0, 3.0].map((s) => (
              <button key={s} onClick={() => setSlippage(s)} className={cn('rounded-lg px-3 py-1.5 text-sm', slippage === s ? 'bg-primary text-primary-foreground' : 'bg-accent text-foreground')}>
                {s}%
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        {/* From */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">From</span>
            <span className="text-muted-foreground">Balance: {formatOutput(fromBalance, fromDecimals)}</span>
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative">
              <button
                onClick={() => { setShowFromSearch(!showFromSearch); setShowToSearch(false); setSearchQuery('') }}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium min-w-[120px] hover:bg-accent transition-colors"
              >
                <span>{fromToken.icon}</span>
                <span>{fromToken.symbol}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {showFromSearch && (
                <TokenSearchDropdown
                  tokens={filteredTokens}
                  onSelect={(t) => { setFromToken(t); setShowFromSearch(false); setAmountIn('') }}
                  onClose={() => setShowFromSearch(false)}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  excludeToken={toToken}
                />
              )}
            </div>
            <input type="number" placeholder="0.0" value={amountIn} onChange={(e) => setAmountIn(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-right text-lg font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="flex gap-2">
            {['25', '50', '75', '100'].map((pct) => (
              <button key={pct} onClick={() => { const bal = Number(fromBalance) / 10 ** fromDecimals; setAmountIn((bal * parseInt(pct) / 100).toFixed(Math.min(fromDecimals, 6))); }}
                className="rounded px-2 py-0.5 text-xs bg-accent hover:bg-accent/80 transition-colors">{pct}%</button>
            ))}
          </div>
        </div>

        {/* Flip */}
        <div className="flex justify-center">
          <button onClick={flipTokens} className="rounded-full border border-border p-2.5 hover:bg-accent transition-colors active:rotate-180 duration-300">
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>

        {/* To */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">To</span>
            <span className="text-muted-foreground">Balance: {formatOutput(toBalance, toDecimals)}</span>
          </div>
          <div className="flex gap-3 items-center">
            <div className="relative">
              <button
                onClick={() => { setShowToSearch(!showToSearch); setShowFromSearch(false); setSearchQuery('') }}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium min-w-[120px] hover:bg-accent transition-colors"
              >
                <span>{toToken.icon}</span>
                <span>{toToken.symbol}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {showToSearch && (
                <TokenSearchDropdown
                  tokens={filteredTokens}
                  onSelect={(t) => { setToToken(t); setShowToSearch(false); setAmountIn('') }}
                  onClose={() => setShowToSearch(false)}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  excludeToken={fromToken}
                />
              )}
            </div>
            <div className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-right text-lg font-mono">
              {isQuoting ? <Loader2 className="h-5 w-5 animate-spin inline" /> : amountOut > 0n ? formatOutput(amountOut, toDecimals) : '0.0'}
            </div>
          </div>
        </div>

        {/* Rate Info */}
        {amountOut > 0n && amountInBigInt > 0n && (
          <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
            <div className="flex justify-between">
              <span>Rate</span>
              <span>1 {fromToken.symbol} = {formatOutput(amountOut * BigInt(10 ** fromDecimals) / amountInBigInt, toDecimals)} {toToken.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span>Min Received</span>
              <span>{formatOutput(amountOutMin, toDecimals)} {toToken.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span>Price Impact</span>
              <span>
                {(() => {
                  if (amountInBigInt === 0n) return '<0.01%'
                  const rate = Number(amountOut) / Number(amountInBigInt) * (10 ** fromDecimals / 10 ** toDecimals)
                  const impact = (rate - 1) * 100
                  return impact > 0.01 ? `${impact.toFixed(2)}%` : '<0.01%'
                })()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Route</span>
              <span>{path.map((p) => findTokenSymbol(p)).join(' → ')}</span>
            </div>
          </div>
        )}

        {/* Action */}
        {needsApproval ? (
          <button onClick={handleApprove} disabled={isBusy} className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {isBusy ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Approving...</span> : `Approve ${fromToken.symbol}`}
          </button>
        ) : (
          <button onClick={handleSwap} disabled={isBusy || amountInBigInt === 0n} className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {isSwapping || isSwapConfirming ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Swapping...</span>
              : isSwapSuccess ? 'Swap Complete!' : `Swap ${fromToken.symbol} → ${toToken.symbol}`}
          </button>
        )}

        {/* TX Link */}
        {txHash && (
          <a href={`${EXPLORER.url}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            View on BaseScan <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Token Search Dropdown ────────────────────────────────────────
function TokenSearchDropdown({
  tokens,
  onSelect,
  onClose,
  searchQuery,
  setSearchQuery,
  excludeToken,
}: {
  tokens: TokenInfo[]
  onSelect: (token: TokenInfo) => void
  onClose: () => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  excludeToken: TokenInfo
}) {
  return (
    <div className="absolute top-full left-0 mt-1 z-50 w-72 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
      <div className="p-2 border-b border-border">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or paste address"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm focus:outline-none"
            autoFocus
          />
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {/* Popular tokens */}
        {!searchQuery && (
          <div className="p-2">
            <div className="text-xs text-muted-foreground px-2 py-1 mb-1">Popular</div>
            <div className="flex gap-1 flex-wrap px-2 mb-2">
              {POPULAR_TOKENS.map(sym => {
                const t = ALL_TOKENS.find(t => t.symbol === sym)
                if (!t || t.symbol === excludeToken.symbol) return null
                return (
                  <button key={sym} onClick={() => onSelect(t)} className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs hover:bg-primary/20 transition-colors">
                    {t.icon} {t.symbol}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className="text-xs text-muted-foreground px-3 py-1">All Tokens</div>
        {tokens.filter(t => t.address !== excludeToken.address).map((token) => (
          <button
            key={token.key}
            onClick={() => onSelect(token)}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left"
          >
            <span className="text-lg">{token.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{token.symbol}</div>
              <div className="text-xs text-muted-foreground truncate">{token.name}</div>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {token.address.slice(0, 6)}...{token.address.slice(-4)}
            </div>
          </button>
        ))}
        {tokens.filter(t => t.address !== excludeToken.address).length === 0 && (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">No tokens found</div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────
function parseInput(val: string, dec: number): bigint {
  if (!val || val === '.') return 0n
  const [intPart, fracPart = ''] = val.split('.')
  const padded = (fracPart + '0'.repeat(dec)).slice(0, dec)
  return BigInt(intPart + padded)
}

function formatOutput(val: bigint, dec: number): string {
  if (val === 0n) return '0.0'
  const str = val.toString().padStart(dec + 1, '0')
  const intPart = str.slice(0, -dec) || '0'
  const fracPart = str.slice(-dec).replace(/0+$/, '')
  return fracPart ? `${intPart}.${fracPart}` : intPart
}

function buildSwapPath(from: `0x${string}`, to: `0x${string}`): `0x${string}`[] {
  if (from.toLowerCase() === to.toLowerCase()) return [from]

  const weth = TOKENS.weth.toLowerCase()

  // Direct: same as before for known pairs
  const knownDirect: [string, string][] = []
  const fromLower = from.toLowerCase()
  const toLower = to.toLowerCase()

  // If either is WETH, direct pair
  if (fromLower === weth || toLower === weth) return [from, to]

  // Route through WETH
  return [from, TOKENS.weth as `0x${string}`, to]
}

function findTokenSymbol(tokenAddr: `0x${string}`): string {
  const t = ALL_TOKENS.find(t => t.address.toLowerCase() === tokenAddr.toLowerCase())
  return t?.symbol ?? tokenAddr.slice(0, 6) + '...'
}
