// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ZeroGPrecompiles} from "./ZeroGPrecompiles.sol";

interface IDASigners {
    function epochNumber() external view returns (uint256);
    function getQuorumCount(uint256 epoch) external view returns (uint256);
}

contract CoalReceiptAnchor {
    error ZeroHash();

    event ReceiptAnchored(
        bytes32 indexed receiptHash,
        bytes32 indexed artifactRoot,
        bytes32 indexed subjectHash,
        address submitter,
        uint256 daEpoch,
        address daSignersPrecompile,
        address wrapped0GBasePrecompile
    );

    event EntitlementAnchored(
        bytes32 indexed entitlementHash,
        bytes32 indexed artifactRoot,
        bytes32 indexed subjectHash,
        address submitter,
        uint256 daEpoch,
        address daSignersPrecompile,
        address wrapped0GBasePrecompile
    );

    event ProfileAnchored(
        bytes32 indexed profileHash,
        bytes32 indexed artifactRoot,
        bytes32 indexed merchantHash,
        address submitter,
        uint256 daEpoch,
        address daSignersPrecompile,
        address wrapped0GBasePrecompile
    );

    /**
     * @notice Query the current DA epoch from the DASigners precompile.
     * @dev Falls back to 0 if the precompile call fails (e.g. on non-0G chains).
     */
    function _currentDAEpoch() internal view returns (uint256) {
        try IDASigners(ZeroGPrecompiles.DA_SIGNERS).epochNumber() returns (uint256 epoch) {
            return epoch;
        } catch {
            return 0;
        }
    }

    function anchorReceipt(bytes32 receiptHash, bytes32 artifactRoot, bytes32 subjectHash) external {
        _guardNonZero(receiptHash, artifactRoot, subjectHash);
        uint256 epoch = _currentDAEpoch();
        emit ReceiptAnchored(
            receiptHash,
            artifactRoot,
            subjectHash,
            msg.sender,
            epoch,
            ZeroGPrecompiles.DA_SIGNERS,
            ZeroGPrecompiles.WRAPPED_0G_BASE
        );
    }

    function anchorEntitlement(bytes32 entitlementHash, bytes32 artifactRoot, bytes32 subjectHash) external {
        _guardNonZero(entitlementHash, artifactRoot, subjectHash);
        uint256 epoch = _currentDAEpoch();
        emit EntitlementAnchored(
            entitlementHash,
            artifactRoot,
            subjectHash,
            msg.sender,
            epoch,
            ZeroGPrecompiles.DA_SIGNERS,
            ZeroGPrecompiles.WRAPPED_0G_BASE
        );
    }

    function anchorProfile(bytes32 profileHash, bytes32 artifactRoot, bytes32 merchantHash) external {
        _guardNonZero(profileHash, artifactRoot, merchantHash);
        uint256 epoch = _currentDAEpoch();
        emit ProfileAnchored(
            profileHash,
            artifactRoot,
            merchantHash,
            msg.sender,
            epoch,
            ZeroGPrecompiles.DA_SIGNERS,
            ZeroGPrecompiles.WRAPPED_0G_BASE
        );
    }

    function precompileAddresses() external pure returns (address daSigners, address wrapped0GBase) {
        return (ZeroGPrecompiles.DA_SIGNERS, ZeroGPrecompiles.WRAPPED_0G_BASE);
    }

    function currentDAEpoch() external view returns (uint256) {
        return _currentDAEpoch();
    }

    function _guardNonZero(bytes32 hashA, bytes32 hashB, bytes32 hashC) private pure {
        if (hashA == bytes32(0) || hashB == bytes32(0) || hashC == bytes32(0)) {
            revert ZeroHash();
        }
    }
}
