// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FheSpike
/// @notice Phase 2 spike only. It accepts an encrypted amount from the browser and adds it to an
///         encrypted running total, to prove the encrypt -> submit -> compute -> decrypt path.
/// @dev Phase 3 replaces this with DatasetRegistry and Marketplace. The per-submitter
///      `FHE.allow(_total, msg.sender)` below is a spike shortcut: it lets every submitter decrypt
///      the running total. Phase 3 must NOT copy it. Buyers are granted aggregate handles only (MKT-07).
contract FheSpike is ZamaEthereumConfig {
    euint64 private _total;

    event Submitted(address indexed sender, euint64 total);

    function submit(externalEuint64 amount, bytes calldata inputProof) external {
        euint64 v = FHE.fromExternal(amount, inputProof);
        _total = FHE.add(_total, v);
        FHE.allowThis(_total);
        FHE.allow(_total, msg.sender);
        emit Submitted(msg.sender, _total);
    }

    function total() external view returns (euint64) {
        return _total;
    }
}
