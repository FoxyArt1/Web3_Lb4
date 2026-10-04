// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DexPool {
    using SafeERC20 for IERC20;

    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;

    uint256 public reserveA;
    uint256 public reserveB;

    event Swap(
    address indexed trader,
    uint256 amountIn,
    uint256 amountOut
);

    constructor(address tokenAAddress, address tokenBAddress) {
        require(
            tokenAAddress != address(0) && tokenBAddress != address(0),
            "Invalid token address"
        );

        tokenA = IERC20(tokenAAddress);
        tokenB = IERC20(tokenBAddress);
    }

    function addLiquidity(
        uint256 amountA,
        uint256 amountB
    ) external {
        require(amountA > 0 && amountB > 0, "Amounts must be greater than 0");
        require(reserveA == 0 && reserveB == 0, "Liquidity already added");

        tokenA.safeTransferFrom(msg.sender, address(this), amountA);
        tokenB.safeTransferFrom(msg.sender, address(this), amountB);

        reserveA = amountA;
        reserveB = amountB;
    }

    function getFeePermille(
        uint256 amountIn
    ) public view returns (uint256) {
        require(reserveA > 0, "Pool is empty");

        // Якщо обсяг більший за 5% резерву — комісія 1%
        if (amountIn * 100 > reserveA * 5) {
            return 10;
        }

        // Для угод до 5% включно — комісія 0.1%
        return 1;
    }

    function getAmountOut(
        uint256 amountIn
    ) public view returns (uint256) {
        require(amountIn > 0, "Amount must be greater than 0");
        require(reserveA > 0 && reserveB > 0, "Pool is empty");

        uint256 fee = getFeePermille(amountIn);
        uint256 amountInWithFee = amountIn * (1000 - fee);

        uint256 numerator = reserveB * amountInWithFee;
        uint256 denominator = reserveA * 1000 + amountInWithFee;

        return numerator / denominator;
    }

    function swapAforB(
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        amountOut = getAmountOut(amountIn);

        require(amountOut > 0, "Output amount is 0");
        require(amountOut < reserveB, "Not enough liquidity");

        tokenA.safeTransferFrom(msg.sender, address(this), amountIn);

        reserveA += amountIn;
        reserveB -= amountOut;

        tokenB.safeTransfer(msg.sender, amountOut);
        emit Swap(msg.sender, amountIn, amountOut);
    }
}