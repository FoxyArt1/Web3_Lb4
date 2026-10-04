import { network } from "hardhat";

const { ethers } = await network.create();

async function main() {
  const [owner, trader] = await ethers.getSigners();

  console.log("Володар:", owner.address);
  console.log("Трейдер:", trader.address);

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

  console.log("\nТокен A:", tokenAAddress);
  console.log("Токен B:", tokenBAddress);

  await (
    await tokenA.transfer(trader.address, ethers.parseEther("5000"))
  ).wait();

  await (
    await tokenB.transfer(trader.address, ethers.parseEther("5000"))
  ).wait();

  console.log("\nТрейдер отримав 5000 SIK і 5000 MFT");

  const pool = await ethers.deployContract("DexPool", [
    tokenAAddress,
    tokenBAddress,
  ]);

  await pool.waitForDeployment();

  const poolAddress = await pool.getAddress();

  console.log("Адреса пулу:", poolAddress);

  const liquidityA = ethers.parseEther("1000");
  const liquidityB = ethers.parseEther("2000");

  await (await tokenA.approve(poolAddress, liquidityA)).wait();
  await (await tokenB.approve(poolAddress, liquidityB)).wait();

  await (
    await pool.addLiquidity(liquidityA, liquidityB)
  ).wait();

  console.log("\nДодали ліквідність:");
  console.log("Резерв A: 1000 SIK");
  console.log("Резерв B: 2000 MFT");
  console.log("Початковий курс: 1 SIK = 2 MFT");

  // 7. Готуємо обмін 50 токенів A
  const tradeAmount = ethers.parseEther("50");

  await (
    await tokenA
      .connect(trader)
      .approve(poolAddress, tradeAmount)
  ).wait();

  const expectedOutput = await pool.getAmountOut(tradeAmount);
  const feePermille = await pool.getFeePermille(tradeAmount);

  console.log("\nОбмін:");
  console.log("Вхідна сума: 50 SIK");
  console.log(
    `Комісія: ${feePermille === 1n ? "0.1%" : "1%"}`
  );
  console.log(
    `Очікувана сума: ${ethers.formatEther(expectedOutput)} MFT`
  );

  const balanceBefore = await tokenB.balanceOf(trader.address);

  const tx = await pool
    .connect(trader)
    .swapAforB(tradeAmount);

  await tx.wait();

  const balanceAfter = await tokenB.balanceOf(trader.address);
  const received = balanceAfter - balanceBefore;

  console.log(
    `Отримано трейдером: ${ethers.formatEther(received)} MFT`
  );

  const reserveA = await pool.reserveA();
  const reserveB = await pool.reserveB();

  console.log("\nСтан резервів після обміну:");
  console.log(`Резерв A: ${ethers.formatEther(reserveA)} SIK`);
  console.log(`Резерв B: ${ethers.formatEther(reserveB)} MFT`);

  const k = reserveA * reserveB;

  console.log(`Константа k: ${k.toString()}`);
  console.log("\nУспішна симуляція");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});