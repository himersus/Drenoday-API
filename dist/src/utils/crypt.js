"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptToken = encryptToken;
exports.decryptToken = decryptToken;
const crypto_js_1 = __importDefault(require("crypto-js"));
const key = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
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
