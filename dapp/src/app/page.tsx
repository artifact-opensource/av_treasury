'use client'
import React from 'react'
import { FlywheelMonitor } from "@/components/monitor/FlywheelMonitor"

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">COMMAND CENTER</h1>
          <p className="text-zinc-500">Real-time Protocol Intelligence</p>
        </div>
      </header>
      <FlywheelMonitor />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800">
           <h2 className="text-xl font-bold mb-4">Your Portfolio</h2>
           <p className="text-zinc-400">Connect wallet to view assets</p>
        </div>
      </div>
    </div>
  )
}
