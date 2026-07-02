const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const { authenticateToken } = require("../middleware/auth");
const { authorizeRoles, ROLES } = require("../middleware/authorize");
const { adminActionLimiter } = require("../middleware/rateLimiter");

router.use(authenticateToken, authorizeRoles(ROLES.ADMIN), adminActionLimiter);

router.get("/users", adminController.listUsers);
router.delete("/users/:id", adminController.deleteUser);
router.put("/users/:id/role", adminController.updateUserRole);

module.exports = router;
