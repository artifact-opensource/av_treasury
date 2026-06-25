import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatTokenAmount(amount: bigint, decimals: number = 18, displayDecimals: number = 4): string {
  const divisor = BigInt(10 ** decimals)
  const whole = amount / divisor
  const remainder = amount % divisor
  const decimal = Number(remainder) / Number(divisor)
  return `${whole.toLocaleString()}.${decimal.toFixed(displayDecimals).slice(2)}`
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function bpsToPercent(bps: number): number {
  return bps / 100
}
