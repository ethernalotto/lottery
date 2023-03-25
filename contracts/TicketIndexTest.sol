//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import './TicketIndex.sol';


contract TicketIndexTest {
  using TicketIndex for uint64[][90];

  uint private _state = 0;

  uint64 private _nextTicketId = 0;
  uint64[][90] private _tickets;

  uint8[6] private _drawnNumbers = [3, 5, 7, 11, 13, 17];

  function _random() private returns (uint256) {
    return uint256(keccak256(abi.encode(block.timestamp, _state++)));
  }

  function _randomn(uint n) private returns (uint8[] memory numbers) {
    uint8[90] memory source;
    for (uint8 i = 1; i <= 90; i++) {
      source[i - 1] = i;
    }
    numbers = new uint8[](n);
    uint256 randomness = _random();
    for (uint i = 0; i < n; i++) {
      uint j = i + randomness % (90 - i);
      randomness /= 90;
      numbers[i] = source[j];
      source[j] = source[i];
    }
  }

  function _createRandomTicket(uint maxCardinality)
      private returns (uint64 id, uint8[] memory numbers)
  {
    id = _nextTicketId++;
    uint size = _random() % (maxCardinality - 5) + 6;
    numbers = _randomn(size);
    for (uint i = 0; i < size; i++) {
      _tickets[numbers[i] - 1].push(id);
    }
  }

  function _createTicket(uint8 n1, uint8 n2, uint8 n3, uint8 n4, uint8 n5, uint8 n6)
      private returns (uint64 id)
  {
    id = _nextTicketId++;
    _tickets[n1 - 1].push(id);
    _tickets[n2 - 1].push(id);
    _tickets[n3 - 1].push(id);
    _tickets[n4 - 1].push(id);
    _tickets[n5 - 1].push(id);
    _tickets[n6 - 1].push(id);
  }

  function testEmpty() public {
    delete _tickets;
    uint64[][5] memory winners = _tickets.findWinningTickets(_drawnNumbers);
    require(winners[0].length == 0);
    require(winners[1].length == 0);
    require(winners[2].length == 0);
    require(winners[3].length == 0);
    require(winners[4].length == 0);
  }

  function testOneTicketNoWin() public {
    delete _tickets;
    _createTicket(1, 2, 4, 6, 8, 9);
    uint64[][5] memory winners = _tickets.findWinningTickets(_drawnNumbers);
    require(winners[0].length == 0);
    require(winners[1].length == 0);
    require(winners[2].length == 0);
    require(winners[3].length == 0);
    require(winners[4].length == 0);
  }

  function testOneTicketOneMatch() public {
    delete _tickets;
    _createTicket(1, 2, 3, 4, 6, 8);
    uint64[][5] memory winners = _tickets.findWinningTickets(_drawnNumbers);
    require(winners[0].length == 0);
    require(winners[1].length == 0);
    require(winners[2].length == 0);
    require(winners[3].length == 0);
    require(winners[4].length == 0);
  }

  function testOneTicketTwoMatches() public {
    delete _tickets;
    uint64 id = _createTicket(1, 2, 3, 4, 5, 6);
    uint64[][5] memory winners = _tickets.findWinningTickets(_drawnNumbers);
    require(winners[0].length == 1);
    require(winners[0][0] == id);
    require(winners[1].length == 0);
    require(winners[2].length == 0);
    require(winners[3].length == 0);
    require(winners[4].length == 0);
  }

  function testOneTicketThreeMatches() public {
    delete _tickets;
    uint64 id = _createTicket(2, 3, 4, 5, 6, 7);
    uint64[][5] memory winners = _tickets.findWinningTickets(_drawnNumbers);
    require(winners[0].length == 0);
    require(winners[1].length == 1);
    require(winners[1][0] == id);
    require(winners[2].length == 0);
    require(winners[3].length == 0);
    require(winners[4].length == 0);
  }

  function testOneTicketFourMatches() public {
    delete _tickets;
    uint64 id = _createTicket(3, 4, 5, 6, 7, 11);
    uint64[][5] memory winners = _tickets.findWinningTickets(_drawnNumbers);
    require(winners[0].length == 0);
    require(winners[1].length == 0);
    require(winners[2].length == 1);
    require(winners[2][0] == id);
    require(winners[3].length == 0);
    require(winners[4].length == 0);
  }

  function testOneTicketFiveMatches() public {
    delete _tickets;
    uint64 id = _createTicket(3, 5, 6, 7, 11, 13);
    uint64[][5] memory winners = _tickets.findWinningTickets(_drawnNumbers);
    require(winners[0].length == 0);
    require(winners[1].length == 0);
    require(winners[2].length == 0);
    require(winners[3].length == 1);
    require(winners[3][0] == id);
    require(winners[4].length == 0);
  }

  function testOneTicketSixMatches() public {
    delete _tickets;
    uint64 id = _createTicket(3, 5, 7, 11, 13, 17);
    uint64[][5] memory winners = _tickets.findWinningTickets(_drawnNumbers);
    require(winners[0].length == 0);
    require(winners[1].length == 0);
    require(winners[2].length == 0);
    require(winners[3].length == 0);
    require(winners[4].length == 1);
    require(winners[4][0] == id);
  }

  function testAll() public {
    testEmpty();
    testOneTicketNoWin();
    testOneTicketOneMatch();
    testOneTicketTwoMatches();
    testOneTicketThreeMatches();
    testOneTicketFourMatches();
    testOneTicketFiveMatches();
    testOneTicketSixMatches();
  }

  function testRandomTickets(uint count) public {
    uint8[][] memory numbers = new uint8[][](count);
    uint64 offset = _nextTicketId;
    for (uint i = 0; i < count; i++) {
      (uint id, uint8[] memory ticketNumbers) = _createRandomTicket(8);
      numbers[id - offset] = ticketNumbers;
    }
    uint64[][5] memory winners = _tickets.findWinningTickets(_drawnNumbers);
    for (uint i = 1; i < winners.length; i++) {
      for (uint j = 0; j < winners[i].length; j++) {
        for (uint k = 0; k < winners[i - 1].length; k++) {
          require(winners[i][j] != winners[i - 1][k]);
        }
      }
    }
    for (uint i = 0; i < winners.length; i++) {
      for (uint j = 0; j < winners[i].length; j++) {
        uint8[] memory ticketNumbers = numbers[winners[i][j]];
        uint matches = 0;
        for (uint k1 = 0; k1 < ticketNumbers.length; k1++) {
          for (uint k2 = 0; k2 < _drawnNumbers.length; k2++) {
            if (ticketNumbers[k1] == _drawnNumbers[k2]) {
              matches++;
              break;
            }
          }
        }
        require(matches == i + 2);
      }
    }
  }
}
