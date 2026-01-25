import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackURL: process.env.GITHUB_CALLBACK_URL!,
    passReqToCallback: true,
    scope: ["user:email"],
    userProfileURL: "https://api.github.com/user"
},
    async (req: any, accessToken: string, refreshToken: string, profile: any, done: any) => {

        try {
            profile.token = accessToken;
            profile.email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
            return done(null, profile);
        } catch (error) {
            return done(error);
        }
    }));

passport.serializeUser((user: any, done: any) => done(null, user));
passport.deserializeUser((user: any, done: any) => done(null, user));

export default passport;

