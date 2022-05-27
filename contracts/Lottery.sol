// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol';
import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/PullPaymentUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol';

import './Drawing.sol';
import './TicketIndex.sol';
import './TicketSet.sol';
import './UserTickets.sol';


// This is in USD cents, so it's $1.50
uint constant BASE_TICKET_PRICE_USD = 150;

// ChainLink USD price feed on Polygon (8 decimals)
address constant USD_PRICE_FEED = 0xAB594600376Ec9fD91F8e885dADF0CE036862dE0;


contract Lottery is UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable,
    PullPaymentUpgradeable, ReentrancyGuardUpgradeable
{
  using AddressUpgradeable for address payable;
  using UserTickets for TicketData[];
  using TicketSet for uint64[];
  using TicketIndex for uint64[][90];

  enum State {OPEN, DRAWING, DRAWN, CLOSING}

  VRFCoordinatorV2Interface private _vrfCoordinator;

  uint256 public baseTicketPrice;

  uint64 public nextTicketId;
  uint64 public currentRound;

  State public state;

  mapping (address => TicketData[]) public ticketsByPlayer;

  address payable[] public playersByTicket;
  uint64[][90][] public ticketsByNumber;
  uint8[6][] public drawnNumbers;
  uint64[][5][] public winners;

  event NewTicketPrice(uint indexed round, uint256 price);
  event Ticket(uint indexed round, address indexed player, uint8[] numbers);
  event VRFRequest(uint indexed round, uint256 requestId);
  event Draw(uint indexed round, uint8[6] numbers, uint256 currentBalance);
  event CloseRound(uint indexed round, uint256 currentBalance, uint256[][5] prizes);

  // Accept funds from ICO and possibly other sources in the future.
  receive() external payable {}

  function initialize(address vrfCoordinator) public initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    __Pausable_init();
    __PullPayment_init();
    __ReentrancyGuard_init();
    _vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinator);
    _updateTicketPrice();
    nextTicketId = 0;
    currentRound = 0;
    ticketsByNumber.push();
    drawnNumbers.push();
    winners.push();
    state = State.OPEN;
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function _updateTicketPrice() private {
    AggregatorV3Interface priceFeed = AggregatorV3Interface(USD_PRICE_FEED);
    (, int256 price, , , ) = priceFeed.latestRoundData();
    baseTicketPrice = BASE_TICKET_PRICE_USD *
        uint256(10 ** (16 + priceFeed.decimals())) / uint256(price);
    emit NewTicketPrice(currentRound, baseTicketPrice);
  }

  function pause() public onlyOwner {
    _pause();
  }

  function unpause() public onlyOwner {
    _unpause();
  }

  function _choose(uint n, uint k) private pure returns (uint) {
    require(n >= k, 'internal error, invalid binomial coefficient');
    if (k == 0) {
      return 1;
    } else if (k * 2 > n) {
      return _choose(n, n - k);
    } else {
      return n * _choose(n - 1, k - 1) / k;
    }
  }

  function getTicketPrice(uint8[] calldata playerNumbers) public view returns (uint256) {
    require(state == State.OPEN, 'please wait for the next round');
    require(playerNumbers.length >= 6, 'too few numbers');
    require(playerNumbers.length <= 90, 'too many numbers');
    for (uint i = 0; i < playerNumbers.length; i++) {
      require(playerNumbers[i] > 0 && playerNumbers[i] <= 90, 'invalid numbers');
      for (uint j = i + 1; j < playerNumbers.length; j++) {
        require(playerNumbers[i] != playerNumbers[j], 'duplicate numbers');
      }
    }
    return baseTicketPrice * _choose(playerNumbers.length, 6);
  }

  function buyTicket(uint8[] calldata playerNumbers) public payable whenNotPaused nonReentrant {
    uint256 ticketPrice = getTicketPrice(playerNumbers);
    require(msg.value == ticketPrice, 'incorrect value, please check the price of your ticket');
    uint64 ticketId = nextTicketId++;
    ticketsByPlayer[msg.sender].push(TicketData({
      id: ticketId,
      round: currentRound,
      timestamp: uint64(block.timestamp),
      size: uint64(playerNumbers.length)
    }));
    playersByTicket.push(payable(msg.sender));
    for (uint i = 0; i < playerNumbers.length; i++) {
      ticketsByNumber[currentRound][playerNumbers[i] - 1].push(ticketId);
    }
    emit Ticket(currentRound, msg.sender, playerNumbers);
    payable(owner()).sendValue(msg.value / 10);
  }

  function getTickets(address player, uint64 round) public view returns (uint64[] memory ids) {
    return ticketsByPlayer[player].getTickets(round);
  }

  function getTicket(uint64 round, uint64 ticketId)
      public view returns (address player, uint256 timestamp, uint8[] memory numbers)
  {
    player = playersByTicket[ticketId];
    require(player != address(0), 'invalid ticket');
    TicketData storage ticket = ticketsByPlayer[player].getTicket(ticketId);
    timestamp = ticket.timestamp;
    uint8[90] memory temp;
    uint count = 0;
    for (uint8 number = 0; number < 90; number++) {
      if (ticketsByNumber[round][number].contains(ticketId)) {
        temp[count++] = number + 1;
      }
    }
    numbers = new uint8[](count);
    for (uint i = 0; i < count; i++) {
      numbers[i] = temp[i];
    }
  }

  function draw(uint64 vrfSubscriptionId, bytes32 vrfKeyHash, uint32 callbackGasLimit)
      public onlyOwner
  {
    require(state == State.OPEN, 'invalid state');
    state = State.DRAWING;
    uint256 vrfRequestId = _vrfCoordinator.requestRandomWords(
        vrfKeyHash,
        vrfSubscriptionId,
        /*requestConfirmations=*/3,
        callbackGasLimit,
        /*numWords=*/1);
    emit VRFRequest(currentRound, vrfRequestId);
  }

  function rawFulfillRandomWords(uint256, uint256[] memory randomWords) external whenNotPaused {
    require(msg.sender == address(_vrfCoordinator), 'permission denied');
    require(state == State.DRAWING, 'invalid state');
    drawnNumbers[currentRound] = Drawing.sortNumbersByTicketCount(
        ticketsByNumber[currentRound],
        Drawing.getRandomNumbersWithoutRepetitions(randomWords[0]));
    state = State.DRAWN;
    emit Draw(currentRound, drawnNumbers[currentRound], address(this).balance);
  }

  function getDrawnNumbers(uint64 round) public view returns (uint8[6] memory numbers) {
    require(state != State.OPEN, 'invalid state');
    return drawnNumbers[round];
  }

  function findWinners() public onlyOwner {
    require(state == State.DRAWN, 'please call draw() first');
    winners[currentRound] = ticketsByNumber[currentRound].findWinningTickets(
        drawnNumbers[currentRound]);
    state = State.CLOSING;
  }

  function getWinners(uint64 round) public view returns (uint64[][5] memory result) {
    require(round < currentRound, 'invalid round number');
    return winners[round];
  }

  function _getTicket(uint64 id) private view returns (TicketData storage) {
    return ticketsByPlayer[playersByTicket[id]].getTicket(id);
  }

  function _calculatePrizes() private view returns (uint256[][5] memory prizes) {
    uint64[][5] storage roundWinners = winners[currentRound];
    uint256 sum = address(this).balance * 18 / 100;
    for (uint i = 0; i < roundWinners.length; i++) {
      prizes[i] = new uint256[](roundWinners[i].length);
      uint matches = i + 2;
      uint[] memory weights = prizes[i];
      for (uint j = 0; j < roundWinners[i].length; j++) {
        uint size = _getTicket(roundWinners[i][j]).size;
        weights[j] = _choose(size - matches, 6 - matches);
      }
      uint totalWeight = 0;
      for (uint j = 0; j < weights.length; j++) {
        totalWeight += weights[j];
      }
      for (uint j = 0; j < prizes[i].length; j++) {
        prizes[i][j] = sum * weights[j] / totalWeight;
      }
    }
  }

  function _reset() private {
    currentRound++;
    ticketsByNumber.push();
    drawnNumbers.push();
    winners.push();
    state = State.OPEN;
    _updateTicketPrice();
  }

  function closeRound() public onlyOwner {
    require(state == State.CLOSING, 'please call findWinners() first');
    uint256 jackpot = address(this).balance;
    uint256[][5] memory prizes = _calculatePrizes();
    uint64[][5] storage tickets = winners[currentRound];
    for (uint i = 0; i < tickets.length; i++) {
      for (uint j = 0; j < tickets[i].length; j++) {
        _asyncTransfer(playersByTicket[tickets[i][j]], prizes[i][j]);
      }
    }
    emit CloseRound(currentRound, jackpot, prizes);
    delete prizes;
    _reset();
  }
}
