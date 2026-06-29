// Token logo SVG data URIs — inline, no external dependencies

export const TOKEN_LOGOS: Record<string, string> = {
  // Au token — gold circle with "Au" chemical symbol
  AU: `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="au-g" cx="40%" cy="35%">
      <stop offset="0%" stop-color="#fff7cc"/>
      <stop offset="40%" stop-color="#ffd700"/>
      <stop offset="100%" stop-color="#b8860b"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#au-g)" stroke="#8B6914" stroke-width="2"/>
  <text x="32" y="42" font-family="serif" font-size="22" font-weight="bold" fill="#5a4200" text-anchor="middle">Au</text>
</svg>`)}`,

  // Ag token — silver circle with "Ag" chemical symbol
  AG: `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="ag-g" cx="40%" cy="35%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#d4d4d8"/>
      <stop offset="100%" stop-color="#71717a"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#ag-g)" stroke="#52525b" stroke-width="2"/>
  <text x="32" y="42" font-family="serif" font-size="20" font-weight="bold" fill="#27272a" text-anchor="middle">Ag</text>
</svg>`)}`,

  // ETH — diamond shape
  ETH: `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="eth-g" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#627eea"/>
      <stop offset="100%" stop-color="#3c3c3d"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="#1a1a2e" stroke="#627eea" stroke-width="2"/>
  <polygon points="32,10 44,30 32,40 20,30" fill="#627eea" opacity="0.6"/>
  <polygon points="32,40 44,30 32,54 20,30" fill="url(#eth-g)" opacity="0.9"/>
</svg>`)}`,

  // USDC — blue circle
  USDC: `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="usdc-g" cx="40%" cy="35%">
      <stop offset="0%" stop-color="#4da6ff"/>
      <stop offset="100%" stop-color="#2775ca"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#usdc-g)" stroke="#1a5ca8" stroke-width="2"/>
  <text x="32" y="40" font-family="sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">$C</text>
</svg>`)}`,

  // LP token — paired circles
  AVLP: `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="lp-g" cx="40%" cy="35%">
      <stop offset="0%" stop-color="#4ade80"/>
      <stop offset="100%" stop-color="#16a34a"/>
    </radialGradient>
  </defs>
  <circle cx="20" cy="32" r="18" fill="#ffd700" opacity="0.8"/>
  <circle cx="44" cy="32" r="18" fill="url(#lp-g)" stroke="#166534" stroke-width="2"/>
</svg>`)}`,

  // RSBT — reserve backed token
  RSBT: `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="rsb-g" cx="40%" cy="35%">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#rsb-g)" stroke="#5b21b6" stroke-width="2"/>
  <text x="32" y="42" font-family="serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">R</text>
</svg>`)}`,

  // Default fallback
  DEFAULT: `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#1e1e2e" stroke="#3f3f46" stroke-width="2"/>
  <text x="32" y="40" font-family="sans-serif" font-size="20" fill="#71717a" text-anchor="middle">?</text>
</svg>`)}`,
}

export function getTokenLogo(symbol: string): string {
  return TOKEN_LOGOS[symbol.toUpperCase()] || TOKEN_LOGOS.DEFAULT
}
