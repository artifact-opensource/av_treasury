import { ethers } from 'ethers';
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');

const contracts = [
  ['Au Token (Proxy)',      '0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08'],
  ['Au Token (Impl)',       '0x4682C375969DBb1CDcbA1Eaedab7FC288c8fBb61'],
  ['Ag Token (Proxy)',      '0x1D31719389Bd8b17277Ba367c26b830aE34D3674'],
  ['Ag Token (Impl)',       '0xBFD228862E407775D5911FD1a0fEF6bAb49534Da'],
  ['TreasuryAMO',           '0xF096cD4D24811B0F824c929907196bCB796bca88'],
  ['PID_Emission_Ctrl',     '0xB8F240870DBc1cD5F9262F8180350A29ea404268'],
  ['AVLPStaking (Proxy)',   '0x8F638B6C2EBD61A638561B6993930CF25D53ACB9'],
  ['AVLPStaking (Impl)',    '0xE699960b6e81d00A42F8580004C8FBD72902806A'],
  ['Governor',              '0x5F061c177b76753686122185989C2332C1d0e8b1'],
  ['Timelock',              '0x09058FdD4dD60b4E2F2C2F4c370DA3cB606c09Be'],
  ['AvOracle (v5)',         '0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD'],
  ['OracleWrapper',         '0xb479760Dfd9Ba90cF670BBB1647a4B06B2032bdB'],
  ['OracleFlashBuy',        '0xDfD00984CC88728e830CEDe7e104b6b0C03EDDcc'],
  ['TreasuryFlashBuy_v2',   '0xf6383860837E6cb983F9Af8Def92fc08F15Be65b'],
  ['FlashLoan',             '0x4Ddd1873964E5C2e3bE6712E199812903E6696b9'],
  ['DexSimulator',          '0x2C1bD0e498cEA315dA7486a41FB3DD991DA302B2'],
  ['QuasiCrystalLPNFT',     '0x7797cb8407eF95f6714b4719D3B394aab2e26Ea8'],
  ['QuasiCrystalSVG',       '0xe23F177d09C1C5388104f0369aE91Cc4eA34E528'],
  ['OnChainBase64',         '0x44D47F74728E3e7F8661bcC49524D9702778295C'],
  ['Treasury Safe',         '0x1082C9467488F869Aa64fcb0Dc78CD9BC6319F9e'],
];

const erc20Abi = ['function symbol() view returns (string)', 'function name() view returns (string)', 'function totalSupply() view returns (uint256)', 'function decimals() view returns (uint8)'];
const govAbi = ['function name() view returns (string)', 'function proposalCount() view returns (uint256)', 'function votingDelay() view returns (uint256)', 'function votingPeriod() view returns (uint256)', 'function proposalThreshold() view returns (uint256)', 'function quorum(uint256) view returns (uint256)', 'function timelock() view returns (address)', 'function token() view returns (address)'];
const timelockAbi = ['function getMinDelay() view returns (uint256)', 'function MAX_DELAY() view returns (uint256)'];

let pass = 0, fail = 0;

for (const [name, addr] of contracts) {
  try {
    const code = await provider.getCode(addr);
    const hasCode = code !== '0x';
    const byteSize = (code.length - 2) / 2;
    const balance = await provider.getBalance(addr);
    const ethBal = parseFloat(ethers.utils.formatEther(balance)).toFixed(4);

    let extra = '';

    if (name.includes('Token') && hasCode) {
      try {
        const c = new ethers.Contract(addr, erc20Abi, provider);
        const sym = await c.symbol();
        const dec = await c.decimals();
        const supply = await c.totalSupply();
        const formatted = ethers.utils.formatUnits(supply, dec);
        extra = ` [${sym}, ${dec}dec, supply: ${formatted}]`;
      } catch(e) { extra = ' [ERC20 read failed]'; }
    }

    if (name === 'Governor' && hasCode) {
      try {
        const c = new ethers.Contract(addr, govAbi, provider);
        const n = await c.name();
        const pc = await c.proposalCount();
        const vd = await c.votingDelay();
        const vp = await c.votingPeriod();
        const pt = await c.proposalThreshold();
        const tl = await c.timelock();
        extra = ` [${n}, proposals:${pc}, delay:${vd}s, period:${vp}s, threshold:${pt}, timelock:${tl}]`;
      } catch(e) { extra = ' [Governor read failed: ' + (e.reason || e.message).slice(0,40) + ']'; }
    }

    if (name === 'Timelock' && hasCode) {
      try {
        const c = new ethers.Contract(addr, timelockAbi, provider);
        const minD = await c.getMinDelay();
        const maxD = await c.MAX_DELAY();
        extra = ` [minDelay:${minD}s (${(minD/3600).toFixed(0)}h), maxDelay:${maxD}s (${(maxD/86400).toFixed(0)}d)]`;
      } catch(e) { extra = ' [Timelock read failed]'; }
    }

    console.log((hasCode ? '✅' : '❌') + ' ' + name + extra);
    console.log('   ' + addr + ' | ' + (hasCode ? (byteSize + ' bytes') : 'NO BYTECODE') + ' | ETH: ' + ethBal);
    if (hasCode) pass++; else fail++;
  } catch(e) {
    console.log('❌ ' + name + ' ' + addr + ' | ERROR: ' + e.message);
    fail++;
  }
}

// Recent activity
const currentBlock = await provider.getBlockNumber();
const auIface = new ethers.utils.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const transferTopic = auIface.getEventTopic('Transfer');

let auTransfers = 0;
try {
  const logs = await provider.getLogs({
    address: '0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08',
    fromBlock: currentBlock - 10000,
    toBlock: currentBlock,
    topics: [transferTopic]
  });
  auTransfers = logs.length;
} catch(e) {}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('INTEGRITY: ' + pass + '/' + (pass+fail) + ' contracts deployed on-chain');
console.log('Au transfers (last 10k blocks): ' + auTransfers);
console.log('Base Mainnet Block: ' + currentBlock);
console.log('RPC: OK');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
