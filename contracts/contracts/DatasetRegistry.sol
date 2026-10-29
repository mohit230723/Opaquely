// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {
    FHE,
    ebool,
    euint8,
    euint32,
    euint64,
    externalEuint8,
    externalEuint32,
    externalEuint64
} from "@fhevm/solidity/lib/FHE.sol";
import {Impl} from "@fhevm/solidity/lib/Impl.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IDatasetRegistry} from "./IDatasetRegistry.sol";

/// Owns the encrypted bills, the FHE math, the ACL and the seal. No ETH ever enters this contract.
/// The seller calls addRecord directly, because an input proof binds (this contract, the sender).
contract DatasetRegistry is ZamaEthereumConfig, IDatasetRegistry {
    // Category ids match web/src/lib/categories.ts: 0 Utilities, 1 Groceries/Food, 2 Medical,
    // 3 Transport/Fuel, 4 Shopping, 5 Other.
    uint8 public constant NUM_CATEGORIES = 6;
    uint32 public constant MIN_BILLS_TO_LIST = 3;
    uint256 public constant MAX_NAME_BYTES = 240; // 4 x the 60 characters the UI allows

    /// A bill above this many cents counts as an anomaly. Plaintext on purpose: a scalar compare is cheaper.
    uint64 public immutable anomalyThresholdCents;
    address public immutable deployer;
    address public marketplace;

    struct Dataset {
        address owner;
        uint32 recordCount; // plaintext on purpose: the min-bills rule and the listing card both need it
        bool isSealed;
        uint64 createdAt;
        string name;
    }

    /// Per-bill ciphertexts. Only the seller is ever granted access to these.
    struct Bill {
        euint64 amountCents;
        euint8 category;
        euint32 dateDays;
    }

    /// The only handles a buyer is ever granted.
    struct Aggregates {
        euint64[6] categoryTotals;
        euint64 grandTotal;
        euint32 recordCount; // encrypted copy of the plaintext count (COMP-02)
        euint32 anomalyCount;
    }

    /// Public view row for the "what the chain sees" panel: handles only.
    struct BillHandles {
        uint32 index;
        euint64 amountCents;
        euint8 category;
        euint32 dateDays;
    }

    struct DatasetView {
        uint256 id;
        address owner;
        string name;
        uint32 recordCount;
        bool isSealed;
        uint64 createdAt;
    }

    uint256 public datasetCount; // ids run 1..datasetCount, so 0 means "none"
    mapping(uint256 => Dataset) private _datasets;
    mapping(uint256 => Bill[]) private _bills;
    mapping(uint256 => Aggregates) private _aggregates;
    mapping(address => uint256[]) private _byOwner;
    mapping(uint256 => mapping(address => bool)) private _access;

    event DatasetCreated(uint256 indexed datasetId, address indexed owner, string name);
    event RecordAdded(uint256 indexed datasetId, address indexed owner, uint32 recordCount);
    event DatasetSealed(uint256 indexed datasetId, uint32 recordCount);
    event AccessGranted(uint256 indexed datasetId, address indexed buyer);
    event MarketplaceSet(address indexed marketplace);

    error InvalidName();
    error DatasetNotFound(uint256 datasetId);
    error NotDatasetOwner();
    error DatasetIsSealed();
    error TooFewBills(uint32 have, uint32 minimum);
    error OnlyMarketplace();
    error NotDeployer();
    error MarketplaceAlreadySet();
    error InvalidMarketplace();
    error NotSealed();

    modifier onlyMarketplace() {
        if (marketplace == address(0) || msg.sender != marketplace) revert OnlyMarketplace();
        _;
    }

    constructor(uint64 anomalyThresholdCents_) {
        anomalyThresholdCents = anomalyThresholdCents_;
        deployer = msg.sender;
    }

    /// One-shot, deployer-only wiring, called by the deploy script right after Marketplace is deployed.
    /// The target must be a deployed contract: an EOA here would be a free read grant on every dataset.
    function setMarketplace(address marketplace_) external {
        if (msg.sender != deployer) revert NotDeployer();
        if (marketplace != address(0)) revert MarketplaceAlreadySet();
        if (marketplace_ == address(0) || marketplace_.code.length == 0) revert InvalidMarketplace();
        marketplace = marketplace_;
        emit MarketplaceSet(marketplace_);
    }

    // ---------------------------------------------------------------- seller writes

    function createDataset(string calldata name) external returns (uint256 datasetId) {
        uint256 len = bytes(name).length;
        if (len == 0 || len > MAX_NAME_BYTES) revert InvalidName();
        datasetId = ++datasetCount;
        _datasets[datasetId] = Dataset({
            owner: msg.sender,
            recordCount: 0,
            isSealed: false,
            createdAt: uint64(block.timestamp),
            name: name
        });
        _byOwner[msg.sender].push(datasetId);
        emit DatasetCreated(datasetId, msg.sender, name);
    }

    /// One bill per transaction. One input proof covers all three handles (one createEncryptedInput batch).
    function addRecord(
        uint256 datasetId,
        externalEuint64 amountExt,
        externalEuint8 categoryExt,
        externalEuint32 dateExt,
        bytes calldata inputProof
    ) external {
        Dataset storage ds = _datasets[datasetId];
        if (ds.owner == address(0)) revert DatasetNotFound(datasetId);
        if (ds.owner != msg.sender) revert NotDatasetOwner();
        if (ds.isSealed) revert DatasetIsSealed();

        euint64 amount = FHE.fromExternal(amountExt, inputProof);
        // A category above 5 cannot match any bucket, so clamp it into "Other" and totals always add up.
        euint8 category = FHE.min(FHE.fromExternal(categoryExt, inputProof), NUM_CATEGORIES - 1);
        euint32 date = FHE.fromExternal(dateExt, inputProof);

        Aggregates storage agg = _aggregates[datasetId];
        euint64 zero = FHE.asEuint64(0);
        for (uint8 k = 0; k < NUM_CATEGORIES; ++k) {
            euint64 part = FHE.select(FHE.eq(category, k), amount, zero);
            agg.categoryTotals[k] = _store(FHE.add(agg.categoryTotals[k], part), msg.sender);
        }
        agg.grandTotal = _store(FHE.add(agg.grandTotal, amount), msg.sender);
        agg.recordCount = _store(FHE.add(agg.recordCount, uint32(1)), msg.sender);
        agg.anomalyCount = _store(
            FHE.add(agg.anomalyCount, FHE.asEuint32(FHE.gt(amount, anomalyThresholdCents))),
            msg.sender
        );

        _bills[datasetId].push(
            Bill({
                amountCents: _store(amount, msg.sender),
                category: _store(category, msg.sender),
                dateDays: _store(date, msg.sender)
            })
        );
        ds.recordCount += 1;
        emit RecordAdded(datasetId, msg.sender, ds.recordCount);
    }

    // ---------------------------------------------------------------- marketplace-only

    function sealForListing(uint256 datasetId, address seller) external onlyMarketplace returns (uint32) {
        Dataset storage ds = _datasets[datasetId];
        if (ds.owner == address(0)) revert DatasetNotFound(datasetId);
        if (ds.owner != seller) revert NotDatasetOwner();
        if (ds.isSealed) revert DatasetIsSealed();
        if (ds.recordCount < MIN_BILLS_TO_LIST) revert TooFewBills(ds.recordCount, MIN_BILLS_TO_LIST);
        ds.isSealed = true;
        emit DatasetSealed(datasetId, ds.recordCount);
        return ds.recordCount;
    }

    function grantAccess(uint256 datasetId, address buyer) external onlyMarketplace {
        if (!_datasets[datasetId].isSealed) revert NotSealed();
        _access[datasetId][buyer] = true;
        Aggregates storage agg = _aggregates[datasetId];
        for (uint8 k = 0; k < NUM_CATEGORIES; ++k) FHE.allow(agg.categoryTotals[k], buyer);
        FHE.allow(agg.grandTotal, buyer);
        FHE.allow(agg.recordCount, buyer);
        FHE.allow(agg.anomalyCount, buyer);
        emit AccessGranted(datasetId, buyer);
    }

    // ---------------------------------------------------------------- reads (no indexer needed)

    function getDataset(uint256 datasetId) external view returns (DatasetView memory) {
        return _view(datasetId);
    }

    function datasetsByOwner(address owner) external view returns (DatasetView[] memory rows) {
        uint256[] storage ids = _byOwner[owner];
        rows = new DatasetView[](ids.length);
        for (uint256 i = 0; i < ids.length; ++i) rows[i] = _view(ids[i]);
    }

    function hasAccess(uint256 datasetId, address account) external view returns (bool) {
        return _access[datasetId][account];
    }

    /// Handles are public on any chain; only the ACL decides who can decrypt them.
    function getAggregates(uint256 datasetId)
        external
        view
        returns (euint64[6] memory categoryTotals, euint64 grandTotal, euint32 recordCount, euint32 anomalyCount)
    {
        Aggregates storage agg = _aggregates[datasetId];
        return (agg.categoryTotals, agg.grandTotal, agg.recordCount, agg.anomalyCount);
    }

    function getBillHandles(uint256 datasetId) external view returns (BillHandles[] memory rows) {
        Bill[] storage bills = _bills[datasetId];
        rows = new BillHandles[](bills.length);
        for (uint256 i = 0; i < bills.length; ++i) {
            rows[i] = BillHandles(uint32(i), bills[i].amountCents, bills[i].category, bills[i].dateDays);
        }
    }

    /// ACL probe for tests and the later "ACL inspector": is `account` persistently allowed on this handle?
    function canAccess(bytes32 handle, address account) external view returns (bool) {
        return Impl.persistAllowed(handle, account); // raw handle: works for any encrypted type
    }

    // ---------------------------------------------------------------- internals

    /// Every new handle needs a fresh grant. These are the only places that store one, so none is forgotten.
    function _store(euint64 h, address owner) private returns (euint64) {
        FHE.allowThis(h);
        FHE.allow(h, owner);
        return h;
    }

    function _store(euint32 h, address owner) private returns (euint32) {
        FHE.allowThis(h);
        FHE.allow(h, owner);
        return h;
    }

    function _store(euint8 h, address owner) private returns (euint8) {
        FHE.allowThis(h);
        FHE.allow(h, owner);
        return h;
    }

    function _view(uint256 datasetId) private view returns (DatasetView memory) {
        Dataset storage ds = _datasets[datasetId];
        return DatasetView(datasetId, ds.owner, ds.name, ds.recordCount, ds.isSealed, ds.createdAt);
    }
}
