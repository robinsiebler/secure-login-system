const express = require("express");
const router = express.Router();

const managerController = require("../controllers/managerController");
const { authenticateToken } = require("../middleware/auth");
const { authorizeRoles, ROLES } = require("../middleware/authorize");
const { adminActionLimiter } = require("../middleware/rateLimiter");

router.use(authenticateToken, authorizeRoles(ROLES.MANAGER), adminActionLimiter);

router.get("/employees", managerController.listEmployees);
router.delete("/employees/:id", managerController.deleteEmployee);

module.exports = router;
