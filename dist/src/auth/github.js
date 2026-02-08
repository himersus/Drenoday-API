"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
const passport_github2_1 = require("passport-github2");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
passport_1.default.use(new passport_github2_1.Strategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL,
    passReqToCallback: true,
    scope: ["user:email"],
    userProfileURL: "https://api.github.com/user"
}, async (req, accessToken, refreshToken, profile, done) => {
    const create = req.query.create || 'false';
    try {
        profile.token = accessToken;
        profile.email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        profile.create = create;
        return done(null, profile);
    }
    catch (error) {
        return done(error);
    }
}));
passport_1.default.serializeUser((user, done) => done(null, user));
passport_1.default.deserializeUser((user, done) => done(null, user));
exports.default = passport_1.default;
