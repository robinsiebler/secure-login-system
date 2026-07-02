const express = require("express");
const router = express.Router();

const authController = require("../controllers/authControllers");
const { authenticateToken } = require("../middleware/auth");
const { loginLimiter, registerLimiter, forgotPasswordLimiter, resetPasswordLimiter } = require("../middleware/rateLimiter");

router.post("/register", registerLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/forgot-password", forgotPasswordLimiter, authController.forgotPassword);
router.post("/reset-password", resetPasswordLimiter, authController.resetPassword);
router.get("/profile", authenticateToken, authController.getProfile);

module.exports = router;
