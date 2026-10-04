// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IUniswapV2Router02} from
    "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract DefiIntegrator {
    IUniswapV2Router02 public immutable router;

    constructor(address routerAddress) {
        require(routerAddress != address(0), "Invalid router address");
        router = IUniswapV2Router02(routerAddress);
    }

    function provideLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired
    ) external {
        require(
            IERC20(tokenA).transferFrom(
                msg.sender,
                address(this),
                amountADesired
            ),
            "Token A transfer failed"
        );

        require(
            IERC20(tokenB).transferFrom(
                msg.sender,
                address(this),
                amountBDesired
            ),
            "Token B transfer failed"
        );

        IERC20(tokenA).approve(address(router), amountADesired);
        IERC20(tokenB).approve(address(router), amountBDesired);

        router.addLiquidity(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            1,
            1,
            msg.sender,
            block.timestamp + 300
        );
    }

    function swapTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin
    ) external {
        require(
            IERC20(tokenIn).transferFrom(
                msg.sender,
                address(this),
                amountIn
            ),
            "Token transfer failed"
        );

        IERC20(tokenIn).approve(address(router), amountIn);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            msg.sender,
            block.timestamp + 300
        );
    }
}