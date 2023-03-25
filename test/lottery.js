const {ethers} = require('hardhat');
const helpers = require('@nomicfoundation/hardhat-network-helpers');
const {expect} = require('chai');
const {Deployer} = require('../scripts/deployer');
const {advanceTime, advanceTimeToNextDrawing} = require('./utils');

const {BigNumber} = ethers;


const VRF_KEY_HASH = '0xff8dedfbfa60af186cf3c830acbc32c05aae823045ae5ea7da1e45fbfaba4f92';

const NULL_REFERRAL_CODE = '0x0000000000000000000000000000000000000000000000000000000000000000';


const ONE_HOUR = 60 * 60;
const FOUR_HOURS = 60 * 60 * 4;
const THREE_DAYS = 60 * 60 * 24 * 3;
const FOUR_DAYS = 60 * 60 * 24 * 4;
const ONE_WEEK = 60 * 60 * 24 * 7;


function range(length, offset = 0) {
  return Array.from({length}, (_, i) => offset + i);
}


describe('Lottery', () => {
  const deployer = new Deployer();

  let signer;

  let vrfCoordinator;
  const subscriptionId = 1;
  let requestId = 1;

  let snapshot;
  let lottery;

  const getLotteryBalance = async () => await lottery.provider.getBalance(lottery.address);

  before(async () => {
    await deployer.init();
    vrfCoordinator = await deployer.deployMockVRFCoordinator();
    await vrfCoordinator.createSubscription();
    const signers = await ethers.getSigners();
    signer = await signers[0].getAddress();
    lottery = (await deployer.deployLottery(vrfCoordinator.address)).lottery;
    await vrfCoordinator.addConsumer(subscriptionId, lottery.address);
  });

  beforeEach(async () => {
    snapshot = await helpers.takeSnapshot();
    await advanceTimeToNextDrawing();
  });

  afterEach(async () => {
    await snapshot.restore();
    requestId = 1;
  });

  const buyTicket = async numbers => {
    const price = await lottery.getTicketPrice(numbers);
    await lottery.buyTicket(NULL_REFERRAL_CODE, numbers, {value: price});
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
    const result = await lottery.getTicketIdsForRound(signer, round);
    expect(result).to.eql(ids.map(id => BigNumber.from(id)));
  };

  const checkTicket = async (round, id, numbers) => {
    numbers.sort((a, b) => a - b);
    expect(await lottery.getTicket(id)).to.have.deep.members(
        [signer, BigNumber.from(round), , numbers]);
  };

  const drawRandom = async () => {
    await lottery.draw(subscriptionId, VRF_KEY_HASH);
    await vrfCoordinator.fulfillRandomWords(requestId++, lottery.address);
    const round = parseInt(await lottery.currentRound(), 10);
    const [blockNumber, numbers, winners] = await lottery.getDrawData(round);
    console.log('Drawn:', numbers);
    await lottery.findWinners();
    await lottery.closeRound();
  };

  const draw123456 = async () => {
    await lottery.draw(subscriptionId, VRF_KEY_HASH);
    await vrfCoordinator.fulfillRandomWordsWithOverride(requestId++, lottery.address, [0]);
    const round = parseInt(await lottery.currentRound(), 10);
    const [blockNumber, numbers, winners] = await lottery.getDrawData(round);
    console.log('Drawn:', numbers);
    await lottery.findWinners();
    await lottery.closeRound();
  };

  it('next draw time', async () => {
    const nextDrawTime = new Date(1000 * await lottery.nextDrawTime());
    expect(nextDrawTime.getUTCDay()).to.equal(6);
    expect(nextDrawTime.getUTCHours()).to.equal(20);
    expect(nextDrawTime.getUTCMinutes()).to.equal(0);
    expect(nextDrawTime.getUTCSeconds()).to.equal(0);
  });

  it('can draw', async () => {
    // must always succeed thanks to the advanceTimeToNextDrawing() call in the fixture
    expect(await lottery.canDraw()).to.equal(true);
  });

  it('cannot draw', async () => {
    await advanceTime(60 * 60 * 24);
    expect(await lottery.canDraw()).to.equal(false);
  });

  it('drawing window width', async () => {
    await advanceTime(ONE_HOUR);
    expect(await lottery.canDraw()).to.equal(true);
    await advanceTime(ONE_HOUR);
    expect(await lottery.canDraw()).to.equal(true);
    await advanceTime(ONE_HOUR);
    expect(await lottery.canDraw()).to.equal(true);
    await advanceTime(ONE_HOUR - 1);
    expect(await lottery.canDraw()).to.equal(true);
    await advanceTime(1);
    expect(await lottery.canDraw()).to.equal(false);
  });

  it('next drawing window', async () => {
    await advanceTime(ONE_WEEK - 1);
    expect(await lottery.canDraw()).to.equal(false);
    await advanceTime(1);
    expect(await lottery.canDraw()).to.equal(true);
    await advanceTime(FOUR_HOURS - 1);
    expect(await lottery.canDraw()).to.equal(true);
    await advanceTime(1);
    expect(await lottery.canDraw()).to.equal(false);
  });

  it('zero tickets', async () => {
    expect(await lottery.getTicketIds(signer)).to.eql([]);
    expect(await lottery.getTicketIdsForRound(signer, 0)).to.eql([]);
    await drawRandom();
  });

  it('only one draw per window', async () => {
    await drawRandom();
    await advanceTime(ONE_HOUR);
    await expect(lottery.draw(subscriptionId, VRF_KEY_HASH)).to.be.reverted;
  });

  it('one ticket', async () => {
    await buyTicket([1, 2, 3, 4, 5, 6]);
    expect(await lottery.getTicketIds(signer)).to.eql([BigNumber.from(0)]);
    expect(await lottery.getTicket(0)).to.have.deep.members(
        [signer, BigNumber.from(0), , [1, 2, 3, 4, 5, 6]]);
    expect(await lottery.canDraw()).to.equal(true);
    await drawRandom();
  });

  it('sells tickets again after draw', async () => {
    await advanceTime(ONE_HOUR);
    await buyTicket([1, 2, 3, 4, 5, 6]);
    await drawRandom();
    await buyTicket([1, 2, 3, 4, 5, 6]);
    expect(await lottery.getTicketIdsForRound(signer, 1)).to.eql([BigNumber.from(1)]);
    expect(await lottery.getTicket(1)).to.have.deep.members(
        [signer, BigNumber.from(1), , [1, 2, 3, 4, 5, 6]]);
  });

  it('two tickets', async () => {
    const ticket1 = [1, 2, 3, 4, 5, 6, 7, 8];
    await buyTicket(ticket1);
    const ticket2 = [7, 8, 9, 10, 11, 12, 13];
    await buyTicket(ticket2);
    expect(await lottery.getTicketIds(signer)).to.eql([
      BigNumber.from(0),
      BigNumber.from(1),
    ]);
    expect(await lottery.getTicket(0)).to.have.deep.members([signer, BigNumber.from(0), , ticket1]);
    expect(await lottery.getTicket(1)).to.have.deep.members([signer, BigNumber.from(0), , ticket2]);
    await drawRandom();
  });

  it('next round', async () => {
    const ticket1 = [1, 2, 3, 4, 5, 6, 7, 8];
    await buyTicket(ticket1);
    await drawRandom();
    await advanceTime(THREE_DAYS);
    const ticket2 = [7, 8, 9, 10, 11, 12, 13];
    await buyTicket(ticket2);
    expect(await lottery.getTicketIdsForRound(signer, 0)).to.eql([BigNumber.from(0)]);
    expect(await lottery.getTicket(0)).to.have.deep.members([signer, BigNumber.from(0), , ticket1]);
    expect(await lottery.getTicketIdsForRound(signer, 1)).to.eql([BigNumber.from(1)]);
    expect(await lottery.getTicket(1)).to.have.deep.members([signer, BigNumber.from(1), , ticket2]);
    await advanceTime(FOUR_DAYS);
    await drawRandom();
  });

  it('1 ticket 0 matches', async () => {
    await buyTicket([10, 11, 12, 13, 14, 15]);
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(0);
  });

  it('1 ticket 1 match', async () => {
    await buyTicket([1, 11, 12, 13, 14, 15]);
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(0);
  });

  it('1 ticket 2 matches', async () => {
    await buyTicket([1, 2, 12, 13, 14, 15]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[BigNumber.from(0)], [], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it('1 ticket 3 matches', async () => {
    await buyTicket([1, 2, 3, 13, 14, 15]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [BigNumber.from(0)], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it('1 ticket 4 matches', async () => {
    await buyTicket([1, 2, 3, 4, 14, 15]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [BigNumber.from(0)], [], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it('1 ticket 5 matches', async () => {
    await buyTicket([1, 2, 3, 4, 5, 15]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [], [BigNumber.from(0)], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it('1 ticket 6 matches', async () => {
    await buyTicket([1, 2, 3, 4, 5, 6]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [], [], [BigNumber.from(0)]]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it(`2 tickets, 0 and 0 matches`, async () => {
    await buyTicket([11, 12, 13, 14, 15, 16]);
    await buyTicket([21, 22, 23, 24, 25, 26]);
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(0);
  });

  it(`2 tickets, 0 and 1 matches`, async () => {
    await buyTicket([11, 12, 13, 14, 15, 16]);
    await buyTicket([1, 22, 23, 24, 25, 26]);
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(0);
  });

  it(`2 tickets, 0 and 2 matches`, async () => {
    await buyTicket([11, 12, 13, 14, 15, 16]);
    await buyTicket([1, 2, 23, 24, 25, 26]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[BigNumber.from(1)], [], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it(`2 tickets, 0 and 3 matches`, async () => {
    await buyTicket([11, 12, 13, 14, 15, 16]);
    await buyTicket([1, 2, 3, 24, 25, 26]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [BigNumber.from(1)], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it(`2 tickets, 0 and 4 matches`, async () => {
    await buyTicket([11, 12, 13, 14, 15, 16]);
    await buyTicket([1, 2, 3, 4, 25, 26]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [BigNumber.from(1)], [], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it(`2 tickets, 0 and 5 matches`, async () => {
    await buyTicket([11, 12, 13, 14, 15, 16]);
    await buyTicket([1, 2, 3, 4, 5, 26]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [], [BigNumber.from(1)], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it(`2 tickets, 0 and 6 matches`, async () => {
    await buyTicket([11, 12, 13, 14, 15, 16]);
    await buyTicket([1, 2, 3, 4, 5, 6]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [], [], [BigNumber.from(1)]]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it(`2 tickets, 1 and 0 matches`, async () => {
    await buyTicket([1, 12, 13, 14, 15, 16]);
    await buyTicket([21, 22, 23, 24, 25, 26]);
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(0);
  });

  it(`2 tickets, 1 and 1 matches`, async () => {
    await buyTicket([1, 12, 13, 14, 15, 16]);
    await buyTicket([1, 22, 23, 24, 25, 26]);
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(0);
  });

  it(`2 tickets, 1 and 2 matches`, async () => {
    await buyTicket([1, 12, 13, 14, 15, 16]);
    await buyTicket([1, 2, 23, 24, 25, 26]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[BigNumber.from(1)], [], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it(`2 tickets, 1 and 3 matches`, async () => {
    await buyTicket([1, 12, 13, 14, 15, 16]);
    await buyTicket([1, 2, 3, 24, 25, 26]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [BigNumber.from(1)], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it(`2 tickets, 1 and 4 matches`, async () => {
    await buyTicket([1, 12, 13, 14, 15, 16]);
    await buyTicket([1, 2, 3, 4, 25, 26]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [BigNumber.from(1)], [], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it(`2 tickets, 1 and 5 matches`, async () => {
    await buyTicket([1, 12, 13, 14, 15, 16]);
    await buyTicket([1, 2, 3, 4, 5, 26]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [], [BigNumber.from(1)], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it(`2 tickets, 1 and 6 matches`, async () => {
    await buyTicket([1, 12, 13, 14, 15, 16]);
    await buyTicket([1, 2, 3, 4, 5, 6]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[], [], [], [], [BigNumber.from(1)]]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it(`2 tickets, 2 and 0 matches`, async () => {
    await buyTicket([1, 2, 13, 14, 15, 16]);
    await buyTicket([21, 22, 23, 24, 25, 26]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[BigNumber.from(0)], [], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it(`2 tickets, 2 and 1 matches`, async () => {
    await buyTicket([1, 2, 13, 14, 15, 16]);
    await buyTicket([1, 22, 23, 24, 25, 26]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[BigNumber.from(0)], [], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it(`2 tickets, 2 and 2 matches`, async () => {
    await buyTicket([1, 2, 13, 14, 15, 16]);
    await buyTicket([1, 2, 23, 24, 25, 26]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[BigNumber.from(0), BigNumber.from(1)], [], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 18n / 100n);
  });

  it(`2 tickets, 2 and 3 matches`, async () => {
    await buyTicket([1, 2, 13, 14, 15, 16]);
    await buyTicket([1, 2, 3, 24, 25, 26]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[BigNumber.from(0)], [BigNumber.from(1)], [], [], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 36n / 100n);
  });

  it(`2 tickets, 2 and 4 matches`, async () => {
    await buyTicket([1, 2, 13, 14, 15, 16]);
    await buyTicket([1, 2, 3, 4, 25, 26]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[BigNumber.from(0)], [], [BigNumber.from(1)], [], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 36n / 100n);
  });

  it(`2 tickets, 2 and 5 matches`, async () => {
    await buyTicket([1, 2, 13, 14, 15, 16]);
    await buyTicket([1, 2, 3, 4, 5, 26]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[BigNumber.from(0)], [], [], [BigNumber.from(1)], []]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 36n / 100n);
  });

  it(`2 tickets, 2 and 6 matches`, async () => {
    await buyTicket([1, 2, 13, 14, 15, 16]);
    await buyTicket([1, 2, 3, 4, 5, 6]);
    const jackpot = BigInt(await getLotteryBalance());
    await draw123456();
    const [, , winners] = await lottery.getDrawData(0);
    expect(winners).to.eql([[BigNumber.from(0)], [], [], [], [BigNumber.from(1)]]);
    expect(await lottery.payments(signer)).to.equal(jackpot * 36n / 100n);
  });

  it('claim referral code', async () => {
    const bytes = Array.from({length: 32}, () => Math.floor(Math.random() * 256));
    const code = ethers.utils.hexlify(bytes);
    await lottery.claimReferralCode(code, signer);
    expect(await lottery.partnersByReferralCode(code)).to.equal(signer);
    expect(await lottery.referralCodesByPartner(signer, 0)).to.equal(code);
    expect(lottery.referralCodesByPartner(signer, 1)).to.be.reverted;
  });

  it('claim two referral codes', async () => {
    const bytes1 = Array.from({length: 32}, () => Math.floor(Math.random() * 256));
    const code1 = ethers.utils.hexlify(bytes1);
    const bytes2 = Array.from({length: 32}, () => Math.floor(Math.random() * 256));
    const code2 = ethers.utils.hexlify(bytes2);
    await lottery.claimReferralCode(code1, signer);
    await lottery.claimReferralCode(code2, signer);
    expect(await lottery.partnersByReferralCode(code1)).to.equal(signer);
    expect(await lottery.partnersByReferralCode(code2)).to.equal(signer);
    expect(await lottery.referralCodesByPartner(signer, 0)).to.equal(code1);
    expect(await lottery.referralCodesByPartner(signer, 1)).to.equal(code2);
    expect(lottery.referralCodesByPartner(signer, 2)).to.be.reverted;
  });

  it('ticket with referral code', async () => {
    const bytes = Array.from({length: 32}, () => Math.floor(Math.random() * 256));
    const code = ethers.utils.hexlify(bytes);
    await lottery.claimReferralCode(code, signer);
    const balance0 = (await lottery.provider.getBalance(signer)).toBigInt();
    const numbers = [1, 2, 3, 4, 5, 6];
    const price = (await lottery.getTicketPrice(numbers)).toBigInt();
    await lottery.buyTicket(code, numbers, {value: price});
    const balance1 = (await lottery.provider.getBalance(signer)).toBigInt();
    expect(balance1).to.be.above(balance0 - price + price / 10n);
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
    await drawRandom();
  });

  it('two rounds', async () => {
    for (let i = 0; i < 5; i++) {
      await buyRandomTicket();
    }
    await drawRandom();
    await advanceTime(THREE_DAYS);
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
    await advanceTime(FOUR_DAYS);
    await drawRandom();
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
    await drawRandom();
  });

  it ('stress test', async () => {
    for (let i = 0; i < 100; i++) {
      await buyRandomTicket();
    }
    await drawRandom();
    await advanceTime(THREE_DAYS);
    for (let i = 0; i < 100; i++) {
      await buyRandomTicket();
    }
    await advanceTime(FOUR_DAYS);
    await drawRandom();
  });
});
