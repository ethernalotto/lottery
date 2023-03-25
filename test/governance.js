const {ethers, network} = require('hardhat');
const helpers = require('@nomicfoundation/hardhat-network-helpers');
const {expect} = require('chai');
const {Deployer} = require('../scripts/deployer');
const {getDefaultSigner} = require('../scripts/utils');
const {advanceTime, advanceTimeToNextDrawing} = require('./utils');

const {BigNumber} = ethers;


const VRF_KEY_HASH = '0xff8dedfbfa60af186cf3c830acbc32c05aae823045ae5ea7da1e45fbfaba4f92';


const ONE_WEEK = 60 * 60 * 24 * 7;


describe('Governance', () => {
  const deployer = new Deployer();

  let signer;

  let vrfCoordinator;
  const subscriptionId = 1;
  let requestId = 1;

  let snapshot;
  let lottery, controller;

  before(async () => {
    signer = await getDefaultSigner();
    await deployer.init(signer.address);
    vrfCoordinator = await deployer.deployMockVRFCoordinator();
    await vrfCoordinator.createSubscription();
    const deployment = await deployer.deployAll(vrfCoordinator.address);
    lottery = deployment.lottery;
    lottery.connect(signer);
    controller = deployment.controller;
    controller.connect(signer);
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
    await lottery.buyTicket(
        /*referralCode=*/'0x0000000000000000000000000000000000000000000000000000000000000000',
        numbers,
        {value: price});
  };

  const draw = async () => {
    await controller.draw(subscriptionId, VRF_KEY_HASH);
    await vrfCoordinator.fulfillRandomWords(requestId++, lottery.address);
    const round = parseInt(await lottery.currentRound(), 10);
    const [blockNumber, numbers, winners] = await lottery.getDrawData(round);
    console.log('Drawn:', numbers);
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
    await advanceTime(ONE_WEEK);
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
