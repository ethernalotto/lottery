const path = require('path');
const express = require('express');

const {ethers, network} = require('hardhat');
const helpers = require('@nomicfoundation/hardhat-network-helpers');

const {Deployer} = require('./deployer');
const {advanceTimeToNextDrawing, range} = require('../test/utils');


const VRF_KEY_HASH = '0xff8dedfbfa60af186cf3c830acbc32c05aae823045ae5ea7da1e45fbfaba4f92';
const NULL_REFERRAL_CODE = '0x0000000000000000000000000000000000000000000000000000000000000000';

const NUM_TICKETS = 500;


function random6() {
  const numbers = range(90, 1);
  for (let i = 0; i < 6; i++) {
    const j = i + Math.floor(Math.random() * (numbers.length - 1 - i));
    [numbers[j], numbers[i]] = [numbers[i], numbers[j]];
  }
  numbers.length = 6;
  return numbers;
}


async function main() {
  const app = express();

  console.log('initializing...');

  const deployer = new Deployer();
  await deployer.init();

  const account = await deployer.getDefaultSigner();
  helpers.setBalance(account, 10n ** 27n);

  const vrfCoordinator = await deployer.deployMockVRFCoordinator();
  await vrfCoordinator.createSubscription();
  const subscriptionId = 1;

  const {lottery} = await deployer.deployLottery(vrfCoordinator.address);
  await vrfCoordinator.addConsumer(subscriptionId, lottery.address);

  let ticketId = 0;

  const buyTicket = async () => {
    const numbers = random6();
    console.log(ticketId++, '-', numbers);
    const price = await lottery.getTicketPrice(numbers);
    await lottery.buyTicket(NULL_REFERRAL_CODE, numbers, {
      from: account,
      value: price,
    });
  };

  let requestId = 1;

  const draw = async () => {
    await advanceTimeToNextDrawing();
    await lottery.draw(subscriptionId, VRF_KEY_HASH);
    await vrfCoordinator.fulfillRandomWordsWithOverride(requestId++, lottery.address, [0]);
    const round = parseInt(await lottery.currentRound(), 10);
    await lottery.findWinners();
    await lottery.closeRound();
    const [blockNumber, numbers, winners] = await lottery.getDrawData(round);
    console.log('Drawn:', numbers);
    console.log('Winners:', winners.map(a => a.length));
  };

  app.use(express.static(path.join(__dirname, 'static')));

  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    console.log('listening on port', port);
  });

  for (let i = 0; i < NUM_TICKETS; i++) {
    await buyTicket();
  }
  await draw();
}


main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
