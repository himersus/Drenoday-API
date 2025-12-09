import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackURL: process.env.GITHUB_CALLBACK_URL!,
    passReqToCallback: true,
    userProfileURL: "https://api.github.com/user"
},
    async (req: any, accessToken: string, refreshToken: string, profile: any, done: any) => {

        try {
            profile.token = accessToken;
            return done(null, profile);
        } catch (error) {
            return done(error);
        }
    }));

passport.serializeUser((user: any, done: any) => done(null, user));
passport.deserializeUser((user: any, done: any) => done(null, user));

export default passport;

