import CryptoJS from "crypto-js";
import crypto from "crypto";

const key = process.env.GITHUB_TOKEN_ENCRYPTION_KEY!;

const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(process.env.ENV_ENCRYPTION_KEY!)
  .digest();
const IV_LENGTH = 16;

export function encryptToken(token: string) {
  // AES encrypt
  const encrypted = CryptoJS.AES.encrypt(token, key).toString();

  // camada extra segura (evita corrupção de string)
  const safe = Buffer.from(encrypted, "utf-8").toString("base64");

  return safe;
}

export function decryptToken(safe: string) {
  // voltar ao formato original
  const encrypted = Buffer.from(safe, "base64").toString("utf-8");

  // decrypt
  const bytes = CryptoJS.AES.decrypt(encrypted, key);
  const token = bytes.toString(CryptoJS.enc.Utf8);

  if (!token) {
    return null;
  }

  return token;
}

export const encryptEnv = (text: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv,
  );
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
};

export const decryptEnv = (text: string): string => {
  const [ivHex, encryptedHex] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv,
  );
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString();
};

