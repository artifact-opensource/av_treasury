import { ethers } from 'ethers';
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');

const govAddr = '0x5F061c177b76753686122185989C2332C1d0e8b1';

// Governor ABI - OpenZeppelin Governor compatible
const govFullAbi = [
  'function proposalCount() view returns (uint256)',
  'function votingDelay() view returns (uint256)',
  'function votingPeriod() view returns (uint256)',
  'function proposalThreshold() view returns (uint256)',
  'function quorum(uint256) view returns (uint256)',
  'function state(uint256) view returns (uint8)',
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function COUNTING_MODE() view returns (string)',
  'function hasVoted(uint256, address) view returns (bool)',
  'function proposals(uint256) view returns (uint256 id, address proposer, uint256 eta, uint256 startBlock, uint256 endBlock, uint256 forVotes, uint256 againstVotes, bool canceled, bool executed)',
  'function getVotes(address, uint256) view returns (uint256)',
];

const c = new ethers.Contract(govAddr, govFullAbi, provider);

// Try each function individually
const fns = ['name', 'version', 'proposalCount', 'votingDelay', 'votingPeriod', 'proposalThreshold', 'COUNTING_MODE'];
for (const fn of fns) {
  try {
    const r = await c[fn]();
    console.log('✅', fn + ':', r.toString());
  } catch(e) {
    console.log('❌', fn + ':', (e.reason || e.message).slice(0, 50));
  }
}

// Try quorum at current block
try {
  const block = await provider.getBlockNumber();
  const q = await c.quorum(block - 1);
  console.log('✅ quorum:', ethers.utils.formatUnits(q, 18));
} catch(e) {
  console.log('❌ quorum:', (e.reason || e.message).slice(0, 50));
}

// Check timelock from governor
try {
  const tl = await c.timelock();
  console.log('✅ timelock:', tl);
} catch(e) {
  console.log('❌ timelock:', (e.reason || e.message).slice(0, 50));
}

// Check token (veAg)
try {
  const token = await c.token();
  console.log('✅ token:', token);
} catch(e) {
  console.log('❌ token:', (e.reason || e.message).slice(0, 50));
}

// Now check PID controller
console.log('\n--- PID Controller ---');
const pidAddr = '0xB8F240870DBc1cD5F9262F8180350A29ea404268';
const pidCode = await provider.getCode(pidAddr);
console.log('Bytecode:', (pidCode.length-2)/2, 'bytes');

// Check TreasuryAMO
console.log('\n--- TreasuryAMO ---');
const treasuryAddr = '0xF096cD4D24811B0F824c929907196bCB796bca88';
const tCode = await provider.getCode(treasuryAddr);
console.log('Bytecode:', (tCode.length-2)/2, 'bytes');
const tBal = await provider.getBalance(treasuryAddr);
console.log('ETH Balance:', ethers.utils.formatEther(tBal));

// Check oracle
console.log('\n--- Oracle ---');
const oracleAddr = '0xfd0451a53834E4DAa9626A24B9Aa640B0d3647CD';
const oCode = await provider.getCode(oracleAddr);
console.log('Bytecode:', (oCode.length-2)/2, 'bytes');
