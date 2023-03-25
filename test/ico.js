const {ethers, network} = require('hardhat');
const helpers = require('@nomicfoundation/hardhat-network-helpers');
require('@nomicfoundation/hardhat-chai-matchers');
const {expect} = require('chai');
const {Deployer} = require('../scripts/deployer');


describe('ICO', () => {
  const deployer = new Deployer();

  let signer1, signer2;  // developers
  let signer3, signer4;  // partners

  let token, lottery, controller, ico;
  let snapshot;

  const totalSupply = 1000000000000000000000000000n;
  const decimals = 1000000000000000000n;
  const price = 1500000000000000n;
  const developerShare = 4000n;  // 40%

  const impersonate = signer => {
    ico = ico.connect(signer);
  };

  const getICOBalance = async () => await ico.provider.getBalance(ico.address);
  const getLotteryBalance = async () => await lottery.provider.getBalance(lottery.address);

  before(async () => {
    [signer1, signer2, signer3, signer4] = await ethers.getSigners();
    await deployer.init(signer1.address);
    const deployed = await deployer.deployAll();
    token = deployed.token;
    lottery = deployed.lottery;
    controller = deployed.controller;
    ico = await deployer.deployICO(
        token.address,
        lottery.address,
        controller.address,
        price);
    await ico.setDeveloperShare(signer1.address, 2);
    await ico.setDeveloperShare(signer2.address, 3);
  });

  beforeEach(async () => {
    snapshot = await helpers.takeSnapshot();
    impersonate(signer1);
    await token.approve(ico.address, totalSupply);
  });

  afterEach(async () => {
    balances = Object.create(null);
    await snapshot.restore();
  });

  it('initial state', async () => {
    expect(await ico.token()).to.equal(token.address);
    expect(await ico.lottery()).to.equal(lottery.address);
    expect(await ico.controller()).to.equal(controller.address);
    expect(await ico.getDevelopers()).to.have.members([signer1.address, signer2.address]);
    expect(await ico.getDeveloperShare(signer1.address)).to.equal(2);
    expect(await ico.getDeveloperShare(signer2.address)).to.equal(3);
    expect(ico.getDeveloperShare(signer3.address)).to.be.reverted;
    expect(ico.getDeveloperShare(signer4.address)).to.be.reverted;
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(0);
    expect(await ico.balance(signer4.address)).to.equal(0);
    expect(await ico.tokensForSale()).to.equal(totalSupply);
    expect(await ico.isOpen()).to.equal(false);
    expect(await token.balanceOf(signer1.address)).to.equal(totalSupply);
    expect(await token.balanceOf(ico.address)).to.equal(0);
    expect(ico.buy({value: price})).to.be.reverted;
    expect(ico.close()).to.be.reverted;
    expect(ico.claim()).to.be.reverted;
    impersonate(signer3);
    expect(ico.open(price, developerShare)).to.be.reverted;
    expect(ico.buy({value: price})).to.be.reverted;
    expect(ico.close()).to.be.reverted;
    expect(ico.claim()).to.be.reverted;
  });

  it('add developer', async () => {
    await ico.setDeveloperShare(signer3.address, 1);
    expect(await ico.getDevelopers()).to.have.members([
      signer1.address,
      signer2.address,
      signer3.address,
    ]);
    expect(await ico.getDeveloperShare(signer1.address)).to.equal(2);
    expect(await ico.getDeveloperShare(signer2.address)).to.equal(3);
    expect(await ico.getDeveloperShare(signer3.address)).to.equal(1);
    expect(ico.getDeveloperShare(signer4.address)).to.be.reverted;
  });

  it('update developer share', async () => {
    await ico.setDeveloperShare(signer2.address, 4);
    expect(await ico.getDevelopers()).to.have.members([signer1.address, signer2.address]);
    expect(await ico.getDeveloperShare(signer1.address)).to.equal(2);
    expect(await ico.getDeveloperShare(signer2.address)).to.equal(4);
    expect(ico.getDeveloperShare(signer3.address)).to.be.reverted;
    expect(ico.getDeveloperShare(signer4.address)).to.be.reverted;
  });

  it('remove developer', async () => {
    await ico.removeDeveloper(signer1.address);
    expect(await ico.getDevelopers()).to.have.members([signer2.address]);
    expect(ico.getDeveloperShare(signer1.address)).to.be.reverted;
    expect(await ico.getDeveloperShare(signer2.address)).to.equal(3);
    expect(ico.getDeveloperShare(signer3.address)).to.be.reverted;
    expect(ico.getDeveloperShare(signer4.address)).to.be.reverted;
  });

  it('add remove developer', async () => {
    await ico.setDeveloperShare(signer3.address, 3);
    await ico.removeDeveloper(signer2.address);
    expect(await ico.getDevelopers()).to.have.members([signer1.address, signer3.address]);
    expect(await ico.getDeveloperShare(signer1.address)).to.equal(2);
    expect(ico.getDeveloperShare(signer2.address)).to.be.reverted;
    expect(await ico.getDeveloperShare(signer3.address)).to.equal(3);
    expect(ico.getDeveloperShare(signer4.address)).to.be.reverted;
  });

  it('open', async () => {
    await ico.open(price, developerShare);
    expect(await ico.isOpen()).to.equal(true);
    expect(await ico.price()).to.equal(price);
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(0);
    expect(await ico.balance(signer4.address)).to.equal(0);
    expect(await ico.tokensForSale()).to.equal(totalSupply);
    expect(await token.balanceOf(ico.address)).to.equal(0);
    expect(await token.balanceOf(signer1.address)).to.equal(totalSupply);
    expect(await token.balanceOf(signer2.address)).to.equal(0);
    expect(await token.balanceOf(signer3.address)).to.equal(0);
    expect(await token.balanceOf(signer4.address)).to.equal(0);
    expect(ico.claim()).to.be.reverted;
    impersonate(signer3);
    expect(ico.open(price, developerShare)).to.be.reverted;
    expect(ico.buy({value: price})).to.be.reverted;
    expect(ico.close()).to.be.reverted;
    expect(ico.claim()).to.be.reverted;
  });

  it('unauthorized', async () => {
    impersonate(signer3);
    expect(ico.open(price, developerShare)).to.be.reverted;
    expect(ico.buy({value: price})).to.be.reverted;
    expect(ico.close()).to.be.reverted;
    expect(ico.claim()).to.be.reverted;
    expect(await ico.isOpen()).to.equal(false);
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(0);
    expect(await ico.balance(signer4.address)).to.equal(0);
    expect(await ico.tokensForSale()).to.equal(totalSupply);
    expect(await token.balanceOf(ico.address)).to.equal(0);
    expect(await token.balanceOf(signer1.address)).to.equal(totalSupply);
    expect(await token.balanceOf(signer2.address)).to.equal(0);
    expect(await token.balanceOf(signer3.address)).to.equal(0);
    expect(await token.balanceOf(signer4.address)).to.equal(0);
    impersonate(signer1);
    expect(ico.buy({value: price})).to.be.reverted;
    expect(ico.close()).to.be.reverted;
    expect(ico.claim()).to.be.reverted;
  });

  it('close', async () => {
    await ico.open(price, developerShare);
    await ico.close();
    expect(await ico.isOpen()).to.equal(false);
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(0);
    expect(await ico.balance(signer4.address)).to.equal(0);
    expect(await ico.tokensForSale()).to.equal(totalSupply);
    expect(await token.balanceOf(ico.address)).to.equal(0);
    expect(await token.balanceOf(signer1.address)).to.equal(totalSupply);
    expect(await token.balanceOf(signer2.address)).to.equal(0);
    expect(await token.balanceOf(signer3.address)).to.equal(0);
    expect(await token.balanceOf(signer4.address)).to.equal(0);
    expect(ico.buy({value: price})).to.be.reverted;
    expect(ico.close()).to.be.reverted;
    expect(ico.claim()).to.be.reverted;
    impersonate(signer3);
    expect(ico.open(price, developerShare)).to.be.reverted;
    expect(ico.buy({value: price})).to.be.reverted;
    expect(ico.close()).to.be.reverted;
    expect(ico.claim()).to.be.reverted;
  });

  it('buy', async () => {
    const sold = 123000000000000000000n;
    await ico.open(price, developerShare);
    impersonate(signer3);
    await ico.buy({value: 123n * price});
    expect(await ico.isOpen()).to.equal(true);
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(sold);
    expect(await ico.balance(signer4.address)).to.equal(0);
    expect(await ico.tokensForSale()).to.equal(totalSupply - sold);
    expect(await token.balanceOf(ico.address)).to.equal(sold);
    expect(await token.balanceOf(signer1.address)).to.equal(totalSupply - sold);
    expect(await token.balanceOf(signer2.address)).to.equal(0);
    expect(await token.balanceOf(signer3.address)).to.equal(0);
    expect(await token.balanceOf(signer4.address)).to.equal(0);
    expect(await getICOBalance()).to.equal(123n * price);
    expect(await getLotteryBalance()).to.equal(0n);
    expect(ico.claim()).to.be.reverted;
    impersonate(signer1);
    expect(ico.claim()).to.be.reverted;
  });

  it('buy and close', async () => {
    const sold = 9630000000000000000000n * decimals / price;
    await ico.open(price, developerShare);
    impersonate(signer3);
    await ico.buy({value: 9630n * decimals});
    impersonate(signer1);
    await ico.close();
    expect(await ico.isOpen()).to.equal(false);
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(sold);
    expect(await ico.balance(signer4.address)).to.equal(0);
    expect(await ico.tokensForSale()).to.equal(totalSupply - sold);
    expect(await token.balanceOf(ico.address)).to.equal(sold);
    expect(await token.balanceOf(signer1.address)).to.equal(totalSupply - sold);
    expect(await token.balanceOf(signer2.address)).to.equal(0);
    expect(await token.balanceOf(signer3.address)).to.equal(0);
    expect(await token.balanceOf(signer4.address)).to.equal(0);
    expect(await getICOBalance()).to.equal(0n);
    expect(await getLotteryBalance()).to.equal(5778000000000000000000n);
    expect(await signer1.getBalance()).to.be.at.least(11539000000000000000000n);
    expect(await signer2.getBalance()).to.equal(12311200000000000000000n);
  });

  it('buy and claim', async () => {
    const sold = 1234000000000000000000n * decimals / price;
    await ico.open(price, developerShare);
    impersonate(signer3);
    await ico.buy({value: 1234n * decimals});
    impersonate(signer1);
    await ico.close();
    impersonate(signer3);
    await ico.claim();
    expect(await ico.isOpen()).to.equal(false);
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(0);
    expect(await ico.balance(signer4.address)).to.equal(0);
    expect(await ico.tokensForSale()).to.equal(totalSupply - sold);
    expect(await token.balanceOf(ico.address)).to.equal(0);
    expect(await token.balanceOf(signer1.address)).to.equal(totalSupply - sold);
    expect(await token.balanceOf(signer2.address)).to.equal(0);
    expect(await token.balanceOf(signer3.address)).to.equal(sold);
    expect(await token.balanceOf(signer4.address)).to.equal(0);
    expect(await getICOBalance()).to.equal(0n);
    expect(await getLotteryBalance()).to.equal(740400000000000000000n);
    expect(await signer1.getBalance()).to.be.at.least(10196000000000000000000n);
    expect(await signer2.getBalance()).to.equal(10296160000000000000000n);
    expect(ico.buy({value: price})).to.be.reverted;
    expect(ico.claim()).to.be.reverted;
    impersonate(signer1);
    expect(ico.close()).to.be.reverted;
    expect(ico.claim()).to.be.reverted;
  });

  it('two buyers', async () => {
    const sold3 = 1234n * decimals;
    const sold4 = 5678n * decimals;
    const totalSold = sold3 + sold4;
    await ico.open(price, developerShare);
    impersonate(signer3);
    await ico.buy({value: 1234n * price});
    impersonate(signer4);
    await ico.buy({value: 5678n * price});
    expect(await ico.isOpen()).to.equal(true);
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(sold3);
    expect(await ico.balance(signer4.address)).to.equal(sold4);
    expect(await ico.tokensForSale()).to.equal(totalSupply - totalSold);
    expect(await token.balanceOf(ico.address)).to.equal(totalSold);
    expect(await token.balanceOf(signer1.address)).to.equal(totalSupply - totalSold);
    expect(await token.balanceOf(signer2.address)).to.equal(0);
    expect(await token.balanceOf(signer3.address)).to.equal(0);
    expect(await token.balanceOf(signer4.address)).to.equal(0);
    expect(await getICOBalance()).to.equal(6912n * price);
    expect(await getLotteryBalance()).to.equal(0n);
  });

  it('closed after two buyers', async () => {
    const sold3 = 1234000000000000000000n * decimals / price;
    const sold4 = 5678000000000000000000n * decimals / price;
    const totalSold = sold3 + sold4;
    await ico.open(price, developerShare);
    impersonate(signer3);
    await ico.buy({value: 1234n * decimals});
    impersonate(signer4);
    await ico.buy({value: 5678n * decimals});
    impersonate(signer1);
    await ico.close();
    expect(await ico.isOpen()).to.equal(false);
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(sold3);
    expect(await ico.balance(signer4.address)).to.equal(sold4);
    expect(await ico.tokensForSale()).to.equal(totalSupply - totalSold);
    expect(await token.balanceOf(ico.address)).to.equal(totalSold);
    expect(await token.balanceOf(signer1.address)).to.equal(totalSupply - totalSold);
    expect(await token.balanceOf(signer2.address)).to.equal(0);
    expect(await token.balanceOf(signer3.address)).to.equal(0);
    expect(await token.balanceOf(signer4.address)).to.equal(0);
    expect(await getICOBalance()).to.equal(0n);
    expect(await getLotteryBalance()).to.equal(4147200000000000000000n);
    expect(await signer1.getBalance()).to.be.at.least(11104000000000000000000n);
    expect(await signer2.getBalance()).to.equal(11658880000000000000000n);
    expect(ico.close()).to.be.reverted;
    impersonate(signer3);
    expect(ico.buy({value: price})).to.be.reverted;
    impersonate(signer4);
    expect(ico.buy({value: price})).to.be.reverted;
  });

  it('one claimer', async () => {
    const sold3 = 1234000000000000000000n;
    const sold4 = 5678000000000000000000n;
    const totalSold = sold3 + sold4;
    await ico.open(price, developerShare);
    impersonate(signer3);
    await ico.buy({value: 1234n * price});
    impersonate(signer4);
    await ico.buy({value: 5678n * price});
    impersonate(signer1);
    await ico.close();
    impersonate(signer4);
    await ico.claim();
    expect(await ico.isOpen()).to.equal(false);
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(sold3);
    expect(await ico.balance(signer4.address)).to.equal(0);
    expect(await ico.tokensForSale()).to.equal(totalSupply - totalSold);
    expect(await token.balanceOf(ico.address)).to.equal(sold3);
    expect(await token.balanceOf(signer1.address)).to.equal(totalSupply - totalSold);
    expect(await token.balanceOf(signer2.address)).to.equal(0);
    expect(await token.balanceOf(signer3.address)).to.equal(0);
    expect(await token.balanceOf(signer4.address)).to.equal(sold4);
    impersonate(signer1);
    expect(ico.close()).to.be.reverted;
    expect(ico.claim()).to.be.reverted;
    impersonate(signer3);
    expect(ico.buy({value: price})).to.be.reverted;
    impersonate(signer4);
    expect(ico.buy({value: price})).to.be.reverted;
  });

  it('two claimers', async () => {
    const sold3 = 1234000000000000000000n;
    const sold4 = 5678000000000000000000n;
    const totalSold = sold3 + sold4;
    await ico.open(price, developerShare);
    impersonate(signer3);
    await ico.buy({value: 1234n * price});
    impersonate(signer4);
    await ico.buy({value: 5678n * price});
    impersonate(signer1);
    await ico.close();
    impersonate(signer3);
    await ico.claim();
    impersonate(signer4);
    await ico.claim();
    expect(await ico.isOpen()).to.equal(false);
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(0);
    expect(await ico.balance(signer4.address)).to.equal(0);
    expect(await ico.tokensForSale()).to.equal(totalSupply - totalSold);
    expect(await token.balanceOf(ico.address)).to.equal(0);
    expect(await token.balanceOf(signer1.address)).to.equal(totalSupply - totalSold);
    expect(await token.balanceOf(signer2.address)).to.equal(0);
    expect(await token.balanceOf(signer3.address)).to.equal(sold3);
    expect(await token.balanceOf(signer4.address)).to.equal(sold4);
    impersonate(signer1);
    expect(ico.close()).to.be.reverted;
    expect(ico.claim()).to.be.reverted;
    impersonate(signer3);
    expect(ico.buy({value: price})).to.be.reverted;
    impersonate(signer4);
    expect(ico.buy({value: price})).to.be.reverted;
  });

  it('accumulation', async () => {
    const sold3_1 = 1234000000000000000000n;
    const sold3_2 = 2143000000000000000000n;
    const sold3 = sold3_1 + sold3_2;
    const sold4 = 5678000000000000000000n;
    const totalSold = sold3 + sold4;
    await ico.open(price, developerShare);
    impersonate(signer3);
    await ico.buy({value: 1234n * price});
    impersonate(signer4);
    await ico.buy({value: 5678n * price});
    impersonate(signer3);
    await ico.buy({value: 2143n * price});
    expect(await ico.balance(signer3.address)).to.equal(sold3);
    expect(await ico.balance(signer4.address)).to.equal(sold4);
    expect(await ico.tokensForSale()).to.equal(totalSupply - totalSold);
    impersonate(signer1);
    await ico.close();
    impersonate(signer3);
    await ico.claim();
    impersonate(signer4);
    await ico.claim();
    expect(await ico.isOpen()).to.equal(false);
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(0);
    expect(await ico.balance(signer4.address)).to.equal(0);
    expect(await ico.tokensForSale()).to.equal(totalSupply - totalSold);
    expect(await token.balanceOf(ico.address)).to.equal(0);
    expect(await token.balanceOf(signer1.address)).to.equal(totalSupply - totalSold);
    expect(await token.balanceOf(signer2.address)).to.equal(0);
    expect(await token.balanceOf(signer3.address)).to.equal(sold3);
    expect(await token.balanceOf(signer4.address)).to.equal(sold4);
    impersonate(signer1);
    expect(ico.close()).to.be.reverted;
    expect(ico.claim()).to.be.reverted;
    impersonate(signer3);
    expect(ico.buy({value: price})).to.be.reverted;
    impersonate(signer4);
    expect(ico.buy({value: price})).to.be.reverted;
  });

  it('two rounds', async () => {
    const sold3_1 = 1234000000000000000000n;
    const sold3_2 = 2143000000000000000000n;
    const sold3 = sold3_1 + sold3_2;
    const sold4_1 = 5678000000000000000000n;
    const sold4_2 = 1234000000000000000000n;
    const sold4 = sold4_1 + sold4_2;
    const totalSold = sold3 + sold4;
    const price2 = 2000000000000000n;
    await ico.open(price, developerShare);
    impersonate(signer3);
    await ico.buy({value: 1234n * price});
    impersonate(signer4);
    await ico.buy({value: 5678n * price});
    impersonate(signer1);
    await ico.close();
    impersonate(signer3);
    await ico.claim();
    impersonate(signer1);
    await ico.open(price2, developerShare);
    await token.approve(ico.address, totalSupply - sold3_1 - sold4_1);
    expect(await ico.price()).to.equal(price2);
    expect(await ico.isOpen()).to.equal(true);
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(0);
    expect(await ico.balance(signer4.address)).to.equal(sold4_1);
    expect(await ico.tokensForSale()).to.equal(totalSupply - sold3_1 - sold4_1);
    expect(await token.balanceOf(ico.address)).to.equal(sold4_1);
    expect(await token.balanceOf(signer1.address)).to.equal(totalSupply - sold3_1 - sold4_1);
    expect(await token.balanceOf(signer2.address)).to.equal(0);
    expect(await token.balanceOf(signer3.address)).to.equal(sold3_1);
    expect(await token.balanceOf(signer4.address)).to.equal(0);
    impersonate(signer3);
    await ico.buy({value: 2143n * price2});
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(sold3_2);
    expect(await ico.balance(signer4.address)).to.equal(sold4_1);
    expect(await ico.tokensForSale()).to.equal(totalSupply - sold3 - sold4_1);
    expect(await token.balanceOf(ico.address)).to.equal(sold4_1 + sold3_2);
    impersonate(signer4);
    await ico.buy({value: 1234n * price2});
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(sold3_2);
    expect(await ico.balance(signer4.address)).to.equal(sold4);
    expect(await ico.tokensForSale()).to.equal(totalSupply - totalSold);
    expect(await token.balanceOf(ico.address)).to.equal(sold3_2 + sold4);
    impersonate(signer1);
    await ico.close();
    impersonate(signer3);
    await ico.claim();
    impersonate(signer4);
    await ico.claim();
    expect(await ico.balance(signer1.address)).to.equal(0);
    expect(await ico.balance(signer2.address)).to.equal(0);
    expect(await ico.balance(signer3.address)).to.equal(0);
    expect(await ico.balance(signer4.address)).to.equal(0);
    expect(await ico.tokensForSale()).to.equal(totalSupply - totalSold);
    expect(await token.balanceOf(ico.address)).to.equal(0);
    expect(await token.balanceOf(signer3.address)).to.equal(sold3);
    expect(await token.balanceOf(signer4.address)).to.equal(sold4);
  });
});
