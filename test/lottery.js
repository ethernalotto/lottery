const {ethers} = require('hardhat');
const {expect} = require('chai');
const {Deployer} = require('../scripts/deployer');

const {BigNumber} = ethers;


const VRF_KEY_HASH = '0xcc294a196eeeb44da2888d17c0625cc88d70d9760a69d58d853ba6581a9ab0cd';


function range(length, offset = 0) {
  return Array.from({length}, (_, i) => offset + i);
}


describe('Lottery', () => {
  const deployer = new Deployer();

  let signer;

  let vrfCoordinator;
  let requestId = 1;

  let lottery;

  before(async () => {
    await deployer.init();
    vrfCoordinator = await deployer.deployMockVRFCoordinator();
    await vrfCoordinator.createSubscription();
    const signers = await ethers.getSigners();
    signer = await signers[0].getAddress();
  });

  beforeEach(async () => {
    lottery = (await deployer.deployLottery(vrfCoordinator.address)).lottery;
  });

  const buyTicket = async numbers => {
    const price = await lottery.getTicketPrice(numbers);
    await lottery.buyTicket(numbers, {value: price});
  };

  const buyRandomTicket = async () => {
    const numbers = range(90, 1);
    const count = Math.floor(Math.random() * 3) + 6;
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(Math.random() * (numbers.length - 1 - i));
      [numbers[j], numbers[i]] = [numbers[i], numbers[j]];
    }
    numbers.length = count;
    console.log(`buying [${numbers.join(', ')}]`);
    await buyTicket(numbers);
    return numbers;
  };

  const checkTicketIds = async (round, ids) => {
    expect(await lottery.getTickets(signer, round)).to.eql(ids.map(id => BigNumber.from(id)));
  };

  const checkTicket = async (round, id, numbers) => {
    numbers.sort((a, b) => a - b);
    expect(await lottery.getTicket(round, id)).to.have.deep.members([signer, , numbers]);
  };

  const draw = async () => {
    await lottery.draw(1, VRF_KEY_HASH, 300000);
    await vrfCoordinator.fulfillRandomWords(requestId++, lottery.address);
    const round = parseInt(await lottery.currentRound(), 10);
    console.log('Drawn:', await lottery.getDrawnNumbers(round));
    await lottery.findWinners();
    await lottery.closeRound();
  };

  it('zero tickets', async () => {
    expect(await lottery.getTickets(signer, 0)).to.eql([]);
    await draw();
  });

  it('one ticket', async () => {
    await buyTicket([1, 2, 3, 4, 5, 6]);
    expect(await lottery.getTickets(signer, 0)).to.eql([BigNumber.from(0)]);
    expect(await lottery.getTicket(0, 0)).to.have.deep.members([signer, , [1, 2, 3, 4, 5, 6]]);
    await draw();
  });

  it('two tickets', async () => {
    const ticket1 = [1, 2, 3, 4, 5, 6, 7, 8];
    await buyTicket(ticket1);
    const ticket2 = [7, 8, 9, 10, 11, 12, 13];
    await buyTicket(ticket2);
    expect(await lottery.getTickets(signer, 0)).to.eql([
      BigNumber.from(0),
      BigNumber.from(1),
    ]);
    expect(await lottery.getTicket(0, 0)).to.have.deep.members([signer, , ticket1]);
    expect(await lottery.getTicket(0, 1)).to.have.deep.members([signer, , ticket2]);
    await draw();
  });

  it('next round', async () => {
    const ticket1 = [1, 2, 3, 4, 5, 6, 7, 8];
    await buyTicket(ticket1);
    await draw();
    const ticket2 = [7, 8, 9, 10, 11, 12, 13];
    await buyTicket(ticket2);
    expect(await lottery.getTickets(signer, 0)).to.eql([BigNumber.from(0)]);
    expect(await lottery.getTicket(0, 0)).to.have.deep.members([signer, , ticket1]);
    expect(await lottery.getTickets(signer, 1)).to.eql([BigNumber.from(1)]);
    expect(await lottery.getTicket(1, 1)).to.have.deep.members([signer, , ticket2]);
    await draw();
  });

  it('random round', async () => {
    const tickets = [];
    for (let i = 0; i < 5; i++) {
      tickets.push(await buyRandomTicket());
    }
    await checkTicketIds(0, [0, 1, 2, 3, 4]);
    await checkTicket(0, 0, tickets[0]);
    await checkTicket(0, 1, tickets[1]);
    await checkTicket(0, 2, tickets[2]);
    await checkTicket(0, 3, tickets[3]);
    await checkTicket(0, 4, tickets[4]);
    await draw();
  });

  it('two rounds', async () => {
    for (let i = 0; i < 5; i++) {
      await buyRandomTicket();
    }
    await draw();
    const tickets = [];
    for (let i = 0; i < 5; i++) {
      tickets.push(await buyRandomTicket());
    }
    await checkTicketIds(1, [5, 6, 7, 8, 9]);
    await checkTicket(1, 5, tickets[0]);
    await checkTicket(1, 6, tickets[1]);
    await checkTicket(1, 7, tickets[2]);
    await checkTicket(1, 8, tickets[3]);
    await checkTicket(1, 9, tickets[4]);
    await draw();
  });

  it('all numbers', async () => {
    for (let i = 0; i < 90; i++) {
      await buyTicket([
        (i + 0) % 90 + 1,
        (i + 1) % 90 + 1,
        (i + 2) % 90 + 1,
        (i + 3) % 90 + 1,
        (i + 4) % 90 + 1,
        (i + 5) % 90 + 1,
      ]);
    }
    await draw();
  });

  it ('stress test', async () => {
    for (let i = 0; i < 100; i++) {
      await buyRandomTicket();
    }
    await draw();
    for (let i = 0; i < 100; i++) {
      await buyRandomTicket();
    }
    await draw();
  });
});
