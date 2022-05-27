const {Deployer} = require('./deployer');

async function main() {
  const deployer = new Deployer();
  await deployer.init(process.env.ETHERNALOTTO_OWNER);
  await deployer.deployAll();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
