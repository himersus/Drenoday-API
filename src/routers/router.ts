import express from "express";
import { createUser, getUser, updateUser, UserLoged } from "../controller/User";
import dotenv from 'dotenv';
import { AuthUser } from "../middleware/userLoged";
import { login, sendCodeVerification } from "../controller/Auth";
import { send } from "process";
dotenv.config();

const router = express.Router();

// {{AUTH ROUTES}}
router.post('/auth/login', login);
router.post('/auth/send-code-verification', sendCodeVerification);
router.post('/auth/verify-code', sendCodeVerification);

// {{USER ROUTES}}
router.post('/user/create', createUser);
router.get('/user/me', AuthUser, UserLoged);
router.put('/user/:id', AuthUser, updateUser);


// {{Create Workspace ROUTE}}
router.get('/workspace/create', AuthUser, getUser);

export default router;