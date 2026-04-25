import express from "express";
import { createUser, getAllUsers, getUser, updateUser, UserLoged } from "../controller/user";
import { verifyAuthentication } from "../middleware/userAuth";
import { login, loginGitHub, loginGoogle, loginWithEmail, sendCodeVerification, verifyCode } from "../controller/auth";
import passport from "passport";
import { createCookieGitHub, getUserBranchesByName, getUserRepoByName, getUserRepos, readCookieGitHub, syncUserWithGitHub, unsyncUserFromGitHub } from "../controller/github";
import { createProject, deleteProject, getAllProjects, getMyProjects, getProject, runTheProject, updateProject } from "../controller/project";
import { addMember, removeMember } from "../controller/member";
import { getDeploy, listDeploys } from "../controller/deploy";
import { addPlan, updatePlan, deletePlan, getPlanById, getPlans } from "../controller/plan";
import { confirmPayment, createPayment, getUserPayments, getPaymentById, referenceSendPaymentGateway, webhookPayment, getAllPayments } from "../controller/payment";
import { getOneNotification, markNotificationAsRead, myNotifications } from "../controller/notification";
import { validate }  from "../middleware/validate";
import * as schemasUser from "../schemas/user";
import * as schemasWorkspace from "../schemas/workspace";
import * as schemasProject from "../schemas/project";
import * as schemasPlan from "../schemas/plan";
import { getMyGeneralMetrics, getServiceMetrics } from "../controller/metrics";

const router = express.Router();

// {{AUTH ROUTES}}
router.post('/auth/login', validate(schemasUser.loginUserSchema), login);
router.post('/auth/email', validate(schemasUser.sendCodeVerificationSchema), loginWithEmail);
router.post('/auth/send-code-verification', validate(schemasUser.sendCodeVerificationSchema), sendCodeVerification);
router.post('/auth/verify-code', validate(schemasUser.verifyCodeSchema), verifyCode);

// {{GITHUB AUTH ROUTES}}
router.get('/auth/github',
    passport.authenticate('github', {
        scope: ['read:user', 'user:email', 'repo'],
        session: false
    })
);

router.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/auth/github', session: false }), loginGitHub);

// {{GOOGLE AUTH ROUTES}}
router.get('/auth/google',
  (req, res, next) => {
    const create = req.query.create;
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      state: JSON.stringify({ create }),
      session: false
    })(req, res, next);
  }
);

router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/auth/google', session: false }), loginGoogle);

// Github 
router.get('/github/list/repo', verifyAuthentication, getUserRepos);
router.get('/github/list/repo/:name', verifyAuthentication, getUserRepos);
router.get('/github/list/repo/:owner/:repo', verifyAuthentication, getUserRepoByName);
router.get('/github/list/branches/:owner/:repo', verifyAuthentication, getUserBranchesByName);
router.put('/github/sync', verifyAuthentication, syncUserWithGitHub);
router.post('/github/unsync', verifyAuthentication, unsyncUserFromGitHub);

// {{USER ROUTES}}
router.post('/user/create', validate(schemasUser.createUserSchema), createUser);
router.get('/user/me', verifyAuthentication, UserLoged);
router.get('/user/all', verifyAuthentication, getAllUsers);
router.get('/user/each/:userId', verifyAuthentication, getUser);
router.put('/user/update', validate(schemasUser.updateUserSchema), updateUser);

// {{Create Workspace ROUTE}}
//router.post('/workspace/create', validate(schemasWorkspace.createWorkspaceSchema), verifyAuthentication, createWorkspace);
//router.get('/workspace/each/:workspaceId', verifyAuthentication, getWorkspace);
//router.get('/workspace/all', verifyAuthentication, getAllWorkspaces);
//router.put('/workspace/update/:workspaceId', validate(schemasWorkspace.updateWorkspaceSchema), verifyAuthentication, updateWorkspace);
//router.delete('/workspace/delete/:workspaceId', verifyAuthentication, deleteWorkspace);

// {{ Member ROUTES}}
router.post('/workspace/member/add', validate(schemasWorkspace.addMemberSchema), verifyAuthentication, addMember);
router.delete('/workspace/member/remove', validate(schemasWorkspace.removeMemberSchema), verifyAuthentication, removeMember);

// {{ Project ROUTES}}
router.post('/project/create', validate(schemasProject.createProjectSchema), verifyAuthentication, createProject);
router.post('/project/run/:projectId', verifyAuthentication, runTheProject);
router.get('/project/each/:projectId', verifyAuthentication, getProject);
router.get('/project/my', verifyAuthentication, getMyProjects);
router.get('/project/metrics/:projectId', verifyAuthentication, getServiceMetrics);
router.get('/project/metrics', verifyAuthentication, getMyGeneralMetrics);

router.get('/backoffice/project/list', verifyAuthentication, getAllProjects);

router.put('/project/update/:projectId', validate(schemasProject.updateProjectSchema), verifyAuthentication, updateProject);
router.delete('/project/delete/:projectId', verifyAuthentication, deleteProject);

// {{ Deploy ROUTES}}
router.get('/deploy/all/:projectId', verifyAuthentication, listDeploys);
router.get('/deploy/each/:deployId', verifyAuthentication, getDeploy);

// {{ Plan ROUTES}}
router.post('/plan/create', validate(schemasPlan.createPlanSchema), verifyAuthentication, addPlan);
router.put('/plan/update/:planId', validate(schemasPlan.updatePlanSchema), verifyAuthentication, updatePlan);
router.get('/plan/all',  getPlans);
router.get('/plan/each/:planId', getPlanById);
router.delete('/plan/delete/:planId', verifyAuthentication, deletePlan);

// {{ Pay ROUTES}}
router.post('/pay/create', verifyAuthentication, createPayment);
router.post('/pay/confirm', verifyAuthentication, confirmPayment);
router.get('/pay/my', verifyAuthentication, getUserPayments);
router.get('/pay/each/:paymentId', verifyAuthentication, getPaymentById);
router.get('/backoffice/pay/list', verifyAuthentication, getAllPayments);

// {{ API DE PAGAMENTO EXTERNA }}
router.post('/pay/reference', verifyAuthentication, referenceSendPaymentGateway);
router.post('/pay/webhook', webhookPayment);

// {{ NOTIFICATION ROUTES}}
router.get("/notification/my", verifyAuthentication, myNotifications);
router.post("/notification/read/:notificationId", verifyAuthentication, markNotificationAsRead);
router.get("/notification/each/:notificationId", verifyAuthentication, getOneNotification);


router.get("/cookie/create", createCookieGitHub);
router.get("/cookie/read", readCookieGitHub);
export default router;