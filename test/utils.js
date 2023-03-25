const {time} = require('@nomicfoundation/hardhat-network-helpers');


async function advanceTime(seconds) {
  await time.increase(seconds);
}

exports.advanceTime = advanceTime;


// 7 days in seconds. This is the distance between draws.
const SEVEN_DAYS = 60 * 60 * 24 * 7;


async function advanceTimeToNextDrawing() {
  const offset = 244800;  // first Saturday evening since Unix Epoch, in seconds
  const now = Math.floor(Date.now() / 1000);
  const nextDrawTime = offset + Math.ceil((now - offset) / SEVEN_DAYS) * SEVEN_DAYS;
  await time.increaseTo(nextDrawTime);
}

exports.advanceTimeToNextDrawing = advanceTimeToNextDrawing;
