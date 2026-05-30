import crypto from "node:crypto";
import { config } from "../../config.js";

const deriveKey = () =>
  crypto
    .createHash("sha256")
    .update(
      process.env.BANK_INFO_ENCRYPTION_KEY ||
        config.bankInfoEncryptionKey ||
        config.tokenSecret
    )
    .digest();

const encode = (value) => Buffer.from(value).toString("base64url");
const decode = (value) => Buffer.from(value, "base64url");

export const maskAccountNumber = (value = "") => {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "Not available";
  const last4 = digits.slice(-4);
  return `${"*".repeat(Math.max(4, digits.length - 4))}${last4}`;
};

export const normalizeBankInfoInput = (payload = {}) => ({
  bankName: String(payload.bankName || "").trim(),
  accountHolderName: String(payload.accountHolderName || "").trim(),
  accountType: String(payload.accountType || "").trim(),
  routingNumber: String(payload.routingNumber || "").replace(/\D/g, ""),
  accountNumber: String(payload.accountNumber || "").replace(/\D/g, ""),
});

export const encryptBankInfo = (payload) => {
  const normalized = normalizeBankInfoInput(payload);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(normalized), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: [encode(iv), encode(authTag), encode(encrypted)].join("."),
    masked: {
      bankName: normalized.bankName,
      accountHolderName: normalized.accountHolderName,
      accountType: normalized.accountType,
      routingNumber: maskAccountNumber(normalized.routingNumber),
      accountNumber: maskAccountNumber(normalized.accountNumber),
    },
  };
};

export const decryptBankInfo = (encryptedValue) => {
  if (!encryptedValue) {
    return null;
  }

  const [ivPart, tagPart, encryptedPart] = String(encryptedValue).split(".");
  if (!ivPart || !tagPart || !encryptedPart) {
    return null;
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(), decode(ivPart));
  decipher.setAuthTag(decode(tagPart));
  const decrypted = Buffer.concat([
    decipher.update(decode(encryptedPart)),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(decrypted);
};

export const buildMaskedBankInfo = (user) => {
  if (user?.bankInfoMasked) {
    return user.bankInfoMasked;
  }

  const decrypted = decryptBankInfo(user?.bankInfoEncrypted);
  if (!decrypted) {
    return null;
  }

  return {
    bankName: decrypted.bankName,
    accountHolderName: decrypted.accountHolderName,
    accountType: decrypted.accountType,
    routingNumber: maskAccountNumber(decrypted.routingNumber),
    accountNumber: maskAccountNumber(decrypted.accountNumber),
  };
};
