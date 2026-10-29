import fhevmPlugin from '@fhevm/hardhat-plugin-v3';
import hardhatToolboxMochaEthers from '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import { defineConfig } from 'hardhat/config';
export default defineConfig({
  plugins: [hardhatToolboxMochaEthers, fhevmPlugin],
  solidity: { version: '0.8.27', settings: { evmVersion: 'cancun' } },
});
