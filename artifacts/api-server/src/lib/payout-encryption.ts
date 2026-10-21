import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getEncryptionKey(): Buffer {
  const value = process.env.PAYOUT_DETAILS_ENCRYPTION_KEY;
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("PAYOUT_DETAILS_ENCRYPTION_KEY must be a 32-byte hex key");
  }
  return Buffer.from(value, "hex");
}

export function encryptPayoutAccountNumber(accountNumber: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(accountNumber, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("hex"))
    .join(":");
}

export function decryptPayoutAccountNumber(encrypted: string): string {
  const [ivHex, tagHex, ciphertextHex] = encrypted.split(":");
  if (!ivHex || !tagHex || !ciphertextHex) {
    throw new Error("Stored payout account details are invalid");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
