// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// TEST ONLY. A contract that acts as a seller (through exec) and tries to re-enter the Marketplace from its
/// receive hook: withdraw() by default, or whatever call was set with arm() (for example buyListing with value).
/// The re-entry attempt is swallowed so the outer withdraw can still complete, and its raw return data is kept
/// so a test can assert the exact revert selector, which proves WHICH guard stopped it.
contract ReentrantSeller {
    address public immutable marketplace;
    uint256 public reentryAttempts;
    bool public reentrySucceeded;
    bytes public reentryPayload; // empty means withdraw()
    uint256 public reentryValue; // wei forwarded with the re-entry call
    bytes public lastReentryReturn; // return or revert data of the last re-entry attempt

    constructor(address marketplace_) {
        marketplace = marketplace_;
    }

    function arm(bytes calldata payload, uint256 value) external {
        reentryPayload = payload;
        reentryValue = value;
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
        bytes memory payload = reentryPayload.length == 0 ? abi.encodeWithSignature("withdraw()") : reentryPayload;
        (bool ok, bytes memory ret) = marketplace.call{value: reentryValue}(payload);
        lastReentryReturn = ret;
        if (ok) reentrySucceeded = true;
    }
}
