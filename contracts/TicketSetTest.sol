//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import './TicketSet.sol';


contract TicketSetTest {
  using TicketSet for uint64[];

  uint64[] private _tickets;

  function testEmptySetDoesNotContain() public {
    delete _tickets;
    require(!_tickets.contains(42));
  }

  function testContainsOneElement() public {
    delete _tickets;
    _tickets.push(42);
    require(_tickets.contains(42));
    require(!_tickets.contains(12));
    require(!_tickets.contains(123));
  }

  function testContainsTwoElements() public {
    delete _tickets;
    _tickets.push(42);
    _tickets.push(43);
    require(_tickets.contains(42));
    require(_tickets.contains(43));
    require(!_tickets.contains(12));
    require(!_tickets.contains(123));
  }

  function testContainsManyElements() public {
    delete _tickets;
    _tickets.push(3);
    _tickets.push(5);
    _tickets.push(7);
    _tickets.push(11);
    require(!_tickets.contains(0));
    require(!_tickets.contains(1));
    require(!_tickets.contains(2));
    require(_tickets.contains(3));
    require(!_tickets.contains(4));
    require(_tickets.contains(5));
    require(!_tickets.contains(6));
    require(_tickets.contains(7));
    require(!_tickets.contains(8));
    require(!_tickets.contains(9));
    require(!_tickets.contains(10));
    require(_tickets.contains(11));
    require(!_tickets.contains(12));
  }

  function testIntersectTwoEmptySets() public {
    delete _tickets;
    uint64[] memory lhs = new uint64[](0);
    uint64[] storage rhs = _tickets;
    uint64[] memory result = lhs.intersect(rhs);
    require(result.length == 0);
  }

  function testIntersectWithEmptyRHS() public {
    delete _tickets;
    uint64[] memory lhs = new uint64[](4);
    lhs[0] = 3;
    lhs[1] = 5;
    lhs[2] = 7;
    lhs[3] = 11;
    uint64[] storage rhs = _tickets;
    uint64[] memory result = lhs.intersect(rhs);
    require(result.length == 0);
  }

  function testIntersectEmptyLHS() public {
    delete _tickets;
    uint64[] memory lhs = new uint64[](0);
    uint64[] storage rhs = _tickets;
    rhs.push(3);
    rhs.push(5);
    rhs.push(7);
    rhs.push(11);
    uint64[] memory result = lhs.intersect(rhs);
    require(result.length == 0);
  }

  function testIntersectDisjointSets() public {
    delete _tickets;
    uint64[] memory lhs = new uint64[](4);
    lhs[0] = 3;
    lhs[1] = 7;
    lhs[2] = 13;
    lhs[3] = 19;
    uint64[] storage rhs = _tickets;
    rhs.push(5);
    rhs.push(11);
    rhs.push(17);
    rhs.push(23);
    uint64[] memory result = lhs.intersect(rhs);
    require(result.length == 0);
  }

  function testIntersection() public {
    delete _tickets;
    uint64[] memory lhs = new uint64[](6);
    lhs[0] = 3;
    lhs[1] = 5;
    lhs[2] = 7;
    lhs[3] = 11;
    lhs[4] = 13;
    lhs[5] = 17;
    uint64[] storage rhs = _tickets;
    rhs.push(11);
    rhs.push(13);
    rhs.push(17);
    rhs.push(19);
    rhs.push(23);
    rhs.push(29);
    uint64[] memory result = lhs.intersect(rhs);
    require(result.length == 3);
    require(result[0] == 11);
    require(result[1] == 13);
    require(result[2] == 17);
  }

  function testSubtractEmptySets() public pure {
    uint64[] memory lhs = new uint64[](0);
    uint64[] memory rhs = new uint64[](0);
    uint64[] memory result = lhs.subtract(rhs);
    require(result.length == 0);
  }

  function testSubtractEmptyRHS() public pure {
    uint64[] memory lhs = new uint64[](4);
    lhs[0] = 3;
    lhs[1] = 5;
    lhs[2] = 7;
    lhs[3] = 11;
    uint64[] memory rhs = new uint64[](0);
    uint64[] memory result = lhs.subtract(rhs);
    require(result.length == 4);
    require(result[0] == 3);
    require(result[1] == 5);
    require(result[2] == 7);
    require(result[3] == 11);
  }

  function testSubtractFromEmptyLHS() public pure {
    uint64[] memory lhs = new uint64[](0);
    uint64[] memory rhs = new uint64[](4);
    rhs[0] = 3;
    rhs[1] = 5;
    rhs[2] = 7;
    rhs[3] = 11;
    uint64[] memory result = lhs.subtract(rhs);
    require(result.length == 0);
  }

  function testSubtractDisjointSet() public pure {
    uint64[] memory lhs = new uint64[](4);
    lhs[0] = 3;
    lhs[1] = 7;
    lhs[2] = 13;
    lhs[3] = 19;
    uint64[] memory rhs = new uint64[](4);
    rhs[0] = 5;
    rhs[1] = 11;
    rhs[2] = 17;
    rhs[3] = 23;
    uint64[] memory result = lhs.subtract(rhs);
    require(result.length == 4);
    require(result[0] == 3);
    require(result[1] == 7);
    require(result[2] == 13);
    require(result[3] == 19);
  }

  function testSubtraction() public pure {
    uint64[] memory lhs = new uint64[](6);
    lhs[0] = 3;
    lhs[1] = 5;
    lhs[2] = 7;
    lhs[3] = 11;
    lhs[4] = 13;
    lhs[5] = 17;
    uint64[] memory rhs = new uint64[](6);
    rhs[0] = 11;
    rhs[1] = 13;
    rhs[2] = 17;
    rhs[3] = 19;
    rhs[4] = 23;
    rhs[5] = 29;
    uint64[] memory result = lhs.subtract(rhs);
    require(result.length == 3);
    require(result[0] == 3);
    require(result[1] == 5);
    require(result[2] == 7);
  }

  function testUnionEmptySets() public pure {
    uint64[] memory lhs = new uint64[](0);
    uint64[] memory rhs = new uint64[](0);
    uint64[] memory result = lhs.union(rhs);
    require(result.length == 0);
  }

  function testUnionEmptyRHS() public pure {
    uint64[] memory lhs = new uint64[](4);
    lhs[0] = 3;
    lhs[1] = 5;
    lhs[2] = 7;
    lhs[3] = 11;
    uint64[] memory rhs = new uint64[](0);
    uint64[] memory result = lhs.union(rhs);
    require(result.length == 4);
    require(result[0] == 3);
    require(result[1] == 5);
    require(result[2] == 7);
    require(result[3] == 11);
  }

  function testUnionEmptyLHS() public pure {
    uint64[] memory lhs = new uint64[](0);
    uint64[] memory rhs = new uint64[](4);
    rhs[0] = 3;
    rhs[1] = 5;
    rhs[2] = 7;
    rhs[3] = 11;
    uint64[] memory result = lhs.union(rhs);
    require(result.length == 4);
    require(result[0] == 3);
    require(result[1] == 5);
    require(result[2] == 7);
    require(result[3] == 11);
  }

  function testUnionDisjointSet() public pure {
    uint64[] memory lhs = new uint64[](4);
    lhs[0] = 3;
    lhs[1] = 7;
    lhs[2] = 13;
    lhs[3] = 19;
    uint64[] memory rhs = new uint64[](4);
    rhs[0] = 5;
    rhs[1] = 11;
    rhs[2] = 17;
    rhs[3] = 23;
    uint64[] memory result = lhs.union(rhs);
    require(result.length == 8);
    require(result[0] == 3);
    require(result[1] == 5);
    require(result[2] == 7);
    require(result[3] == 11);
    require(result[4] == 13);
    require(result[5] == 17);
    require(result[6] == 19);
    require(result[7] == 23);
  }

  function testUnion() public pure {
    uint64[] memory lhs = new uint64[](6);
    lhs[0] = 3;
    lhs[1] = 5;
    lhs[2] = 7;
    lhs[3] = 11;
    lhs[4] = 13;
    lhs[5] = 17;
    uint64[] memory rhs = new uint64[](6);
    rhs[0] = 11;
    rhs[1] = 13;
    rhs[2] = 17;
    rhs[3] = 19;
    rhs[4] = 23;
    rhs[5] = 29;
    uint64[] memory result = lhs.union(rhs);
    require(result.length == 9);
    require(result[0] == 3);
    require(result[1] == 5);
    require(result[2] == 7);
    require(result[3] == 11);
    require(result[4] == 13);
    require(result[5] == 17);
    require(result[6] == 19);
    require(result[7] == 23);
    require(result[8] == 29);
  }

  function testAll() public {
    testEmptySetDoesNotContain();
    testContainsOneElement();
    testContainsTwoElements();
    testContainsManyElements();
    testIntersectTwoEmptySets();
    testIntersectWithEmptyRHS();
    testIntersectEmptyLHS();
    testIntersectDisjointSets();
    testIntersection();
    testSubtractEmptySets();
    testSubtractEmptyRHS();
    testSubtractFromEmptyLHS();
    testSubtractDisjointSet();
    testSubtraction();
    testUnionEmptySets();
    testUnionEmptyRHS();
    testUnionEmptyLHS();
    testUnionDisjointSet();
    testUnion();
  }
}
