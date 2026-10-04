import { network } from "hardhat";
import { writeFileSync } from "node:fs";

const { ethers } = await network.create();

async function main() {
  const [owner, trader] = await ethers.getSigners();

  console.log("Власник:", owner.address);
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

  const pool = await ethers.deployContract("DexPool", [
    tokenAAddress,
    tokenBAddress,
  ]);

  await pool.waitForDeployment();

  const poolAddress = await pool.getAddress();

  console.log("\nToken A:", tokenAAddress);
  console.log("Token B:", tokenBAddress);
  console.log("DexPool:", poolAddress);

  await (
    await tokenA.approve(
      poolAddress,
      ethers.parseEther("1000")
    )
  ).wait();

  await (
    await tokenB.approve(
      poolAddress,
      ethers.parseEther("2000")
    )
  ).wait();

  await (
    await pool.addLiquidity(
      ethers.parseEther("1000"),
      ethers.parseEther("2000")
    )
  ).wait();

  console.log("\nЛіквідність додана: 1000 SIK / 2000 MFT");

  await (
    await tokenA.transfer(
      trader.address,
      ethers.parseEther("500")
    )
  ).wait();

  await (
    await tokenA
      .connect(trader)
      .approve(poolAddress, ethers.parseEther("500"))
  ).wait();

  const amounts = ["10", "20", "50"];

  for (const amount of amounts) {
    const tx = await pool
      .connect(trader)
      .swapAforB(ethers.parseEther(amount));

    const receipt = await tx.wait();

    console.log(
      `Обмін ${amount} SIK done. Hash: ${receipt.hash}`
    );
  }

  const deployment = {
    tokenA: tokenAAddress,
    tokenB: tokenBAddress,
    dexPool: poolAddress,
    owner: owner.address,
    trader: trader.address,
  };

  writeFileSync(
    "deployment.json",
    JSON.stringify(deployment, null, 2)
  );

  console.log("\nАдреси вніс у deployment.json");
  console.log("Розгортку завершено");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});