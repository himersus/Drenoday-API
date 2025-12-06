import express from "express";
import { createUser, getUser, updateUser, UserLoged } from "../controller/User";
import dotenv from 'dotenv';
import { AuthUser } from "../middleware/userLoged";
dotenv.config();

const router = express.Router();

// {{USER ROUTES}}
router.post('/user/create', createUser);
router.get('/user/me', AuthUser, UserLoged);
router.put('/user/:id', AuthUser, updateUser);


// {{Create Workspace ROUTE}}

export default router;