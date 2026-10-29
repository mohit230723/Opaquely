// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IDatasetRegistry} from "./IDatasetRegistry.sol";

/// Listings, exact-price buy, and a pull-payment ledger. No FHE imports and no ciphertext inputs.
/// The balance is "held until withdrawn", not a true escrow: there is nothing to condition a release on.
contract Marketplace is ReentrancyGuard {
    IDatasetRegistry public immutable registry;

    struct Listing {
        uint256 id;
        uint256 datasetId;
        address seller;
        string title;
        string description;
        uint256 priceWei;
        uint32 recordCount; // snapshot at listing time; the dataset is sealed so it cannot change
        uint8 categoryMask; // seller-declared, public, unverified: bit k set means "has category k"
        uint64 listedAt;
        uint32 salesCount;
    }

    struct PurchaseView {
        uint256 listingId;
        uint256 priceWei;
        uint64 purchasedAt;
    }

    uint256 public listingCount; // ids run 1..listingCount, so 0 means "none"
    mapping(uint256 => Listing) private _listings;
    mapping(uint256 => uint256) public listingOfDataset; // 0 when the dataset is not listed
    mapping(address => uint256[]) private _bySeller;
    mapping(address => PurchaseView[]) private _purchasesBy;
    mapping(uint256 => mapping(address => bool)) public purchased;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(address => uint256) public salesBySeller;

    event Listed(
        uint256 indexed listingId,
        uint256 indexed datasetId,
        address indexed seller,
        uint256 priceWei,
        string title,
        uint64 at
    );
    event Purchased(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 priceWei,
        uint64 at
    );
    event Withdrawn(address indexed seller, uint256 amountWei, uint64 at);

    error InvalidTitle();
    error DescriptionTooLong();
    error ZeroPrice();
    error InvalidCategoryMask();
    error ListingNotFound(uint256 listingId);
    error OwnListing();
    error AlreadyPurchased();
    error PriceChanged(uint256 currentPriceWei, uint256 expectedPriceWei);
    error WrongPayment(uint256 requiredWei, uint256 sentWei);
    error NothingToWithdraw();
    error TransferFailed();

    constructor(IDatasetRegistry registry_) {
        registry = registry_;
    }

    // ---------------------------------------------------------------- seller

    function listDataset(
        uint256 datasetId,
        string calldata title,
        string calldata description,
        uint256 priceWei,
        uint8 categoryMask
    ) external nonReentrant returns (uint256 listingId) {
        uint256 titleLen = bytes(title).length;
        if (titleLen == 0 || titleLen > 320) revert InvalidTitle(); // 4 x the 80 characters the UI allows
        if (bytes(description).length > 1200) revert DescriptionTooLong(); // 4 x 300
        if (priceWei == 0) revert ZeroPrice();
        if (categoryMask >= 64) revert InvalidCategoryMask();

        // The registry reverts (owner, already sealed, too few bills); its error data bubbles up unchanged.
        uint32 recordCount = registry.sealForListing(datasetId, msg.sender);

        listingId = ++listingCount;
        _listings[listingId] = Listing({
            id: listingId,
            datasetId: datasetId,
            seller: msg.sender,
            title: title,
            description: description,
            priceWei: priceWei,
            recordCount: recordCount,
            categoryMask: categoryMask,
            listedAt: uint64(block.timestamp),
            salesCount: 0
        });
        listingOfDataset[datasetId] = listingId;
        _bySeller[msg.sender].push(listingId);
        emit Listed(listingId, datasetId, msg.sender, priceWei, title, uint64(block.timestamp));
    }

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingWithdrawals[msg.sender] = 0; // zero before the call
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount, uint64(block.timestamp));
    }

    // ---------------------------------------------------------------- buyer

    /// `expectedPriceWei` is the price the buyer saw; `msg.value` must equal it exactly.
    function buyListing(uint256 listingId, uint256 expectedPriceWei) external payable nonReentrant {
        Listing storage l = _listings[listingId];
        if (l.id == 0) revert ListingNotFound(listingId);
        if (l.seller == msg.sender) revert OwnListing();
        if (purchased[listingId][msg.sender]) revert AlreadyPurchased();
        if (expectedPriceWei != l.priceWei) revert PriceChanged(l.priceWei, expectedPriceWei);
        if (msg.value != l.priceWei) revert WrongPayment(l.priceWei, msg.value);

        // effects
        purchased[listingId][msg.sender] = true;
        pendingWithdrawals[l.seller] += msg.value;
        l.salesCount += 1;
        salesBySeller[l.seller] += 1;
        _purchasesBy[msg.sender].push(PurchaseView(listingId, msg.value, uint64(block.timestamp)));

        // interaction: the registry is trusted and fixed at construction
        registry.grantAccess(l.datasetId, msg.sender);

        emit Purchased(listingId, msg.sender, l.seller, msg.value, uint64(block.timestamp));
    }

    // ---------------------------------------------------------------- reads (no indexer needed)

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return _listings[listingId]; // id == 0 means "not found"
    }

    /// Newest first. offset 0 is the most recent listing.
    function getListings(uint256 offset, uint256 limit) external view returns (Listing[] memory rows) {
        uint256 total = listingCount;
        if (offset >= total) return new Listing[](0);
        uint256 n = total - offset;
        if (n > limit) n = limit;
        rows = new Listing[](n);
        for (uint256 i = 0; i < n; ++i) rows[i] = _listings[total - offset - i];
    }

    function listingsBySeller(address seller) external view returns (Listing[] memory rows) {
        uint256[] storage ids = _bySeller[seller];
        rows = new Listing[](ids.length);
        for (uint256 i = 0; i < ids.length; ++i) rows[i] = _listings[ids[i]];
    }

    function purchasesByBuyer(address buyer) external view returns (PurchaseView[] memory) {
        return _purchasesBy[buyer];
    }

    function hasAccess(uint256 listingId, address account) external view returns (bool) {
        return purchased[listingId][account];
    }

    function sellerStats(address seller)
        external
        view
        returns (uint256 listings, uint256 sales, uint256 withdrawableWei)
    {
        return (_bySeller[seller].length, salesBySeller[seller], pendingWithdrawals[seller]);
    }
}
