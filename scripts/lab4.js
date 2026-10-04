import { network } from "hardhat";
import { readFileSync, writeFileSync } from "node:fs";

const { ethers } = await network.create();

function loadArtifact(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

async function deployFromArtifact(
  artifactPath,
  signer,
  constructorArguments = []
) {
  const artifact = loadArtifact(artifactPath);

  const contractFactory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    signer
  );

  const contract = await contractFactory.deploy(
    ...constructorArguments
  );

  await contract.waitForDeployment();

  return contract;
}

async function main() {
  const [owner] = await ethers.getSigners();

  console.log("Користувач:", owner.address);

  // 1. Завантаження офіційних артефактів Uniswap V2
  const factoryArtifactPath =
    "node_modules/@uniswap/v2-core/build/UniswapV2Factory.json";

  const wethArtifactPath =
    "node_modules/@uniswap/v2-periphery/build/WETH9.json";

  const routerArtifactPath =
    "node_modules/@uniswap/v2-periphery/build/UniswapV2Router02.json";

  // 2. Розгортання Uniswap V2 Factory
  const factory = await deployFromArtifact(
    factoryArtifactPath,
    owner,
    [owner.address]
  );

  const factoryAddress = await factory.getAddress();

  console.log("\nUniswap V2 Factory:", factoryAddress);

  // 3. Розгортання WETH
  const weth = await deployFromArtifact(
    wethArtifactPath,
    owner
  );

  const wethAddress = await weth.getAddress();

  console.log("WETH:", wethAddress);

  // 4. Розгортання Uniswap V2 Router
  const router = await deployFromArtifact(
    routerArtifactPath,
    owner,
    [factoryAddress, wethAddress]
  );

  const routerAddress = await router.getAddress();

  console.log("Uniswap V2 Router:", routerAddress);

  // 5. Розгортання двох власних ERC-20 токенів
  const tokenA = await ethers.deployContract("AssetToken", [
    "SikaliukCoin",
    "SIK",
    ethers.parseEther("100000"),
  ]);

  await tokenA.waitForDeployment();

  const tokenB = await ethers.deployContract("AssetToken", [
    "MockFiat",
    "MFT",
    ethers.parseEther("100000"),
  ]);

  await tokenB.waitForDeployment();

  const tokenAAddress = await tokenA.getAddress();
  const tokenBAddress = await tokenB.getAddress();

  console.log("\nToken A:", tokenAAddress);
  console.log("Token B:", tokenBAddress);

  // 6. Розгортання контракту-інтегратора
  const integrator = await ethers.deployContract(
    "DefiIntegrator",
    [routerAddress]
  );

  await integrator.waitForDeployment();

  const integratorAddress =
    await integrator.getAddress();

  console.log("DefiIntegrator:", integratorAddress);

  // 7. Початкова ліквідність
  const amountA = ethers.parseEther("1000");
  const amountB = ethers.parseEther("2000");

  // Користувач дозволяє інтегратору списати Token A
  await (
    await tokenA.approve(integratorAddress, amountA)
  ).wait();

  console.log("\nApprove Token A виконано");

  // Користувач дозволяє інтегратору списати Token B
  await (
    await tokenB.approve(integratorAddress, amountB)
  ).wait();

  console.log("Approve Token B виконано");

  // Інтегратор створює пул через Router
  const liquidityTransaction =
    await integrator.provideLiquidity(
      tokenAAddress,
      tokenBAddress,
      amountA,
      amountB
    );

  const liquidityReceipt =
    await liquidityTransaction.wait();

  console.log("\nЛіквідність додано: 1000 SIK / 2000 MFT");
  console.log(
    "Хеш транзакції:",
    liquidityReceipt.hash
  );

  // 8. Отримання адреси створеного пулу
  const pairAddress = await factory.getPair(
    tokenAAddress,
    tokenBAddress
  );

  console.log("Створений пул:", pairAddress);

  // 9. Баланси до обміну
  const balanceABefore =
    await tokenA.balanceOf(owner.address);

  const balanceBBefore =
    await tokenB.balanceOf(owner.address);

  console.log("\nБаланс до обміну:");
  console.log(
    "SIK:",
    ethers.formatEther(balanceABefore)
  );
  console.log(
    "MFT:",
    ethers.formatEther(balanceBBefore)
  );

  // 10. Дозвіл інтегратору на 10 SIK
  const swapAmount = ethers.parseEther("10");

  await (
    await tokenA.approve(
      integratorAddress,
      swapAmount
    )
  ).wait();

  console.log("\nApprove Token A для swap виконано");

  // 11. Обмін Token A на Token B
  const swapTransaction =
    await integrator.swapTokens(
      tokenAAddress,
      tokenBAddress,
      swapAmount,
      1n
    );

  const swapReceipt =
    await swapTransaction.wait();

  console.log("Обмін 10 SIK на MFT виконано");
  console.log(
    "Хеш транзакції:",
    swapReceipt.hash
  );

  // 12. Баланси після обміну
  const balanceAAfter =
    await tokenA.balanceOf(owner.address);

  const balanceBAfter =
    await tokenB.balanceOf(owner.address);

  console.log("\nБаланс після обміну:");
  console.log(
    "SIK:",
    ethers.formatEther(balanceAAfter)
  );
  console.log(
    "MFT:",
    ethers.formatEther(balanceBAfter)
  );

  console.log(
    "Отримано MFT:",
    ethers.formatEther(
      balanceBAfter - balanceBBefore
    )
  );

  // 13. Збереження результату
  const deployment = {
    owner: owner.address,
    uniswapFactory: factoryAddress,
    weth: wethAddress,
    uniswapRouter: routerAddress,
    tokenA: tokenAAddress,
    tokenB: tokenBAddress,
    defiIntegrator: integratorAddress,
    liquidityPool: pairAddress,
    liquidityTransaction: liquidityReceipt.hash,
    swapTransaction: swapReceipt.hash,
  };

  writeFileSync(
    "deployment-lab4.json",
    JSON.stringify(deployment, null, 2)
  );

  console.log(
    "\nРезультати записано у deployment-lab4.json"
  );
  console.log("Лабораторну операцію завершено");
}

main().catch((error) => {
  console.error("\nПомилка:", error);
  process.exitCode = 1;
});