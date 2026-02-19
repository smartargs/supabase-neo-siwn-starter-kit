import { Buffer } from "node:buffer";
import { u, wallet } from "@cityofzion/neon-js";

/**
 * Applies the Neo N3 transaction-like message format used by NeoLine's
 * signMessageWithoutSaltV2. This wraps the message in a specific structure
 * that mimics a Neo N3 transaction for Ledger compatibility.
 *
 * Format based on: https://github.com/neow3j/neow3j-docs/issues/21
 */
function n3MessageFormat(message: string): string {
  const parameterHexString = Buffer.from(message).toString("hex");
  const lengthHex = u.num2VarInt(parameterHexString.length / 2);
  const concatenatedString = lengthHex + parameterHexString;

  // N3 transaction-like prefix (version, nonce, fees, validUntilBlock, signers, attributes)
  const prefix =
    "000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000";

  const messageHex = prefix + concatenatedString;

  // Magic number (0, little-endian 4 bytes) + SHA256(messageHex)
  const signHex = u.num2hexstring(0, 4, true) + u.sha256(messageHex);
  return signHex;
}

/**
 * Verifies a Neo N3 signature against a message and public key.
 * Handles the format from NeoLine's signMessageWithoutSaltV2.
 *
 * @param message The raw message string that was signed
 * @param signature Hex-encoded signature
 * @param publicKey Hex-encoded compressed public key
 */
export function verifySignature(
  message: string,
  signature: string,
  publicKey: string,
): boolean {
  try {
    // signMessageWithoutSaltV2 uses the N3 transaction-like format
    const signHex = n3MessageFormat(message);
    return wallet.verify(signHex, signature, publicKey);
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

/**
 * Derives a Neo N3 address from a compressed public key.
 * Uses the official neon-js wallet utility.
 */
export function getAddressFromPublicKey(publicKey: string): string {
  try {
    return new wallet.Account(publicKey).address;
  } catch (err) {
    console.error("Error deriving address from public key:", err);
    throw new Error("Invalid public key");
  }
}
