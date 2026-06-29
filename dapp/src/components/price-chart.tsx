'use client'

import { useEffect, useRef, useState } from 'react'

interface PricePoint {
  time: number
  price: number
}

interface PriceChartProps {
  symbol: string
  currentPrice: number
  priceHistory: PricePoint[]
  height?: number
  color?: string
}

export function PriceChart({ symbol, currentPrice, priceHistory, height = 200, color = '#10b981' }: PriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dimensions.width === 0 || priceHistory.length < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = dimensions.width
    const h = dimensions.height
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    const prices = priceHistory.map(p => p.price)
    const minPrice = Math.min(...prices) * 0.998
    const maxPrice = Math.max(...prices) * 1.002
    const priceRange = maxPrice - minPrice || 1

    const padding = { top: 20, right: 60, bottom: 30, left: 10 }
    const chartW = w - padding.left - padding.right
    const chartH = h - padding.top - padding.bottom

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(w - padding.right, y)
      ctx.stroke()
    }

    // Price line
    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom)
    gradient.addColorStop(0, color + '40')
    gradient.addColorStop(1, color + '00')

    ctx.beginPath()
    ctx.moveTo(padding.left, padding.top + chartH - ((priceHistory[0].price - minPrice) / priceRange) * chartH)

    for (let i = 1; i < priceHistory.length; i++) {
      const x = padding.left + (i / (priceHistory.length - 1)) * chartW
      const y = padding.top + chartH - ((priceHistory[i].price - minPrice) / priceRange) * chartH
      ctx.lineTo(x, y)
    }

    // Fill area
    const lastX = padding.left + chartW
    ctx.lineTo(lastX, padding.top + chartH)
    ctx.lineTo(padding.left, padding.top + chartH)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Stroke line
    ctx.beginPath()
    ctx.moveTo(padding.left, padding.top + chartH - ((priceHistory[0].price - minPrice) / priceRange) * chartH)
    for (let i = 1; i < priceHistory.length; i++) {
      const x = padding.left + (i / (priceHistory.length - 1)) * chartW
      const y = padding.top + chartH - ((priceHistory[i].price - minPrice) / priceRange) * chartH
      ctx.lineTo(x, y)
    }
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()

    // Current price dot
    const lastPrice = priceHistory[priceHistory.length - 1]
    const lastY = padding.top + chartH - ((lastPrice.price - minPrice) / priceRange) * chartH
    ctx.beginPath()
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.beginPath()
    ctx.arc(lastX, lastY, 8, 0, Math.PI * 2)
    ctx.fillStyle = color + '30'
    ctx.fill()

    // Price labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = '11px monospace'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const price = maxPrice - (priceRange / 4) * i
      const y = padding.top + (chartH / 4) * i
      ctx.fillText(`$${price.toFixed(2)}`, w - 5, y + 4)
    }

    // Symbol label
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(symbol, padding.left, 14)

    // Current price label
    ctx.fillStyle = color
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`$${currentPrice.toFixed(2)}`, w - padding.right, 14)

  }, [dimensions, priceHistory, currentPrice, color, symbol, height])

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <canvas
        ref={canvasRef}
        style={{ width: dimensions.width, height }}
        className="rounded-lg"
      />
    </div>
  )
}

// Price history fetcher using CoinGecko public API (free, no key needed)
export async function fetchPriceHistory(symbol: string, days: number = 7): Promise<PricePoint[]> {
  try {
    const idMap: Record<string, string> = {
      'ETH': 'ethereum',
      'BTC': 'bitcoin',
      'USDC': 'usd-coin',
      'WETH': 'ethereum',
    }
    const id = idMap[symbol] || symbol.toLowerCase()
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) throw new Error('Failed to fetch')
    const data = await res.json()
    return data.prices.map(([time, price]: [number, number]) => ({ time, price }))
  } catch {
    // Generate mock data if API fails
    const basePrice = symbol === 'ETH' ? 3500 : symbol === 'BTC' ? 65000 : 1
    const points: PricePoint[] = []
    const now = Date.now()
    for (let i = 0; i < 24 * days; i++) {
      points.push({
        time: now - (24 * days - i) * 3600000,
        price: basePrice * (1 + (Math.random() - 0.5) * 0.1),
      })
    }
    return points
  }
}
