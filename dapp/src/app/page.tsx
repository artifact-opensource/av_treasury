'use client'
import React from 'react'
import { FlywheelMonitor } from '../components/monitor/FlywheelMonitor'
import { useAccount } from 'wagmi'

export default function Dashboard() {
  const { isConnected, address } = useAccount()

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Main Navigation Shell */}
      <nav className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-black tracking-tighter">ARTIFACT <span className="text-yellow-500">TREASURY</span></h1>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
            <a href="/dashboard" className="text-white">Dashboard</a>
            <a href="/swap" className="hover:text-white transition-colors">Swap</a>
            <a href="/liquidity" className="hover:text-white transition-colors">Liquidity</a>
            <a href="/stake" className="hover:text-white transition-colors">Stake</a>
            <a href="/govern" className="hover:text-white transition-colors">Govern</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isConnected ? (
            <div className="px-4 py-2 bg-zinc-900 rounded-full border border-zinc-800 text-sm font-mono">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          ) : (
            <button className="px-6 py-2 bg-white text-black rounded-full text-sm font-bold hover:bg-zinc-200 transition-colors">
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      <main className="p-8 max-w-7xl mx-auto space-y-12">
        {/* Intelligence Layer */}
        <section>
          <div className="mb-6">
            <h2 className="text-4xl font-black tracking-tighter">COMMAND CENTER</h2>
            <p className="text-zinc-500">Real-time Protocol Intelligence & Treasury Flux</p>
          </div>
          <FlywheelMonitor />
        </section>

        {/* Treasury Assets Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 bg-zinc-900 rounded-2xl border border-zinc-800">
            <h3 className="text-xl font-bold mb-6">Treasury Allocation</h3>
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl text-zinc-600">
              Chart Integration Pending...
            </div>
          </div>
          <div className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800">
            <h3 className="text-xl font-bold mb-6">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full p-3 bg-zinc-800 rounded-lg text-left hover:bg-zinc-700 transition-colors text-sm">Mint Au Tokens</button>
              <button className="w-full p-3 bg-zinc-800 rounded-lg text-left hover:bg-zinc-700 transition-colors text-sm">Stake Governance</button>
              <button className="w-full p-3 bg-zinc-800 rounded-lg text-left hover:bg-zinc-700 transition-colors text-sm">Claim Rewards</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
