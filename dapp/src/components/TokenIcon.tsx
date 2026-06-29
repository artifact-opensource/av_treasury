'use client'

import { getTokenLogo } from '@/lib/token-logos'

interface TokenIconProps {
  symbol: string
  size?: number
  className?: string
}

export function TokenIcon({ symbol, size = 32, className }: TokenIconProps) {
  const src = getTokenLogo(symbol)

  return (
    <img
      src={src}
      alt={symbol}
      width={size}
      height={size}
      className={className}
      style={{
        borderRadius: '50%',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    />
  )
}

// Paired token icon for LP pairs
export function PairIcon({
  symbolA,
  symbolB,
  size = 28,
}: {
  symbolA: string
  symbolB: string
  size?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', position: 'relative', width: size * 1.6, height: size }}>
      <img
        src={getTokenLogo(symbolA)}
        alt={symbolA}
        width={size}
        height={size}
        style={{ borderRadius: '50%', position: 'absolute', left: 0, zIndex: 2 }}
      />
      <img
        src={getTokenLogo(symbolB)}
        alt={symbolB}
        width={size}
        height={size}
        style={{ borderRadius: '50%', position: 'absolute', left: size * 0.6, zIndex: 1 }}
      />
    </div>
  )
}
