// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/// What the Marketplace needs from the registry. No FHE types: Marketplace never imports the FHE library.
interface IDatasetRegistry {
    /// Seals the dataset for sale. Reverts unless `seller` owns it, it is open, and it has enough bills.
    function sealForListing(uint256 datasetId, address seller) external returns (uint32 recordCount);

    /// Gives `buyer` ACL access to the aggregate handles of a sealed dataset. Never the per-bill handles.
    function grantAccess(uint256 datasetId, address buyer) external;
}
