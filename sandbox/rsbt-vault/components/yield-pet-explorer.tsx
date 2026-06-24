"use client";

import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Activity, Zap, RotateCcw, Fingerprint, Database, Coins } from "lucide-react";

function generateGielisPoints(
  m: number, n1: number, n2: number, n3: number, a: number, b: number, scale: number, numPoints = 250
) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const theta = (i * 2 * Math.PI) / numPoints;
    let part1 = Math.pow(Math.abs(Math.cos((m * theta) / 4) / a), n2);
    let part2 = Math.pow(Math.abs(Math.sin((m * theta) / 4) / b), n3);
    let r = Math.pow(part1 + part2, -1 / n1);
    
    if (Math.abs(r) === Infinity || isNaN(r)) r = 0;
    r = Math.min(r, 4); // Clamp to prevent visual tearing
    
    const x = r * Math.cos(theta) * scale;
    const y = r * Math.sin(theta) * scale;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
}

export function YieldPetExplorer() {
  const [lockedCapital, setLockedCapital] = useState(2500);
  const [epochVelocity, setEpochVelocity] = useState(12);
  const [accruedRewards, setAccruedRewards] = useState(150);
  const [dormancyDays, setDormancyDays] = useState(0);

  // Math logic mapping based on Whitepaper
  const m = 3 + (lockedCapital / 1500);
  const isDormant = dormancyDays > 7;
  const isTerminated = dormancyDays > 30;
  
  const vitality = Math.max(0, 100 - (dormancyDays * 3));
  
  // Dampen coefficients if neglected
  let n1 = 1.0;
  let n2 = 1.0 + (epochVelocity / 50);
  let n3 = 1.0 + (epochVelocity / 50);
  
  if (isDormant) {
     const decay = Math.exp(-0.05 * (dormancyDays - 7));
     n1 *= decay;
     n2 *= decay;
     n3 *= decay;
  }
  
  const baseScale = 60 + (accruedRewards / 5);
  const scale = isTerminated ? 40 : baseScale;
  
  const points = useMemo(() => generateGielisPoints(m, n1, n2, n3, 1, 1, scale), [m, n1, n2, n3, scale]);
  
  // Dynamic color state
  const strokeColor = isTerminated ? "#525252" : isDormant ? "#9ca3af" : "#2dd4bf"; // teal-400
  const fillColor = isTerminated ? "rgba(82,82,82,0.1)" : isDormant ? "rgba(156,163,175,0.1)" : "rgba(45,212,191,0.15)";
  
  const handleFeed = () => {
    setDormancyDays(0);
    setAccruedRewards(prev => prev + 50);
    setEpochVelocity(prev => Math.min(100, prev + 5));
  };

  return (
    <div className="space-y-12">
      {/* Interactive Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Visualizer Canvas */}
        <div className="relative aspect-square md:aspect-video lg:aspect-square bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden flex items-center justify-center">
           {/* Grid Background */}
           <div 
             className="absolute inset-0 opacity-20 pointer-events-none" 
             style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }}
           />
           
           <motion.svg 
             viewBox="-200 -200 400 400" 
             className="w-full h-full p-8"
             animate={{ rotate: 360 }}
             transition={{ duration: 100 - epochVelocity, repeat: Infinity, ease: "linear" }}
           >
              <defs>
                <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="0" cy="0" r={scale * 1.5} fill="url(#glow)" className="transition-all duration-1000" />
              <motion.polygon 
                points={points} 
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth="2"
                className="transition-all duration-700 ease-in-out"
                style={{ filter: isTerminated ? 'none' : 'drop-shadow(0 0 10px currentColor)' }}
              />
           </motion.svg>
           
           {/* Overlay HUD */}
           <div className="absolute top-4 left-4 font-mono text-xs text-neutral-500">
             <p>DNA: 0x4FA9B30...C9D8E7</p>
             <p className={vitality < 50 ? "text-red-400" : "text-emerald-400"}>SYS.VITALITY: {vitality}%</p>
           </div>
           <div className="absolute bottom-4 right-4 font-mono text-xs text-neutral-500 text-right">
             <p>m={m.toFixed(2)}</p>
             <p>n1={n1.toFixed(2)} n2={n2.toFixed(2)}</p>
           </div>
        </div>

        {/* Controls */}
        <div className="space-y-8 flex flex-col justify-center">
          <div className="space-y-6 bg-neutral-900/50 border border-neutral-800 p-6 rounded-2xl">
            <h3 className="font-mono text-sm text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Live Vault Metrics
            </h3>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between font-mono text-xs mb-2">
                  <span className="text-neutral-400">Locked Capital (LP)</span>
                  <span className="text-neutral-100">${lockedCapital}</span>
                </div>
                <input type="range" min="0" max="10000" step="100" value={lockedCapital} onChange={(e) => setLockedCapital(Number(e.target.value))} className="w-full accent-cyan-500" />
              </div>

              <div>
                <div className="flex justify-between font-mono text-xs mb-2">
                  <span className="text-neutral-400">Epoch Velocity</span>
                  <span className="text-neutral-100">{epochVelocity}%</span>
                </div>
                <input type="range" min="0" max="100" value={epochVelocity} onChange={(e) => setEpochVelocity(Number(e.target.value))} className="w-full accent-cyan-500" />
              </div>

              <div>
                <div className="flex justify-between font-mono text-xs mb-2">
                  <span className="text-neutral-400">Dormancy (Neglect)</span>
                  <span className="text-neutral-100">{dormancyDays} Days</span>
                </div>
                <input type="range" min="0" max="60" value={dormancyDays} onChange={(e) => setDormancyDays(Number(e.target.value))} className="w-full accent-red-500" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={handleFeed}
              className="flex flex-col items-center justify-center p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-xl hover:bg-emerald-900/40 transition-colors text-emerald-400 font-mono text-sm gap-2 cursor-pointer"
            >
              <Zap className="w-5 h-5" />
              <span>Feed (Restake)</span>
            </button>
            <button 
              onClick={() => setDormancyDays(prev => prev + 5)}
              className="flex flex-col items-center justify-center p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:bg-neutral-800 transition-colors text-neutral-400 font-mono text-sm gap-2 cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Advance Time</span>
            </button>
          </div>
        </div>
      </div>

      {/* Documentation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-neutral-800">
        
        {/* Architect */}
        <div className="bg-neutral-900/30 border border-neutral-800 p-6 rounded-2xl space-y-4">
          <div className="w-10 h-10 rounded-full bg-blue-950/50 border border-blue-900 flex items-center justify-center text-blue-400 mb-6">
            <Fingerprint className="w-5 h-5" />
          </div>
          <h4 className="font-mono text-lg text-neutral-100">Identity Verification Flow</h4>
          <p className="text-sm text-neutral-400 leading-relaxed">
            <strong className="text-neutral-200">Initiation:</strong> User submits credentials to an off-chain issuer. The issuer signs a payload.<br/><br/>
            <strong className="text-neutral-200">Minting:</strong> User executes <code className="text-cyan-400">mintIdentity(signature, identityHash)</code>. The RSBT anchors the hash.<br/><br/>
            <strong className="text-neutral-200">Recovery:</strong> A decoupled <code className="text-cyan-400">RecoveryKey</code> is set. If the <code className="text-cyan-400">OperationalKey</code> is breached, the <code className="text-cyan-400">initiateReissue()</code> function safely migrates the identity and vault assets to a clean wallet.
          </p>
        </div>

        {/* NFT Specialist */}
        <div className="bg-neutral-900/30 border border-neutral-800 p-6 rounded-2xl space-y-4">
          <div className="w-10 h-10 rounded-full bg-purple-950/50 border border-purple-900 flex items-center justify-center text-purple-400 mb-6">
            <Database className="w-5 h-5" />
          </div>
          <h4 className="font-mono text-lg text-neutral-100">Soulbound Mechanics</h4>
          <p className="text-sm text-neutral-400 leading-relaxed">
            <strong className="text-neutral-200">Transfer Blocks:</strong> Standard ERC-721 transfers revert instantly, anchoring the token.<br/><br/>
            <strong className="text-neutral-200">Zero-Dependency:</strong> The asset utilizes a Continuous Morphspace. SVG renders natively via a 256-bit DNA seed and Gielis Superformula math—no IPFS needed.<br/><br/>
            <strong className="text-neutral-200">ERC-998 Composable:</strong> The token acts as a smart escrow, owning the underlying LP tokens internally.
          </p>
        </div>

        {/* Tokenomics */}
        <div className="bg-neutral-900/30 border border-neutral-800 p-6 rounded-2xl space-y-4">
          <div className="w-10 h-10 rounded-full bg-amber-950/50 border border-amber-900 flex items-center justify-center text-amber-400 mb-6">
            <Coins className="w-5 h-5" />
          </div>
          <h4 className="font-mono text-lg text-neutral-100">Ecosystem Tokenomics</h4>
          <p className="text-sm text-neutral-400 leading-relaxed">
            <strong className="text-neutral-200">Supply & Minting:</strong> Soulbound IDs are 1:1 per human (Sybil resistant). The ecosystem token ($YPET) has a capped supply.<br/><br/>
            <strong className="text-neutral-200">Utility:</strong> The RSBT grants access to boosted LP yields based on its Vitality score.<br/><br/>
            <strong className="text-neutral-200">Sinks:</strong> Micro-fees on "Feeding" (compounding) burn $YPET. "Training" requires ecosystem tokens to alter acoustic/visual parameters.
          </p>
        </div>

      </div>
    </div>
  );
}
