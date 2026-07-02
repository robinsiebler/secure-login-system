const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const { authenticateToken } = require("../middleware/auth");
const {
    loginLimiter,
    registerLimiter,
    forgotPasswordLimiter,
    resetPasswordLimiter,
    changePasswordLimiter,
} = require("../middleware/rateLimiter");

router.post("/register", registerLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/forgot-password", forgotPasswordLimiter, authController.forgotPassword);
router.post("/reset-password", resetPasswordLimiter, authController.resetPassword);
router.post("/change-password", authenticateToken, changePasswordLimiter, authController.changePassword);
router.get("/profile", authenticateToken, authController.getProfile);
router.get("/dashboard", authenticateToken, authController.getDashboard);

module.exports = router;
