import express from "express";
import { createUser, getUser, updateUser, UserLoged } from "../controller/User";
import dotenv from 'dotenv';
import { verifyAuthentication } from "../middleware/userLoged";
import { login, sendCodeVerification } from "../controller/Auth";
import { send } from "process";
import passport from "passport";
import { getUserRepos } from "../controller/github";
import { createWorkspace, getWorkspace, updateWorkspace } from "../controller/Workspace";
import { createProject, getMyProjects, getProject } from "../controller/Project";
dotenv.config();

const router = express.Router();

// {{AUTH ROUTES}}
router.post('/auth/login', login);
router.post('/auth/send-code-verification', sendCodeVerification);
router.post('/auth/verify-code', sendCodeVerification);

// {{GITHUB AUTH ROUTES}}
router.get('/auth/github', passport.authenticate('github', { scope: ['profile', 'email'] }));
router.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/auth/login' }), (req, res) => {
    const token = (req.user as any).token;
    // Redireciona para o frontend com o token como query param
    res.json({ token });
});

// Github 
router.get('/github/list/repo',  getUserRepos);

// {{USER ROUTES}}
router.post('/user/create', createUser);
router.get('/user/me', verifyAuthentication, UserLoged);
router.put('/user/:id', verifyAuthentication, updateUser);


// {{Create Workspace ROUTE}}
router.post('/workspace/create', verifyAuthentication, createWorkspace);
router.get('/workspace/get/:workspaceId', verifyAuthentication, getWorkspace);
router.put('/workspace/update/:workspaceId', verifyAuthentication, updateWorkspace);


// Project
router.post('/project/create', verifyAuthentication, createProject);
router.get('/project/get/:projectId', verifyAuthentication, getProject);
router.get('/project/my/:workspaceId', verifyAuthentication, getMyProjects);

export default router;