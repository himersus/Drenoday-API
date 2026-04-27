"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptEnv = exports.encryptEnv = void 0;
exports.encryptToken = encryptToken;
exports.decryptToken = decryptToken;
const crypto_js_1 = __importDefault(require("crypto-js"));
const crypto_1 = __importDefault(require("crypto"));
const key = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
const ENCRYPTION_KEY = crypto_1.default
    .createHash("sha256")
    .update(process.env.ENV_ENCRYPTION_KEY)
    .digest();
const IV_LENGTH = 16;
function encryptToken(token) {
    // AES encrypt
    const encrypted = crypto_js_1.default.AES.encrypt(token, key).toString();
    // camada extra segura (evita corrupção de string)
    const safe = Buffer.from(encrypted, "utf-8").toString("base64");
    return safe;
}
function decryptToken(safe) {
    // voltar ao formato original
    const encrypted = Buffer.from(safe, "base64").toString("utf-8");
    // decrypt
    const bytes = crypto_js_1.default.AES.decrypt(encrypted, key);
    const token = bytes.toString(crypto_js_1.default.enc.Utf8);
    if (!token) {
        return null;
    }
    return token;
}
const encryptEnv = (text) => {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
};
exports.encryptEnv = encryptEnv;
const decryptEnv = (text) => {
    const [ivHex, encryptedHex] = text.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decipher = crypto_1.default.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]).toString();
};
exports.decryptEnv = decryptEnv;
