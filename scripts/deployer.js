const {ethers, upgrades} = require('hardhat');

const {deploy, deployWithProxy, getDefaultSigner, send} = require('./utils');


exports.Deployer = class Deployer {
  constructor() {
    this._signers = [];
    this._deployer = void 0;
  }

  async _getDefaultSigner() {
    const signer = await getDefaultSigner();
    return await signer.getAddress();
  }

  async init(owner) {
    this._signers = await ethers.getSigners();
    this._owner = owner || await this._getDefaultSigner();
    this._deployer = await this._signers[0].getAddress();
    console.log('Deployer initialized, the signer is', this._deployer);
  }

  deployMockVRFCoordinator() {
    return deploy('MockVRFCoordinator');
  }

  async deployToken() {
    const token = await deploy('LotteryToken');
    if (this._deployer !== this._owner) {
      const totalSupply = await token.totalSupply();
      const {hash: txid} = await send(token, 'transfer', this._owner, totalSupply);
      console.log(`Total ELOT supply transferred to ${this._owner} -- txid ${txid}`);
    }
    return token;
  }

  async deployLibraries() {
    const drawingLibrary = await deploy('Drawing');
    const setLibrary = await deploy('TicketSet');
    const indexLibrary = await deploy('TicketIndex', [], {TicketSet: setLibrary.address});
    const ticketLibrary = await deploy('UserTickets');
    return {drawingLibrary, setLibrary, indexLibrary, ticketLibrary};
  }

  async deployLottery(vrfCoordinatorAddress = process.env.CHAINLINK_VRF_COORDINATOR) {
    const {drawingLibrary, setLibrary, indexLibrary, ticketLibrary} = await this.deployLibraries();
    const lottery = await deployWithProxy('Lottery', [vrfCoordinatorAddress], {
      Drawing: drawingLibrary.address,
      TicketSet: setLibrary.address,
      TicketIndex: indexLibrary.address,
      UserTickets: ticketLibrary.address,
    });
    return {drawingLibrary, setLibrary, indexLibrary, ticketLibrary, lottery};
  }

  async deployController(token, lottery) {
    const owners = [this._owner];
    let tx;
    const controller = await deploy('LotteryController', [
        token.address, lottery.address, owners, owners]);
    tx = await send(lottery, 'transferOwnership', controller.address);
    console.log(`Lottery ownership transferred to ${controller.address} -- txid ${tx.hash}`);
    const TIMELOCK_ADMIN_ROLE = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes('TIMELOCK_ADMIN_ROLE'));
    tx = await send(controller, 'grantRole', TIMELOCK_ADMIN_ROLE, this._owner);
    console.log(`TIMELOCK_ADMIN_ROLE granted to ${this._owner} -- txid ${tx.hash}`);
    const DRAW_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('DRAW_ROLE'));
    tx = await send(controller, 'grantRole', DRAW_ROLE, this._owner);
    console.log(`DRAW_ROLE granted to ${this._owner} -- txid ${tx.hash}`);
    if (this._deployer !== this._owner) {
      tx = await send(controller, 'renounceRole', TIMELOCK_ADMIN_ROLE, this._deployer);
      console.log(`TIMELOCK_ADMIN_ROLE renounced by ${this._deployer} -- txid ${tx.hash}`);
    }
    return controller;
  }

  deployGovernor(token, controller) {
    return deploy('LotteryGovernor', [token.address, controller.address]);
  }

  async deployAll(vrfCoordinatorAddress = process.env.CHAINLINK_VRF_COORDINATOR) {
    const token = await this.deployToken();
    const {lottery} = await this.deployLottery(vrfCoordinatorAddress);
    const controller = await this.deployController(token, lottery);
    const governor = await this.deployGovernor(token, controller);
    return {token, lottery, controller, governor};
  }
};
