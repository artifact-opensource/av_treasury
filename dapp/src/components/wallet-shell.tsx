'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Globe, Search, ArrowLeft, ArrowRight, RotateCw, Shield, Star,
  TrendingUp, Coins, Droplets, Vote, HardDrive, Zap, Bot,
  Bookmark, History, Settings, ExternalLink, Sparkles, X,
  ChevronDown, Wallet, BarChart3, Layers, Radio
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────
interface Tab {
  id: string
  title: string
  url: string
  type: 'dapp' | 'web3' | 'browser'
  icon?: React.ReactNode
  favicon?: string
}

interface BookmarkItem {
  title: string
  url: string
  icon: string
  category: 'defi' | 'nft' | 'tools' | 'social' | 'our'
}

// ─── Default Bookmarks ─────────────────────────────────────────────
const DEFAULT_BOOKMARKS: BookmarkItem[] = [
  { title: 'AV Swap', url: '/swap', icon: '🔄', category: 'our' },
  { title: 'AV Liquidity', url: '/liquidity', icon: '💧', category: 'our' },
  { title: 'AV Stake', url: '/stake', icon: '🪙', category: 'our' },
  { title: 'AV Cold Storage', url: '/cold-storage', icon: '🔒', category: 'our' },
  { title: 'AV Govern', url: '/governance', icon: '🏛️', category: 'our' },
  { title: 'Aerodrome', url: 'https://aerodrome.finance', icon: '✈️', category: 'defi' },
  { title: 'Uniswap', url: 'https://app.uniswap.org', icon: '🦄', category: 'defi' },
  { title: 'Aave', url: 'https://app.aave.com', icon: '👻', category: 'defi' },
  { title: 'BaseScan', url: 'https://basescan.org', icon: '🔍', category: 'tools' },
  { title: 'Zora', url: 'https://zora.co', icon: '🎨', category: 'nft' },
  { title: 'Farcaster', url: 'https://warpcast.com', icon: '📡', category: 'social' },
  { title: 'DexScreener', url: 'https://dexscreener.com/base', icon: '📊', category: 'tools' },
]

// ─── AI Suggestions ────────────────────────────────────────────────
const AI_SUGGESTIONS = [
  { text: 'Swap 0.5 ETH → USDC on Aerodrome', action: '/swap' },
  { text: 'Check my cold storage balance', action: '/cold-storage' },
  { text: 'Show top pools on Base', action: 'https://aerodrome.finance/pools' },
  { text: 'Stake LP tokens for Au rewards', action: '/stake' },
  { text: 'Check pending governance votes', action: '/governance' },
  { text: 'Bridge ETH from Ethereum to Base', action: 'https://bridge.base.org' },
  { text: 'Analyze my portfolio performance', action: '/' },
  { text: 'Find new yield opportunities', action: '/liquidity' },
]

// ─── Component ─────────────────────────────────────────────────────
export function WalletShell({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'home', title: 'Dashboard', url: '/', type: 'dapp', icon: <BarChart3 className="h-3 w-3" /> },
  ])
  const [activeTab, setActiveTab] = useState('home')
  const [url, setUrl] = useState('/')
  const [isLoading, setIsLoading] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [showTabsDropdown, setShowTabsDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentTab = tabs.find(t => t.id === activeTab)

  const navigate = useCallback((url: string, title?: string, type?: Tab['type']) => {
    setIsLoading(true)
    setUrl(url)
    setShowHistory(false)
    setShowBookmarks(false)
    setShowAI(false)

    const newTitle = title || urlToTitle(url)
    const newType = type || (url.startsWith('/') ? 'dapp' : 'browser')

    const existingTab = tabs.find(t => t.url === url)
    if (existingTab) {
      setActiveTab(existingTab.id)
    } else {
      const newTab: Tab = {
        id: `tab-${Date.now()}`,
        title: newTitle,
        url,
        type: newType,
        icon: newType === 'dapp' ? <Zap className="h-3 w-3" /> : <Globe className="h-3 w-3" />,
      }
      setTabs(prev => [...prev, newTab])
      setActiveTab(newTab.id)
    }

    setHistory(prev => [url, ...prev.filter(h => h !== url)].slice(0, 50))

    setTimeout(() => setIsLoading(false), 300)
  }, [tabs])

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId)
      if (filtered.length === 0) {
        const homeTab: Tab = { id: 'home', title: 'Dashboard', url: '/', type: 'dapp', icon: <BarChart3 className="h-3 w-3" /> }
        setActiveTab('home')
        setUrl('/')
        return [homeTab]
      }
      if (activeTab === tabId) {
        const idx = prev.findIndex(t => t.id === tabId)
        const newActive = filtered[Math.min(idx, filtered.length - 1)]
        setActiveTab(newActive.id)
        setUrl(newActive.url)
      }
      return filtered
    })
  }, [activeTab])

  const handleAiSubmit = useCallback(() => {
    if (!aiInput.trim()) return
    const input = aiInput.toLowerCase()

    // Simple intent matching
    if (input.includes('swap') || input.includes('trade') || input.includes('exchange')) {
      navigate('/swap', 'Swap')
    } else if (input.includes('liquid') || input.includes('pool') || input.includes('lp')) {
      navigate('/liquidity', 'Liquidity')
    } else if (input.includes('stake') || input.includes('staking')) {
      navigate('/stake', 'Stake')
    } else if (input.includes('cold') || input.includes('hardware') || input.includes('vault')) {
      navigate('/cold-storage', 'Cold Storage')
    } else if (input.includes('govern') || input.includes('vote') || input.includes('proposal')) {
      navigate('/governance', 'Govern')
    } else if (input.includes('portfolio') || input.includes('balance') || input.includes('dashboard')) {
      navigate('/', 'Dashboard')
    } else if (input.includes('bridge')) {
      navigate('https://bridge.base.org', 'Base Bridge', 'browser')
    } else if (input.includes('aero')) {
      navigate('https://aerodrome.finance', 'Aerodrome', 'browser')
    } else if (input.includes('uniswap')) {
      navigate('https://app.uniswap.org', 'Uniswap', 'browser')
    } else {
      // Treat as URL search
      if (input.startsWith('http')) {
        navigate(input, input, 'browser')
      } else {
        navigate(`https://www.google.com/search?q=${encodeURIComponent(aiInput)}`, `Search: ${aiInput}`, 'browser')
      }
    }
    setAiInput('')
    setShowAI(false)
  }, [aiInput, navigate])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ─── Browser Chrome ─────────────────────────────────────── */}
      <div className="sticky top-0 z-[100] border-b border-border/40 bg-card/95 backdrop-blur-xl">
        {/* Tab Bar */}
        <div className="flex items-center gap-0 px-2 pt-1.5 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setUrl(tab.url) }}
              className={cn(
                'group flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs whitespace-nowrap border-b-2 transition-all min-w-0 max-w-[180px]',
                activeTab === tab.id
                  ? 'bg-background border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              {tab.icon || <Globe className="h-3 w-3" />}
              <span className="truncate">{tab.title}</span>
              {tab.id !== 'home' && (
                <span
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                  className="ml-1 rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
                >
                  <X className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => navigate('/', 'Dashboard')}
            className="flex items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="New Tab"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* URL Bar + Controls */}
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          {/* Navigation buttons */}
          <div className="flex items-center gap-0.5">
            <button className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" disabled>
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <button className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" disabled>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { if (currentTab) navigate(currentTab.url, currentTab.title) }}
              className={cn('rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors', isLoading && 'animate-spin')}
            >
              <RotateCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </button>
          </div>

          {/* URL Bar */}
          <div className="flex-1 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 group focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            {isLoading ? (
              <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            ) : currentTab?.type === 'dapp' ? (
              <Shield className="h-3 w-3 text-green-500" />
            ) : (
              <Globe className="h-3 w-3 text-muted-foreground" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (url.startsWith('http')) {
                    navigate(url, url, 'browser')
                  } else if (url.startsWith('/')) {
                    navigate(url, urlToTitle(url), 'dapp')
                  } else {
                    navigate(`https://www.google.com/search?q=${encodeURIComponent(url)}`, `Search: ${url}`, 'browser')
                  }
                }
              }}
              placeholder="Search dApps, tokens, or paste URL..."
              className="flex-1 bg-transparent text-sm font-mono focus:outline-none text-foreground placeholder:text-muted-foreground/50"
            />
            {currentTab?.type === 'dapp' && (
              <span className="hidden sm:flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-500">
                <Shield className="h-2.5 w-2.5" /> Base
              </span>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => { setShowBookmarks(!showBookmarks); setShowAI(false); setShowHistory(false) }}
              className={cn('rounded-md p-1.5 transition-colors', showBookmarks ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent')}
              title="Bookmarks"
            >
              <Bookmark className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { setShowHistory(!showHistory); setShowBookmarks(false); setShowAI(false) }}
              className={cn('rounded-md p-1.5 transition-colors', showHistory ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent')}
              title="History"
            >
              <History className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { setShowAI(!showAI); setShowBookmarks(false); setShowHistory(false); setTimeout(() => inputRef.current?.focus(), 100) }}
              className={cn('rounded-md p-1.5 transition-colors', showAI ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent')}
              title="AI Assistant"
            >
              <Bot className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Dropdown Panels */}
        {showBookmarks && (
          <BookmarksPanel
            bookmarks={DEFAULT_BOOKMARKS}
            onNavigate={(url, title) => navigate(url, url.startsWith('/') ? title : title, url.startsWith('/') ? 'dapp' : 'browser')}
            onClose={() => setShowBookmarks(false)}
          />
        )}

        {showHistory && (
          <HistoryPanel
            history={history}
            onNavigate={(url) => navigate(url, urlToTitle(url))}
            onClose={() => setShowHistory(false)}
          />
        )}

        {showAI && (
          <AIPanel
            input={aiInput}
            setInput={setAiInput}
            suggestions={AI_SUGGESTIONS}
            onSubmit={handleAiSubmit}
            onNavigate={navigate}
            onClose={() => setShowAI(false)}
          />
        )}
      </div>

      {/* ─── Content Area ─────────────────────────────────────────── */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/20">
            <div className="h-full bg-primary animate-pulse" style={{ width: '70%' }} />
          </div>
        )}
        {children}
      </div>

      {/* ─── Bottom Status Bar ────────────────────────────────────── */}
      <div className="border-t border-border/40 bg-card/50 px-3 py-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Base Mainnet
          </span>
          <span className="hidden sm:inline">Gas: ~0.01 gwei</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">Block: #24,567,890</span>
          <span className="flex items-center gap-1">
            <Radio className="h-2.5 w-2.5" />
            Connected
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Bookmarks Panel ───────────────────────────────────────────────
function BookmarksPanel({
  bookmarks,
  onNavigate,
  onClose,
}: {
  bookmarks: BookmarkItem[]
  onNavigate: (url: string, title: string) => void
  onClose: () => void
}) {
  const categories = ['our', 'defi', 'nft', 'tools', 'social'] as const
  const categoryLabels = { our: '🏠 AV Treasury', defi: '💰 DeFi', nft: '🎨 NFT', tools: '🔧 Tools', social: '💬 Social' }

  return (
    <div className="absolute top-full left-2 mt-1 w-[480px] max-h-[320px] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl z-50">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Bookmarks</h3>
          <button onClick={onClose} className="rounded p-0.5 hover:bg-accent"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="p-2 space-y-3">
        {categories.map(cat => {
          const items = bookmarks.filter(b => b.category === cat)
          if (items.length === 0) return null
          return (
            <div key={cat}>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 mb-1">{categoryLabels[cat]}</div>
              <div className="grid grid-cols-3 gap-1">
                {items.map(item => (
                  <button
                    key={item.url}
                    onClick={() => { onNavigate(item.url, item.title); onClose() }}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent transition-colors"
                  >
                    <span className="text-base">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{item.title}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{item.url}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── History Panel ─────────────────────────────────────────────────
function HistoryPanel({
  history,
  onNavigate,
  onClose,
}: {
  history: string[]
  onNavigate: (url: string) => void
  onClose: () => void
}) {
  return (
    <div className="absolute top-full left-2 mt-1 w-[360px] max-h-[320px] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl z-50">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">History</h3>
          <button onClick={onClose} className="rounded p-0.5 hover:bg-accent"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="p-1">
        {history.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">No history yet</div>
        ) : (
          history.map((url, i) => (
            <button
              key={i}
              onClick={() => { onNavigate(url); onClose() }}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-accent transition-colors"
            >
              <History className="h-3 w-3 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="text-xs truncate">{urlToTitle(url)}</div>
                <div className="text-[10px] text-muted-foreground truncate font-mono">{url}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ─── AI Panel ──────────────────────────────────────────────────────
function AIPanel({
  input,
  setInput,
  suggestions,
  onSubmit,
  onNavigate,
  onClose,
}: {
  input: string
  setInput: (v: string) => void
  suggestions: typeof AI_SUGGESTIONS
  onSubmit: () => void
  onNavigate: (url: string, title: string, type?: Tab['type']) => void
  onClose: () => void
}) {
  return (
    <div className="absolute top-full right-2 mt-1 w-[420px] rounded-xl border border-border bg-card shadow-2xl z-50 overflow-hidden">
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Anvil AI</h3>
            <p className="text-[10px] text-muted-foreground">Your web3 co-pilot</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded p-0.5 hover:bg-accent"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            placeholder="Ask anything... 'swap 0.5 ETH to USDC'"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
            autoFocus
          />
          <button
            onClick={onSubmit}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Zap className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-3 space-y-1">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Quick Actions</div>
          {suggestions.slice(0, 5).map((s, i) => (
            <button
              key={i}
              onClick={() => {
                if (s.action.startsWith('http')) {
                  onNavigate(s.action, s.text, 'browser')
                } else {
                  onNavigate(s.action, s.text, 'dapp')
                }
                onClose()
              }}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-accent transition-colors"
            >
              <Sparkles className="h-3 w-3 text-primary/60" />
              <span className="text-xs">{s.text}</span>
              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground ml-auto" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────
function urlToTitle(url: string): string {
  if (url === '/') return 'Dashboard'
  if (url === '/swap') return 'Swap'
  if (url === '/liquidity') return 'Liquidity'
  if (url === '/stake') return 'Stake'
  if (url === '/cold-storage') return 'Cold Storage'
  if (url === '/governance') return 'Govern'
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}
