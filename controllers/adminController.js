const userService = require("../services/userService");
const { ROLES } = require("../middleware/authorize");

exports.listUsers = async (req, res) => {
    try {
        const users = await userService.findAllUsers();

        res.json({
            users: users.map((user) => ({
                id: user.ID,
                username: user.USERNAME,
                email: user.EMAIL,
                role: user.ROLE,
                lastLogin: user.LAST_LOGIN,
                createdAt: user.CREATED_AT,
            })),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const targetId = Number(req.params.id);

        if (!Number.isInteger(targetId)) {
            return res.status(400).json({ error: "A valid user id is required" });
        }

        if (targetId === req.currentUser.ID) {
            return res.status(400).json({ error: "You cannot delete your own account" });
        }

        const deleted = await userService.deleteUserById(targetId);

        if (!deleted) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "User deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.updateUserRole = async (req, res) => {
    try {
        const targetId = Number(req.params.id);
        const { role } = req.body || {};

        if (!Number.isInteger(targetId)) {
            return res.status(400).json({ error: "A valid user id is required" });
        }

        if (!Object.values(ROLES).includes(role)) {
            return res.status(400).json({ error: `Role must be one of: ${Object.values(ROLES).join(", ")}` });
        }

        if (targetId === req.currentUser.ID) {
            return res.status(400).json({ error: "You cannot change your own role" });
        }

        const updated = await userService.updateUserRole(targetId, role);

        if (!updated) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({ message: "User role updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};
