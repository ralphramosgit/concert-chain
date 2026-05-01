// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract Ticket is ERC721Enumerable, AccessControl {
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant CHECKIN_ROLE = keccak256("CHECKIN_ROLE");

    uint256 private _nextTokenId;
    string private _baseTokenURI;

    mapping(uint256 tokenId => uint256 eventId) private _ticketEventIds;
    mapping(uint256 tokenId => uint256 primaryPrice) private _primaryPrices;
    mapping(uint256 tokenId => bool checkedIn) private _checkedIn;

    event TicketMinted(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        address indexed to,
        uint256 primaryPrice
    );
    event TicketTransferRecorded(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        address indexed from,
        address to
    );
    event TicketCheckedIn(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        address indexed attendee,
        address operator
    );
    event BaseURIUpdated(string newBaseURI);

    error InvalidAddress();
    error TicketDoesNotExist(uint256 tokenId);
    error TicketEventMismatch(uint256 tokenId, uint256 expectedEventId, uint256 actualEventId);
    error TicketAlreadyCheckedIn(uint256 tokenId);
    error CheckedInTicketIsNonTransferable(uint256 tokenId);

    constructor(address admin, string memory baseTokenURI_) ERC721("Concert Chain Ticket", "CCTIX") {
        if (admin == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _setBaseURI(baseTokenURI_);
    }

    function mint(address to, uint256 eventId, uint256 primaryPrice)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        if (to == address(0)) revert InvalidAddress();

        tokenId = _nextTokenId++;
        _ticketEventIds[tokenId] = eventId;
        _primaryPrices[tokenId] = primaryPrice;
        _safeMint(to, tokenId);

        emit TicketMinted(tokenId, eventId, to, primaryPrice);
    }

    function markCheckedIn(uint256 tokenId, uint256 eventId, address operator)
        external
        onlyRole(CHECKIN_ROLE)
    {
        _requireExisting(tokenId);

        uint256 actualEventId = _ticketEventIds[tokenId];
        if (actualEventId != eventId) revert TicketEventMismatch(tokenId, eventId, actualEventId);
        if (_checkedIn[tokenId]) revert TicketAlreadyCheckedIn(tokenId);

        _checkedIn[tokenId] = true;
        emit TicketCheckedIn(tokenId, eventId, ownerOf(tokenId), operator);
    }

    function setBaseURI(string calldata newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setBaseURI(newBaseURI);
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    function ticketEventId(uint256 tokenId) external view returns (uint256) {
        _requireExisting(tokenId);
        return _ticketEventIds[tokenId];
    }

    function primaryPrice(uint256 tokenId) external view returns (uint256) {
        _requireExisting(tokenId);
        return _primaryPrices[tokenId];
    }

    function isCheckedIn(uint256 tokenId) external view returns (bool) {
        _requireExisting(tokenId);
        return _checkedIn[tokenId];
    }

    function ticketInfo(uint256 tokenId)
        external
        view
        returns (bool exists_, address owner, uint256 eventId, uint256 price, bool checkedIn_)
    {
        exists_ = _ownerOf(tokenId) != address(0);
        if (!exists_) return (false, address(0), 0, 0, false);

        owner = ownerOf(tokenId);
        eventId = _ticketEventIds[tokenId];
        price = _primaryPrices[tokenId];
        checkedIn_ = _checkedIn[tokenId];
    }

    function tokensOfOwner(address owner) external view returns (uint256[] memory tokenIds) {
        if (owner == address(0)) revert InvalidAddress();

        uint256 count = balanceOf(owner);
        tokenIds = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireExisting(tokenId);

        string memory base = _baseURI();
        return bytes(base).length == 0 ? "" : string.concat(base, tokenId.toString(), ".json");
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address from)
    {
        address currentOwner = _ownerOf(tokenId);
        if (currentOwner != address(0) && to != address(0) && _checkedIn[tokenId]) {
            revert CheckedInTicketIsNonTransferable(tokenId);
        }

        from = super._update(to, tokenId, auth);

        if (from != address(0) && to != address(0)) {
            emit TicketTransferRecorded(tokenId, _ticketEventIds[tokenId], from, to);
        }
    }

    function _increaseBalance(address account, uint128 amount) internal override {
        super._increaseBalance(account, amount);
    }

    function _requireExisting(uint256 tokenId) internal view {
        if (_ownerOf(tokenId) == address(0)) revert TicketDoesNotExist(tokenId);
    }

    function _setBaseURI(string memory newBaseURI) private {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }
}
