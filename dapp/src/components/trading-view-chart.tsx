'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface TradingViewChartProps {
  symbol: string
  interval?: string
  height?: number
  theme?: 'light' | 'dark'
  autosize?: boolean
}

export function TradingViewChart({
  symbol,
  interval = '60',
  height = 400,
  theme = 'dark',
  autosize = true,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [widget, setWidget] = useState<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || widget) return

    const loadTradingView = async () => {
      try {
        if (typeof window === 'undefined') return

        // Load TradingView widget script
        if (!window.TradingView) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = 'https://s3.tradingview.com/tv.js'
            script.async = true
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load TradingView'))
            document.head.appendChild(script)
          })
        }

        if (!window.TradingView) {
          throw new Error('TradingView not loaded')
        }

        // Map our symbols to TradingView symbols
        const symbolMap: Record<string, string> = {
          'artifact-gold': 'TVC:GOLD',
          'artifact-silver': 'TVC:SILVER',
          'ethereum': 'BINANCE:ETHUSDT',
          'usd-coin': 'BINANCE:USDCUSDT',
          'artifact-utility': 'BINANCE:BTCUSDT', // fallback
          'artifact-governance': 'BINANCE:BTCUSDT', // fallback
          'aerodrome-finance': 'BINANCE:AEROUSDT',
        }

        const tvSymbol = symbolMap[symbol] || `BINANCE:${symbol.toUpperCase()}USDT`

        const newWidget = new window.TradingView.widget({
          symbol: tvSymbol,
          interval: interval as any,
          container_id: containerRef.current!.id,
          theme,
          style: '1',
          locale: 'en',
          toolbar_bg: theme === 'dark' ? '#1a1a1a' : '#f5f5f5',
          enable_publishing: false,
          allow_symbol_change: true,
          studies: [],
          show_popup_button: false,
          popup_width: '100%',
          popup_height: '100%',
          autosize,
          height,
          width: '100%',
          overrides: {
            'paneProperties.background': theme === 'dark' ? '#0f0f0f' : '#ffffff',
            'paneProperties.vertGridProperties.color': theme === 'dark' ? '#2a2a2a' : '#e0e0e0',
            'paneProperties.horzGridProperties.color': theme === 'dark' ? '#2a2a2a' : '#e0e0e0',
            'scalesProperties.textColor': theme === 'dark' ? '#888' : '#666',
            'mainSeriesProperties.candleStyle.upColor': '#22c55e',
            'mainSeriesProperties.candleStyle.downColor': '#ef4444',
            'mainSeriesProperties.candleStyle.borderUpColor': '#22c55e',
            'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
            'mainSeriesProperties.candleStyle.wickUpColor': '#22c55e',
            'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
          },
        })

        newWidget.onChartReady(() => {
          setIsLoaded(true)
          setError(null)
        })

        setWidget(newWidget)
      } catch (err) {
        console.error('TradingView error:', err)
        setError('Chart unavailable')
        setIsLoaded(false)
      }
    }

    loadTradingView()

    return () => {
      if (widget) {
        try {
          widget.remove()
        } catch {}
        setWidget(null)
        setIsLoaded(false)
      }
    }
  }, [symbol, interval, height, theme, autosize])

  const containerId = `tradingview-${symbol}-${interval}`

  return (
    <div className={cn('w-full rounded-lg border bg-card', 'overflow-hidden')}>
      <div
        ref={containerRef}
        id={containerId}
        style={{ height, width: '100%' }}
        className="relative"
      >
        {!isLoaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-card border-t border-border">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">Loading chart...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-card border-t border-border">
            <div className="flex flex-col items-center gap-2 text-muted-foreground p-4 text-center">
              <span className="text-sm font-medium">Chart unavailable</span>
              <span className="text-xs">{symbol}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

declare global {
  interface Window {
    TradingView: any
  }
}
