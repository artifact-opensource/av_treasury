'use client'

import { useMemo } from 'react'

interface PriceChartProps {
  data: { price: number; timestamp: number }[]
  color?: string
  width?: number
  height?: number
  showAxis?: boolean
  label?: string
}

export function PriceChart({
  data,
  color = '#00f0ff',
  width = 400,
  height = 120,
  showAxis = true,
  label,
}: PriceChartProps) {
  const { path, areaPath, minPrice, maxPrice, lastPrice, firstPrice } = useMemo(() => {
    if (data.length < 2) {
      return { path: '', areaPath: '', minPrice: 0, maxPrice: 0, lastPrice: 0, firstPrice: 0 }
    }

    const prices = data.map(d => d.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min || 1

    const padding = showAxis ? 20 : 0
    const chartW = width - (showAxis ? 10 : 0)
    const chartH = height - padding

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * chartW
      const y = chartH - ((d.price - min) / range) * (chartH - 10)
      return [x, y] as [number, number]
    })

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`)
      .join(' ')

    const area = `${linePath} L${chartW},${chartH} L0,${chartH} Z`

    return {
      path: linePath,
      areaPath: area,
      minPrice: min,
      maxPrice: max,
      lastPrice: data[data.length - 1].price,
      firstPrice: data[0].price,
    }
  }, [data, width, height, showAxis])

  if (data.length < 2) {
    return (
      <div style={{
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 8,
        border: '1px solid #1e1e2e',
        fontSize: 11,
        color: '#71717a',
      }}>
        {label && <span style={{ marginRight: 8 }}>{label}</span>}
        Awaiting price data...
      </div>
    )
  }

  const change = ((lastPrice - firstPrice) / firstPrice) * 100
  const changeColor = change >= 0 ? '#22c55e' : '#ef4444'

  return (
    <div style={{ position: 'relative', width, height }}>
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 10,
        color: '#71717a',
        padding: '2px 4px',
      }}>
        <span>{label || ''}</span>
        <span style={{ color: changeColor, fontWeight: 600 }}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </span>
      </div>

      {/* SVG Chart */}
      <svg width={width} height={height} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {showAxis && [0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={0}
            y1={(height - 20) * pct}
            x2={width}
            y2={(height - 20) * pct}
            stroke="#1e1e2e"
            strokeWidth={0.5}
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#grad-${color.replace('#','')})`} />

        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Last price dot */}
        {data.length > 0 && (
          <circle
            cx={width}
            cy={(height - 20) - ((lastPrice - minPrice) / (maxPrice - minPrice || 1)) * (height - 30)}
            r={3}
            fill={color}
          />
        )}

        {/* Axis labels */}
        {showAxis && (
          <>
            <text x={2} y={height - 4} fontSize={8} fill="#52525b">
              ${minPrice.toFixed(4)}
            </text>
            <text x={2} y={12} fontSize={8} fill="#52525b">
              ${maxPrice.toFixed(4)}
            </text>
            <text x={width - 40} y={height - 4} fontSize={8} fill="#52525b">
              ${lastPrice.toFixed(4)}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}

// Mini sparkline for inline use
export function Sparkline({
  data,
  color = '#00f0ff',
  width = 80,
  height = 24,
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
}) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
