"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const user_1 = require("../controller/user");
const userAuth_1 = require("../middleware/userAuth");
const auth_1 = require("../controller/auth");
const passport_1 = __importDefault(require("passport"));
const github_1 = require("../controller/github");
const project_1 = require("../controller/project");
const member_1 = require("../controller/member");
const deploy_1 = require("../controller/deploy");
const plan_1 = require("../controller/plan");
const payment_1 = require("../controller/payment");
const notification_1 = require("../controller/notification");
const validate_1 = require("../middleware/validate");
const schemasUser = __importStar(require("../schemas/user"));
const schemasWorkspace = __importStar(require("../schemas/workspace"));
const schemasProject = __importStar(require("../schemas/project"));
const schemasPlan = __importStar(require("../schemas/plan"));
const metrics_1 = require("../controller/metrics");
const environment_1 = require("../controller/environment");
const router = express_1.default.Router();
// {{AUTH ROUTES}}
router.post('/auth/login', (0, validate_1.validate)(schemasUser.loginUserSchema), auth_1.login);
router.post('/auth/email', (0, validate_1.validate)(schemasUser.sendCodeVerificationSchema), auth_1.loginWithEmail);
router.post('/auth/send-code-verification', (0, validate_1.validate)(schemasUser.sendCodeVerificationSchema), auth_1.sendCodeVerification);
router.post('/auth/verify-code', (0, validate_1.validate)(schemasUser.verifyCodeSchema), auth_1.verifyCode);
// {{GITHUB AUTH ROUTES}}
router.get('/auth/github', passport_1.default.authenticate('github', {
    scope: ['read:user', 'user:email', 'repo'],
    session: false
}));
router.get('/auth/github/callback', passport_1.default.authenticate('github', { failureRedirect: '/auth/github', session: false }), auth_1.loginGitHub);
// {{GOOGLE AUTH ROUTES}}
router.get('/auth/google', (req, res, next) => {
    const create = req.query.create;
    passport_1.default.authenticate('google', {
        scope: ['profile', 'email'],
        state: JSON.stringify({ create }),
        session: false
    })(req, res, next);
});
router.get('/auth/google/callback', passport_1.default.authenticate('google', { failureRedirect: '/auth/google', session: false }), auth_1.loginGoogle);
// Github 
router.get('/github/list/repo', userAuth_1.verifyAuthentication, github_1.getUserRepos);
router.get('/github/list/repo/:name', userAuth_1.verifyAuthentication, github_1.getUserRepos);
router.get('/github/list/repo/:owner/:repo', userAuth_1.verifyAuthentication, github_1.getUserRepoByName);
router.get('/github/list/branches/:owner/:repo', userAuth_1.verifyAuthentication, github_1.getUserBranchesByName);
router.put('/github/sync', userAuth_1.verifyAuthentication, github_1.syncUserWithGitHub);
router.post('/github/unsync', userAuth_1.verifyAuthentication, github_1.unsyncUserFromGitHub);
// {{USER ROUTES}}
router.post('/user/create', (0, validate_1.validate)(schemasUser.createUserSchema), user_1.createUser);
router.get('/user/me', userAuth_1.verifyAuthentication, user_1.UserLoged);
router.get('/user/all', userAuth_1.verifyAuthentication, user_1.getAllUsers);
router.get('/user/each/:userId', userAuth_1.verifyAuthentication, user_1.getUser);
router.put('/user/update', (0, validate_1.validate)(schemasUser.updateUserSchema), user_1.updateUser);
// {{Create Workspace ROUTE}}
//router.post('/workspace/create', validate(schemasWorkspace.createWorkspaceSchema), verifyAuthentication, createWorkspace);
//router.get('/workspace/each/:workspaceId', verifyAuthentication, getWorkspace);
//router.get('/workspace/all', verifyAuthentication, getAllWorkspaces);
//router.put('/workspace/update/:workspaceId', validate(schemasWorkspace.updateWorkspaceSchema), verifyAuthentication, updateWorkspace);
//router.delete('/workspace/delete/:workspaceId', verifyAuthentication, deleteWorkspace);
// {{ Member ROUTES}}
router.post('/workspace/member/add', (0, validate_1.validate)(schemasWorkspace.addMemberSchema), userAuth_1.verifyAuthentication, member_1.addMember);
router.delete('/workspace/member/remove', (0, validate_1.validate)(schemasWorkspace.removeMemberSchema), userAuth_1.verifyAuthentication, member_1.removeMember);
router.get('/workspace/member/list/:projectId', userAuth_1.verifyAuthentication, member_1.listMembers);
// {{ Project ROUTES}}
router.post('/project/create', (0, validate_1.validate)(schemasProject.createProjectSchema), userAuth_1.verifyAuthentication, project_1.createProject);
router.post('/project/run/:projectId', userAuth_1.verifyAuthentication, project_1.runTheProject);
router.get('/project/each/:projectId', userAuth_1.verifyAuthentication, project_1.getProject);
router.get('/project/my', userAuth_1.verifyAuthentication, project_1.getMyProjects);
router.get('/project/metrics/:projectId', userAuth_1.verifyAuthentication, metrics_1.getServiceMetrics);
router.get('/project/metrics', userAuth_1.verifyAuthentication, metrics_1.getMyGeneralMetrics);
// {{ ENVIRENETS }}
router.post("/env/save/:projectId", (0, validate_1.validate)(schemasProject.saveEnvSchema), userAuth_1.verifyAuthentication, environment_1.saveEnvVars);
router.get("/env/list/:projectId", userAuth_1.verifyAuthentication, environment_1.getEnvVars);
router.delete("/env/delete/:projectId/:envId", userAuth_1.verifyAuthentication, environment_1.deleteEnvVar);
router.put('/project/update/:projectId', (0, validate_1.validate)(schemasProject.updateProjectSchema), userAuth_1.verifyAuthentication, project_1.updateProject);
router.delete('/project/delete/:projectId', userAuth_1.verifyAuthentication, project_1.deleteProject);
// {{ Deploy ROUTES}}
router.get('/deploy/all/:projectId', userAuth_1.verifyAuthentication, deploy_1.listDeploys);
router.get('/deploy/each/:deployId', userAuth_1.verifyAuthentication, deploy_1.getDeploy);
// {{ Plan ROUTES}}
router.post('/plan/create', (0, validate_1.validate)(schemasPlan.createPlanSchema), userAuth_1.verifyAuthentication, plan_1.addPlan);
router.put('/plan/update/:planId', (0, validate_1.validate)(schemasPlan.updatePlanSchema), userAuth_1.verifyAuthentication, plan_1.updatePlan);
router.get('/plan/all', plan_1.getPlans);
router.get('/plan/each/:planId', plan_1.getPlanById);
router.delete('/plan/delete/:planId', userAuth_1.verifyAuthentication, plan_1.deletePlan);
// {{ Pay ROUTES}}
router.post('/pay/create', userAuth_1.verifyAuthentication, payment_1.createPayment);
router.post('/pay/confirm', userAuth_1.verifyAuthentication, payment_1.confirmPayment);
router.get('/pay/my', userAuth_1.verifyAuthentication, payment_1.getUserPayments);
router.get('/pay/each/:paymentId', userAuth_1.verifyAuthentication, payment_1.getPaymentById);
// {{ API DE PAGAMENTO EXTERNA }}
router.post('/pay/reference', userAuth_1.verifyAuthentication, payment_1.referenceSendPaymentGateway);
router.post('/pay/webhook', payment_1.webhookPayment);
// {{ NOTIFICATION ROUTES}}
router.get("/notification/my", userAuth_1.verifyAuthentication, notification_1.myNotifications);
router.post("/notification/read/:notificationId", userAuth_1.verifyAuthentication, notification_1.markNotificationAsRead);
router.get("/notification/each/:notificationId", userAuth_1.verifyAuthentication, notification_1.getOneNotification);
router.get("/metrics/general", userAuth_1.verifyAuthentication, metrics_1.getVpsMetrics);
router.get('/backoffice/project/list', userAuth_1.verifyAuthentication, project_1.getAllProjects);
router.get('/backoffice/pay/list', userAuth_1.verifyAuthentication, payment_1.getAllPayments);
router.get("/cookie/create", github_1.createCookieGitHub);
router.get("/cookie/read", github_1.readCookieGitHub);
exports.default = router;
