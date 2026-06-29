import { ethers } from 'ethers';
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');

// DexSimulator - try lowercase then checksum
const dexRaw = '0x2C1bD0E498cEA315dA7486a41FB3DD991DA302B2';
const dexLower = dexRaw.toLowerCase();
const dex = ethers.utils.getAddress(dexLower);
console.log('DexSimulator:', dex);
const dexCode = await provider.getCode(dex);
console.log('Bytecode:', dexCode !== '0x' ? 'YES (' + (dexCode.length-2)/2 + ' bytes)' : 'NONE');

// Governor deep check
const govAddr = '0x5F061c177b76753686122185989C2332C1d0e8b1';
const govCode = await provider.getCode(govAddr);
console.log('\nGovernor bytecode:', (govCode.length-2)/2, 'bytes');

// Check if proxy
const implSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const implAddr = await provider.getStorageAt(govAddr, implSlot);
console.log('Governor impl slot:', implAddr);

// Try Governor functions
const govAbi = ['function proposalCount() view returns (uint256)','function votingDelay() view returns (uint256)','function votingPeriod() view returns (uint256)'];
try {
  const c = new ethers.Contract(govAddr, govAbi, provider);
  const count = await c.proposalCount();
  const vd = await c.votingDelay();
  const vp = await c.votingPeriod();
  console.log('Governor OK | proposals:', count.toString(), '| delay:', vd.toString(), 's | period:', vp.toString(), 's');
} catch(e) {
  console.log('Governor read failed:', e.reason || e.message.slice(0, 80));
}

// Check Au/Ag supply
const erc20 = ['function totalSupply() view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'];
try {
  const au = new ethers.Contract('0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08', erc20, provider);
  const sym = await au.symbol();
  const dec = await au.decimals();
  const supply = await au.totalSupply();
  console.log('\n' + sym + ' totalSupply:', ethers.utils.formatUnits(supply, dec));
} catch(e) { console.log('\nAu read failed'); }

try {
  const ag = new ethers.Contract('0x1D31719389Bd8b17277Ba367c26b830aE34D3674', erc20, provider);
  const sym = await ag.symbol();
  const dec = await ag.decimals();
  const supply = ag.totalSupply();
  console.log(sym + ' totalSupply:', ethers.utils.formatUnits(await supply, dec));
} catch(e) { console.log('Ag read failed'); }

// Recent Au transfers
const currentBlock = await provider.getBlockNumber();
const auIface = new ethers.utils.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const transferTopic = auIface.getEventTopic('Transfer');
const recentLogs = await provider.getLogs({
  address: '0x0c5A9a970b9C9b77A1DDb1cd62F279cE6cDA2f08',
  fromBlock: currentBlock - 10000,
  toBlock: currentBlock,
  topics: [transferTopic]
});
console.log('\nAu transfers (last 10k blocks):', recentLogs.length);
console.log('Latest block:', currentBlock);
