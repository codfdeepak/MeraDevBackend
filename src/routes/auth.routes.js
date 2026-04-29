const express = require("express");
const {
  register,
  login,
  me,
  updateMe,
  getMyPasswordMeta,
  updateMyPassword,
  listUsers,
  updateUserStatus,
  updateUserApproval,
  updateUserFeatureAccess,
  resetUserPassword,
  deleteUser,
} = require("../controllers/auth.controller");
const { authMiddleware } = require("../config/auth");

const router = express.Router();

router.post("/signup", register);
router.post("/login", login);
router.get("/me", authMiddleware, me);
router.patch("/me", authMiddleware, updateMe);
router.get("/me/password-meta", authMiddleware, getMyPasswordMeta);
router.patch("/me/password", authMiddleware, updateMyPassword);
router.get("/users", authMiddleware, listUsers);
router.patch("/users/:userId/status", authMiddleware, updateUserStatus);
router.patch("/users/:userId/approval", authMiddleware, updateUserApproval);
router.patch("/users/:userId/features", authMiddleware, updateUserFeatureAccess);
router.patch("/users/:userId/password", authMiddleware, resetUserPassword);
router.delete("/users/:userId", authMiddleware, deleteUser);

module.exports = router;
