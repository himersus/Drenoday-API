import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackURL: process.env.GITHUB_CALLBACK_URL!,
},
    async (accessToken : string, refreshToken: string, profile: any, done: any) => {
        try {
            const githubId = profile.id;
            const username = profile.username;
            const email = profile.emails?.[0]?.value || null;

            // procurar usuário existente
            let user = await prisma.user.findFirst({
                where: { provider_id: githubId },
            });

            // se não existe → cria
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        provider: "github",
                        name: profile.displayName || username,
                        provider_id: githubId,
                        username: username!,
                        email,
                        password: Math.random().toString(36).slice(-8), // senha aleatória
                        is_active: true,
                    }
                });
            }

            profile.token = accessToken;
            profile.userAuth = user;
            return done(null, profile);
        } catch (error) {
            return done(error, null);
        }
    }
));

passport.serializeUser((user: any, done: any) => done(null, user));
passport.deserializeUser((user: any, done: any) => done(null, user));

export default passport;

