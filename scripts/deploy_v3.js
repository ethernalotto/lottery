const {deploy} = require('./utils');
const {Deployer} = require('./deployer');

async function deployLibraries() {
  const setLibrary = await deploy('TicketSet');
  const indexLibrary = await deploy('TicketIndex', [], {TicketSet: setLibrary.address});
  return {setLibrary, indexLibrary};
}

async function main() {
  const deployer = new Deployer();
  await deployer.init(process.env.ETHERNALOTTO_OWNER);
  const {setLibrary, indexLibrary} = await deployLibraries();
  await deployer.deployLotteryImpl({
    drawingLibrary: {address: '0x11495F6ccC540a23c263974D58dB38Ef336508d6'},
    setLibrary: setLibrary,
    indexLibrary: indexLibrary,
    ticketLibrary: {address: '0x5B4634C423687E2320bE4641CD3747a60dCf08A7'},
  });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
