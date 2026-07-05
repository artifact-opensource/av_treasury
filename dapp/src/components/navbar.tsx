'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Wallet, ArrowLeftRight, Droplets, PieChart, Vote, Coins, HardDrive, BarChart3, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAddress } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: PieChart },
  { href: '/swap', label: 'Swap', icon: ArrowLeftRight },
  { href: '/liquidity', label: 'Liquidity', icon: Droplets },
  { href: '/stake', label: 'Stake', icon: Coins },
  { href: '/governance', label: 'Govern', icon: Vote },
  { href: '/cold-storage', label: 'Cold Storage', icon: HardDrive },
]

export function Navbar() {
  const pathname = usePathname()
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const [showConnectModal, setShowConnectModal] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">T</span>
              </div>
              <span className="font-semibold text-lg hidden sm:block">Treasury</span>
            </Link>
            <nav className="hidden lg:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="font-mono">{formatAddress(address!)}</span>
                </div>
                <button
                  onClick={() => disconnect()}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowConnectModal(!showConnectModal)}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showConnectModal && "rotate-180")} />
                </button>

                {showConnectModal && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card p-1 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                    {connectors.map((connector) => (
                      <button
                        key={connector.id}
                        onClick={() => {
                          connect({ connector });
                          setShowConnectModal(false);
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2 text-sm rounded-lg text-foreground hover:bg-accent transition-colors"
                      >
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                          {connector.name[0]}
                        </div>
                        {connector.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="flex md:hidden items-center gap-1 pb-3 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
