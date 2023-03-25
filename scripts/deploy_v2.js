const {deploy} = require('./utils');
const {Deployer} = require('./deployer');

async function main() {
  const deployer = new Deployer();
  await deployer.init(process.env.ETHERNALOTTO_OWNER);
  await deployer.deployLotteryImpl({
    drawingLibrary: {address: '0x11495F6ccC540a23c263974D58dB38Ef336508d6'},
    setLibrary: {address: '0x0D2c2c745950D122ae9ab24838D5B8734C9BCbC4'},
    indexLibrary: {address: '0x93b7EFB02D70085BBF2C91a9e3814817B39aE152'},
    ticketLibrary: {address: '0x5B4634C423687E2320bE4641CD3747a60dCf08A7'},
  });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
