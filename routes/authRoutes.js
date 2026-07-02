const express = require("express");
const router = express.Router();

const authController = require("../controllers/authControllers");
const { authenticateToken } = require("../middleware/auth");
const { loginLimiter, registerLimiter } = require("../middleware/rateLimiter");

router.post("/register", registerLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.get("/profile", authenticateToken, authController.getProfile);

module.exports = router;
