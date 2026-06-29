import { ethers } from 'ethers';
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');

const govAddr = '0x5F061c177b76753686122185989C2332C1d0e8b1';

// Try individual selectors to find what works
const selectors = [
  ['name()', '0x06fdde03'],
  ['version()', '0x54fd4d50'],
  ['proposalCount()', '0xda35c664'],
  ['votingDelay()', '0x3932abb1'],
  ['votingPeriod()', '0x02a251a3'],
  ['proposalThreshold()', '0xb58131b0'],
  ['quorum(uint256)', '0xf8ce560a'],
  ['timelock()', '0xd33219b4'],
  ['token()', '0xfc0c546a'],
  ['COUNTING_MODE()', '0xdd4e2ba5'],
  ['state(uint256)', '0x3e4f49e6'],
];

for (const [fn, selector] of selectors) {
  try {
    const tx = { to: govAddr, data: selector };
    const result = await provider.call(tx);
    if (result === '0x') {
      console.log('� ' + fn + ': empty (0x)');
    } else if (result.length === 66) {
      // Could be uint256 or address
      const asNum = ethers.BigNumber.from(result).toString();
      const asAddr = '0x' + result.slice(26);
      if (asNum.length < 40) {
        console.log('✅ ' + fn + ': ' + asNum);
      } else {
        console.log('✅ ' + fn + ': ' + result);
      }
    } else if (result.length === 130) {
      // String offset + length pattern
      const len = ethers.BigNumber.from('0x' + result.slice(66, 130)).toNumber();
      if (len > 0 && len < 200) {
        const hexStr = result.slice(130, 130 + len * 2);
        const str = Buffer.from(hexStr, 'hex').toString('utf8');
        console.log('✅ ' + fn + ': "' + str + '"');
      } else {
        console.log('✅ ' + fn + ': (offset=' + len + ')');
      }
    } else {
      console.log('✅ ' + fn + ': ' + result);
    }
  } catch(e) {
    console.log('❌ ' + fn + ': ' + (e.reason || e.message).slice(0, 60));
  }
}
