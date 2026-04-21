import CryptoJS from "crypto-js";

const key = process.env.GITHUB_TOKEN_ENCRYPTION_KEY!;

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