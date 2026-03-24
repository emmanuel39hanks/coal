// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ZeroGPrecompiles} from "./ZeroGPrecompiles.sol";

contract CoalReceiptAnchor {
    error ZeroHash();

    event ReceiptAnchored(
        bytes32 indexed receiptHash,
        bytes32 indexed artifactRoot,
        bytes32 indexed subjectHash,
        address submitter,
        address daSignersPrecompile,
        address wrapped0GBasePrecompile
    );

    event EntitlementAnchored(
        bytes32 indexed entitlementHash,
        bytes32 indexed artifactRoot,
        bytes32 indexed subjectHash,
        address submitter,
        address daSignersPrecompile,
        address wrapped0GBasePrecompile
    );

    event ProfileAnchored(
        bytes32 indexed profileHash,
        bytes32 indexed artifactRoot,
        bytes32 indexed merchantHash,
        address submitter,
        address daSignersPrecompile,
        address wrapped0GBasePrecompile
    );

    function anchorReceipt(bytes32 receiptHash, bytes32 artifactRoot, bytes32 subjectHash) external {
        _guardNonZero(receiptHash, artifactRoot, subjectHash);
        emit ReceiptAnchored(
            receiptHash,
            artifactRoot,
            subjectHash,
            msg.sender,
            ZeroGPrecompiles.DA_SIGNERS,
            ZeroGPrecompiles.WRAPPED_0G_BASE
        );
    }

    function anchorEntitlement(bytes32 entitlementHash, bytes32 artifactRoot, bytes32 subjectHash) external {
        _guardNonZero(entitlementHash, artifactRoot, subjectHash);
        emit EntitlementAnchored(
            entitlementHash,
            artifactRoot,
            subjectHash,
            msg.sender,
            ZeroGPrecompiles.DA_SIGNERS,
            ZeroGPrecompiles.WRAPPED_0G_BASE
        );
    }

    function anchorProfile(bytes32 profileHash, bytes32 artifactRoot, bytes32 merchantHash) external {
        _guardNonZero(profileHash, artifactRoot, merchantHash);
        emit ProfileAnchored(
            profileHash,
            artifactRoot,
            merchantHash,
            msg.sender,
            ZeroGPrecompiles.DA_SIGNERS,
            ZeroGPrecompiles.WRAPPED_0G_BASE
        );
    }

    function precompileAddresses() external pure returns (address daSigners, address wrapped0GBase) {
        return (ZeroGPrecompiles.DA_SIGNERS, ZeroGPrecompiles.WRAPPED_0G_BASE);
    }

    function _guardNonZero(bytes32 hashA, bytes32 hashB, bytes32 hashC) private pure {
        if (hashA == bytes32(0) || hashB == bytes32(0) || hashC == bytes32(0)) {
            revert ZeroHash();
        }
    }
}
