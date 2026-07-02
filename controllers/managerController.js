const userService = require("../services/userService");
const { ROLES } = require("../middleware/authorize");
const logger = require("../utils/logger");

exports.listEmployees = async (req, res) => {
    try {
        const employees = await userService.findAllEmployees();

        res.json({
            employees: employees.map((user) => ({
                id: user.ID,
                username: user.USERNAME,
                email: user.EMAIL,
                role: user.ROLE,
                lastLogin: user.LAST_LOGIN,
                createdAt: user.CREATED_AT,
            })),
        });
    } catch (err) {
        logger.logError(req, err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.deleteEmployee = async (req, res) => {
    try {
        const targetId = Number(req.params.id);

        if (!Number.isInteger(targetId)) {
            return res.status(400).json({ error: "A valid user id is required" });
        }

        const target = await userService.findUserById(targetId);

        if (!target) {
            return res.status(404).json({ error: "User not found" });
        }

        if (target.ROLE !== ROLES.EMPLOYEE) {
            return res.status(403).json({ error: "Managers can only remove employees" });
        }

        await userService.deleteUserById(targetId);

        res.json({ message: "Employee removed successfully" });
    } catch (err) {
        logger.logError(req, err);
        res.status(500).json({ error: "Server error" });
    }
};
