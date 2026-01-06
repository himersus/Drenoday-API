import express from "express";
import { createUser, getAllUsers, getUser, updateUser, UserLoged } from "../controller/User";
import dotenv from 'dotenv';
import { verifyAuthentication } from "../middleware/userLoged";
import { login, loginGitHub, loginGoogle, sendCodeVerification, verifyCode } from "../controller/Auth";
import passport from "passport";
import { getUserRepos, syncUserWithGitHub } from "../controller/github";
import { createWorkspace, deleteWorkspace, getAllWorkspaces, getWorkspace, updateWorkspace } from "../controller/Workspace";
import { createProject, deleteProject, getMyProjects, getProject, runTheProject, updateProject } from "../controller/Project";
import { addMember, removeMember } from "../controller/member";
import { getDeploy, listDeploys } from "../controller/Deploy";
import { addPlan, deletePlan, getPlanById, getPlans } from "../controller/Plan";
import { confirmPayment, createPayment, getAllReferences, getAppyPayToken, getPaymentById, getUserPayments, referenceSendPaymentGateway } from "../controller/Payment";

dotenv.config();

const router = express.Router();

// {{AUTH ROUTES}}
router.post('/auth/login', login);
router.post('/auth/send-code-verification', sendCodeVerification);
router.post('/auth/verify-code', verifyCode);

// {{GITHUB AUTH ROUTES}}
router.get('/auth/github',
    passport.authenticate('github', {
        scope: ['read:user', 'user:email', 'repo']
    })
);
router.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/auth/github' }), loginGitHub);

// {{GOOGLE AUTH ROUTES}}
router.get('/auth/google',
  (req, res, next) => {
    const create = req.query.create;

    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state: JSON.stringify({ create })
    })(req, res, next);
  }
);

router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/auth/google' }), loginGoogle);

// Github 
router.get('/github/list/repo', verifyAuthentication, getUserRepos);
router.put('/github/sync', verifyAuthentication, syncUserWithGitHub);

// {{USER ROUTES}}
router.post('/user/create', createUser);
router.get('/user/me', verifyAuthentication, UserLoged);
router.get('/user/all', verifyAuthentication, getAllUsers);
router.get('/user/each/:userId', verifyAuthentication, getUser);
router.put('/user/update', verifyAuthentication, updateUser);

// {{Create Workspace ROUTE}}
router.post('/workspace/create', verifyAuthentication, createWorkspace);
router.get('/workspace/each/:workspaceId', verifyAuthentication, getWorkspace);
router.get('/workspace/all', verifyAuthentication, getAllWorkspaces);
router.put('/workspace/update/:workspaceId', verifyAuthentication, updateWorkspace);
router.delete('/workspace/delete/:workspaceId', verifyAuthentication, deleteWorkspace);


// {{ Member ROUTES}}
router.post('/workspace/member/add', verifyAuthentication, addMember);
router.delete('/workspace/member/remove', verifyAuthentication, removeMember);

// {{ Project ROUTES}}
router.post('/project/create', verifyAuthentication, createProject);
router.post('/project/run/:projectId', verifyAuthentication, runTheProject);
router.get('/project/each/:projectId', verifyAuthentication, getProject);
router.get('/project/my/:workspaceId', verifyAuthentication, getMyProjects);

router.put('/project/update/:projectId', verifyAuthentication, updateProject);
router.delete('/project/delete/:projectId', verifyAuthentication, deleteProject);

// {{ Deploy ROUTES}}
router.get('/deploy/all/:projectId', verifyAuthentication, listDeploys);
router.get('/deploy/each/:deployId', verifyAuthentication, getDeploy);

// {{ Plan ROUTES}}
router.post('/plan/create', verifyAuthentication, addPlan);
router.get('/plan/all',  getPlans);
router.get('/plan/each/:planId', getPlanById);
router.delete('/plan/delete/:planId', verifyAuthentication, deletePlan);

// {{ Pay ROUTES}}
router.post('/pay/create', verifyAuthentication, createPayment);
router.post('/pay/confirm', verifyAuthentication, confirmPayment);
router.get('/pay/my', verifyAuthentication, getUserPayments);
router.get('/pay/each/:paymentId', verifyAuthentication, getPaymentById);

// {{ API de pagamento }}
router.get('/pay/token', getAppyPayToken);
router.post('/pay/reference', referenceSendPaymentGateway);
router.get('/pay/reference', getAllReferences);




export default router;