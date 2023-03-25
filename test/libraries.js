const {ethers} = require('hardhat');
const {Deployer} = require('../scripts/deployer');


describe('Libraries', () => {
  const deployer = new Deployer();

  let setLibrary, indexLibrary;

  before(async () => {
    await deployer.init();
  });

  beforeEach(async () => {
    const libraries = await deployer.deployLibraries();
    setLibrary = libraries.setLibrary;
    indexLibrary = libraries.indexLibrary;
  });

  it('TicketSet', async () => {
    const TicketSetTest = await ethers.getContractFactory('TicketSetTest', {
      libraries: {
        TicketSet: setLibrary.address,
      },
    });
    testSuite = await TicketSetTest.deploy();
    await testSuite.deployed();
    await testSuite.testAll();
  });

  it('TicketIndex1', async () => {
    const TicketIndexTest = await ethers.getContractFactory('TicketIndexTest', {
      libraries: {
        TicketIndex: indexLibrary.address,
      },
    });
    testSuite = await TicketIndexTest.deploy();
    await testSuite.deployed();
    await testSuite.testAll();
  });

  it('TicketIndex2', async () => {
    const TicketIndexTest = await ethers.getContractFactory('TicketIndexTest', {
      libraries: {
        TicketIndex: indexLibrary.address,
      },
    });
    testSuite = await TicketIndexTest.deploy();
    await testSuite.deployed();
    await testSuite.testRandomTickets(20);
  });
});
