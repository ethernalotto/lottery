const {ethers, network} = require('hardhat');
const {expect} = require('chai');
const {Deployer} = require('../scripts/deployer');
const {getDefaultSigner} = require('../scripts/utils');

const {BigNumber} = ethers;


const VRF_KEY_HASH = '0xcc294a196eeeb44da2888d17c0625cc88d70d9760a69d58d853ba6581a9ab0cd';


describe('Lottery', () => {
  const deployer = new Deployer();

  let signer;

  let vrfCoordinator;
  let requestId = 1;

  let lottery, controller;

  before(async () => {
    signer = await getDefaultSigner();
    await deployer.init(signer.address);
    vrfCoordinator = await deployer.deployMockVRFCoordinator();
    await vrfCoordinator.createSubscription();
  });

  beforeEach(async () => {
    const deployment = await deployer.deployAll(vrfCoordinator.address);
    lottery = deployment.lottery;
    lottery.connect(signer);
    controller = deployment.controller;
    controller.connect(signer);
  });

  const buyTicket = async numbers => {
    const price = await lottery.getTicketPrice(numbers);
    await lottery.buyTicket(numbers, {value: price});
  };

  const advanceTime = async seconds => {
    await network.provider.send('evm_increaseTime', [seconds]);
  };

  const draw = async () => {
    await advanceTime(60 * 60 * 24 * 7);
    await controller.draw(1, VRF_KEY_HASH, 300000);
    await vrfCoordinator.fulfillRandomWords(requestId++, lottery.address);
    const round = parseInt(await lottery.currentRound(), 10);
    console.log('Drawn:', await lottery.getDrawnNumbers(round));
    await controller.findWinners();
    await controller.closeRound();
  };

  it('pause', async () => {
    expect(await lottery.paused()).to.equal(false);
    expect(await controller.paused()).to.equal(false);
    await controller.pause();
    expect(await lottery.paused()).to.equal(true);
    expect(await controller.paused()).to.equal(true);
    await controller.unpause();
    expect(await lottery.paused()).to.equal(false);
    expect(await controller.paused()).to.equal(false);
  });

  it('initial revenue', async () => {
    const unclaimed = await controller.getUnclaimedRevenue(signer.address);
    expect(unclaimed.isZero()).to.equal(true);
  });

  it('revenue', async () => {
    await buyTicket([4, 5, 6, 7, 8, 9]);
    await draw();
    const balance = await controller.provider.getBalance(controller.address);
    expect(balance.isZero()).to.equal(false);
    const unclaimed = await controller.getUnclaimedRevenue(signer.address);
    expect(balance.eq(unclaimed)).to.equal(true);
  });

  it('revenue growth', async () => {
    await buyTicket([1, 2, 3, 4, 5, 6]);
    await draw();
    const unclaimed1 = await controller.getUnclaimedRevenue(signer.address);
    await buyTicket([4, 5, 6, 7, 8, 9]);
    await draw();
    const unclaimed2 = await controller.getUnclaimedRevenue(signer.address);
    expect(unclaimed2.gt(unclaimed1)).to.equal(true);
    const balance = await controller.provider.getBalance(controller.address);
    expect(balance.eq(unclaimed2)).to.equal(true);
  });

  it('withdrawal', async () => {
    await buyTicket([1, 2, 3, 4, 5, 6]);
    await buyTicket([4, 5, 6, 7, 8, 9]);
    await draw();
    const unclaimed1 = await controller.getUnclaimedRevenue(signer.address);
    await controller.withdraw(signer.address);
    const unclaimed2 = await controller.getUnclaimedRevenue(signer.address);
    expect(unclaimed2.isZero()).to.equal(true);
  });
});
