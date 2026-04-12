"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const user_1 = require("../controller/user");
const dotenv_1 = __importDefault(require("dotenv"));
const userLoged_1 = require("../middleware/userLoged");
const auth_1 = require("../controller/auth");
const passport_1 = __importDefault(require("passport"));
const github_1 = require("../controller/github");
const workspace_1 = require("../controller/workspace");
const project_1 = require("../controller/project");
const member_1 = require("../controller/member");
const deploy_1 = require("../controller/deploy");
const plan_1 = require("../controller/plan");
const payment_1 = require("../controller/payment");
const notification_1 = require("../controller/notification");
dotenv_1.default.config();
const router = express_1.default.Router();
// {{AUTH ROUTES}}
router.post('/auth/login', auth_1.login);
router.post('/auth/email', auth_1.loginWithEmail);
router.post('/auth/send-code-verification', auth_1.sendCodeVerification);
router.post('/auth/verify-code', auth_1.verifyCode);
// {{GITHUB AUTH ROUTES}}
router.get('/auth/github', passport_1.default.authenticate('github', {
    scope: ['read:user', 'user:email', 'repo']
}));
router.get('/auth/github/callback', passport_1.default.authenticate('github', { failureRedirect: '/auth/github' }), auth_1.loginGitHub);
// {{GOOGLE AUTH ROUTES}}
router.get('/auth/google', (req, res, next) => {
    const create = req.query.create;
    passport_1.default.authenticate('google', {
        scope: ['profile', 'email'],
        state: JSON.stringify({ create })
    })(req, res, next);
});
router.get('/auth/google/callback', passport_1.default.authenticate('google', { failureRedirect: '/auth/google' }), auth_1.loginGoogle);
// Github 
router.get('/github/list/repo', userLoged_1.verifyAuthentication, github_1.getUserRepos);
router.put('/github/sync', userLoged_1.verifyAuthentication, github_1.syncUserWithGitHub);
router.post('/github/unsync', userLoged_1.verifyAuthentication, github_1.unsyncUserFromGitHub);
// {{USER ROUTES}}
router.post('/user/create', user_1.createUser);
router.get('/user/me', userLoged_1.verifyAuthentication, user_1.UserLoged);
router.get('/user/all', userLoged_1.verifyAuthentication, user_1.getAllUsers);
router.get('/user/each/:userId', userLoged_1.verifyAuthentication, user_1.getUser);
router.put('/user/update', userLoged_1.verifyAuthentication, user_1.updateUser);
// {{Create Workspace ROUTE}}
router.post('/workspace/create', userLoged_1.verifyAuthentication, workspace_1.createWorkspace);
router.get('/workspace/each/:workspaceId', userLoged_1.verifyAuthentication, workspace_1.getWorkspace);
router.get('/workspace/all', userLoged_1.verifyAuthentication, workspace_1.getAllWorkspaces);
router.put('/workspace/update/:workspaceId', userLoged_1.verifyAuthentication, workspace_1.updateWorkspace);
router.delete('/workspace/delete/:workspaceId', userLoged_1.verifyAuthentication, workspace_1.deleteWorkspace);
// {{ Member ROUTES}}
router.post('/workspace/member/add', userLoged_1.verifyAuthentication, member_1.addMember);
router.delete('/workspace/member/remove', userLoged_1.verifyAuthentication, member_1.removeMember);
// {{ Project ROUTES}}
router.post('/project/create', userLoged_1.verifyAuthentication, project_1.createProject);
router.post('/project/run/:projectId', userLoged_1.verifyAuthentication, project_1.runTheProject);
router.get('/project/each/:projectId', userLoged_1.verifyAuthentication, project_1.getProject);
router.get('/project/my/:workspaceId', userLoged_1.verifyAuthentication, project_1.getMyProjects);
router.put('/project/update/:projectId', userLoged_1.verifyAuthentication, project_1.updateProject);
router.delete('/project/delete/:projectId', userLoged_1.verifyAuthentication, project_1.deleteProject);
// {{ Deploy ROUTES}}
router.get('/deploy/all/:projectId', userLoged_1.verifyAuthentication, deploy_1.listDeploys);
router.get('/deploy/each/:deployId', userLoged_1.verifyAuthentication, deploy_1.getDeploy);
// {{ Plan ROUTES}}
router.post('/plan/create', userLoged_1.verifyAuthentication, plan_1.addPlan);
router.get('/plan/all', plan_1.getPlans);
router.get('/plan/each/:planId', plan_1.getPlanById);
router.delete('/plan/delete/:planId', userLoged_1.verifyAuthentication, plan_1.deletePlan);
// {{ Pay ROUTES}}
router.post('/pay/create', userLoged_1.verifyAuthentication, payment_1.createPayment);
router.post('/pay/confirm', userLoged_1.verifyAuthentication, payment_1.confirmPayment);
router.get('/pay/my', userLoged_1.verifyAuthentication, payment_1.getUserPayments);
router.get('/pay/each/:paymentId', userLoged_1.verifyAuthentication, payment_1.getPaymentById);
// {{ API DE PAGAMENTO EXTERNA }}
router.post('/pay/reference', userLoged_1.verifyAuthentication, payment_1.referenceSendPaymentGateway);
router.post('/pay/webhook', payment_1.webhookPayment);
// {{ NOTIFICATION ROUTES}}
router.get("/notification/my", userLoged_1.verifyAuthentication, notification_1.myNotifications);
router.post("/notification/read/:notificationId", userLoged_1.verifyAuthentication, notification_1.markNotificationAsRead);
router.get("/notification/each/:notificationId", userLoged_1.verifyAuthentication, notification_1.getOneNotification);
router.get("/cookie/create", github_1.createCookieGitHub);
router.get("/cookie/read", github_1.readCookieGitHub);
exports.default = router;
