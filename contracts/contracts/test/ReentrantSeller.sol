// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// TEST ONLY. A contract that acts as a seller (through exec) and tries to re-enter Marketplace.withdraw
/// from its receive hook. The re-entry attempt is swallowed so the outer withdraw can still complete.
contract ReentrantSeller {
    address public immutable marketplace;
    uint256 public reentryAttempts;
    bool public reentrySucceeded;

    constructor(address marketplace_) {
        marketplace = marketplace_;
    }

    function exec(address target, bytes calldata data) external payable returns (bytes memory out) {
        (bool ok, bytes memory ret) = target.call{value: msg.value}(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        return ret;
    }

    receive() external payable {
        reentryAttempts += 1;
        (bool ok, ) = marketplace.call(abi.encodeWithSignature("withdraw()"));
        if (ok) reentrySucceeded = true;
    }
}
