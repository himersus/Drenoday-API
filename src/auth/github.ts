import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackURL: process.env.GITHUB_CALLBACK_URL!,
    scope: ["read:user", "user:email"],
    passReqToCallback: true,
    userProfileURL: "https://api.github.com/user"
},
async (req : any, accessToken: string, refreshToken: string, profile: any, done: any) => {

    try {
        // 1. Buscar todos emails manualmente
        const res = await fetch("https://api.github.com/user/emails", {
            headers: {
                "User-Agent": "drenoday",
                "Authorization": `token ${accessToken}`,
                "Accept": "application/vnd.github+json",
            }
        });

        const emails = await res.json();

        const primary = emails.find((e: any) => e.primary && e.verified);

        if (!primary) {
            return done(new Error("Nenhum email verificado no GitHub."));
        }

        // 2. Forçar email dentro do profile
        profile.emails = [{ value: primary.email }];

        return done(null, profile);

    } catch (error) {
        return done(error);
    }
}));

passport.serializeUser((user: any, done: any) => done(null, user));
passport.deserializeUser((user: any, done: any) => done(null, user));

export default passport;

