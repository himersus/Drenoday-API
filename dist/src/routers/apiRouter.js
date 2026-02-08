"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const User_1 = require("../controller/User");
const dotenv_1 = __importDefault(require("dotenv"));
const userLoged_1 = require("../middleware/userLoged");
const Auth_1 = require("../controller/Auth");
const passport_1 = __importDefault(require("passport"));
const github_1 = require("../controller/github");
const Workspace_1 = require("../controller/Workspace");
const Project_1 = require("../controller/Project");
const member_1 = require("../controller/member");
const Deploy_1 = require("../controller/Deploy");
const Plan_1 = require("../controller/Plan");
const Payment_1 = require("../controller/Payment");
const Notification_1 = require("../controller/Notification");
dotenv_1.default.config();
const router = express_1.default.Router();
// {{AUTH ROUTES}}
router.post('/auth/login', Auth_1.login);
router.post('/auth/email', Auth_1.loginWithEmail);
router.post('/auth/send-code-verification', Auth_1.sendCodeVerification);
router.post('/auth/verify-code', Auth_1.verifyCode);
// {{GITHUB AUTH ROUTES}}
router.get('/auth/github', passport_1.default.authenticate('github', {
    scope: ['read:user', 'user:email', 'repo']
}));
router.get('/auth/github/callback', passport_1.default.authenticate('github', { failureRedirect: '/auth/github' }), Auth_1.loginGitHub);
// {{GOOGLE AUTH ROUTES}}
router.get('/auth/google', (req, res, next) => {
    const create = req.query.create;
    passport_1.default.authenticate('google', {
        scope: ['profile', 'email'],
        state: JSON.stringify({ create })
    })(req, res, next);
});
router.get('/auth/google/callback', passport_1.default.authenticate('google', { failureRedirect: '/auth/google' }), Auth_1.loginGoogle);
// Github 
router.get('/github/list/repo', userLoged_1.verifyAuthentication, github_1.getUserRepos);
router.put('/github/sync', userLoged_1.verifyAuthentication, github_1.syncUserWithGitHub);
router.post('/github/unsync', userLoged_1.verifyAuthentication, github_1.unsyncUserFromGitHub);
// {{USER ROUTES}}
router.post('/user/create', User_1.createUser);
router.get('/user/me', userLoged_1.verifyAuthentication, User_1.UserLoged);
router.get('/user/all', userLoged_1.verifyAuthentication, User_1.getAllUsers);
router.get('/user/each/:userId', userLoged_1.verifyAuthentication, User_1.getUser);
router.put('/user/update', userLoged_1.verifyAuthentication, User_1.updateUser);
// {{Create Workspace ROUTE}}
router.post('/workspace/create', userLoged_1.verifyAuthentication, Workspace_1.createWorkspace);
router.get('/workspace/each/:workspaceId', userLoged_1.verifyAuthentication, Workspace_1.getWorkspace);
router.get('/workspace/all', userLoged_1.verifyAuthentication, Workspace_1.getAllWorkspaces);
router.put('/workspace/update/:workspaceId', userLoged_1.verifyAuthentication, Workspace_1.updateWorkspace);
router.delete('/workspace/delete/:workspaceId', userLoged_1.verifyAuthentication, Workspace_1.deleteWorkspace);
// {{ Member ROUTES}}
router.post('/workspace/member/add', userLoged_1.verifyAuthentication, member_1.addMember);
router.delete('/workspace/member/remove', userLoged_1.verifyAuthentication, member_1.removeMember);
// {{ Project ROUTES}}
router.post('/project/create', userLoged_1.verifyAuthentication, Project_1.createProject);
router.post('/project/run/:projectId', userLoged_1.verifyAuthentication, Project_1.runTheProject);
router.get('/project/each/:projectId', userLoged_1.verifyAuthentication, Project_1.getProject);
router.get('/project/my/:workspaceId', userLoged_1.verifyAuthentication, Project_1.getMyProjects);
router.put('/project/update/:projectId', userLoged_1.verifyAuthentication, Project_1.updateProject);
router.delete('/project/delete/:projectId', userLoged_1.verifyAuthentication, Project_1.deleteProject);
// {{ Deploy ROUTES}}
router.get('/deploy/all/:projectId', userLoged_1.verifyAuthentication, Deploy_1.listDeploys);
router.get('/deploy/each/:deployId', userLoged_1.verifyAuthentication, Deploy_1.getDeploy);
// {{ Plan ROUTES}}
router.post('/plan/create', userLoged_1.verifyAuthentication, Plan_1.addPlan);
router.get('/plan/all', Plan_1.getPlans);
router.get('/plan/each/:planId', Plan_1.getPlanById);
router.delete('/plan/delete/:planId', userLoged_1.verifyAuthentication, Plan_1.deletePlan);
// {{ Pay ROUTES}}
router.post('/pay/create', userLoged_1.verifyAuthentication, Payment_1.createPayment);
router.post('/pay/confirm', userLoged_1.verifyAuthentication, Payment_1.confirmPayment);
router.get('/pay/my', userLoged_1.verifyAuthentication, Payment_1.getUserPayments);
router.get('/pay/each/:paymentId', userLoged_1.verifyAuthentication, Payment_1.getPaymentById);
// {{ API DE PAGAMENTO EXTERNA }}
router.post('/pay/reference', userLoged_1.verifyAuthentication, Payment_1.referenceSendPaymentGateway);
router.post('/pay/webhook', Payment_1.webhookPayment);
// {{ NOTIFICATION ROUTES}}
router.get("/notification/my", userLoged_1.verifyAuthentication, Notification_1.myNotifications);
router.post("/notification/read/:notificationId", userLoged_1.verifyAuthentication, Notification_1.markNotificationAsRead);
router.get("/notification/each/:notificationId", userLoged_1.verifyAuthentication, Notification_1.getOneNotification);
router.get("/cookie/create", github_1.createCookieGitHub);
router.get("/cookie/read", github_1.readCookieGitHub);
exports.default = router;
