require('dotenv').config();

require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-etherscan');
require('@nomicfoundation/hardhat-chai-matchers');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-gas-reporter');
require('solidity-coverage');

task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.17',
    settings: {
      debug: {
        revertStrings: 'strip',
      },
      optimizer: {
        enabled: true,
        runs: 1000000,
      },
    },
  },
  networks: {
    mainnet: {
      url: 'https://eth.public-rpc.com',
      accounts: process.env.ETHERNALOTTO_DEPLOYER ? [process.env.ETHERNALOTTO_DEPLOYER] : [],
    },
    matic: {
      url: 'https://polygon-rpc.com',
      accounts: process.env.ETHERNALOTTO_DEPLOYER ? [process.env.ETHERNALOTTO_DEPLOYER] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
  etherscan: {
    apiKey: process.env.HARDHAT_ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 0,
  },
};
