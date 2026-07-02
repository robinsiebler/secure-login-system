const userService = require("../services/userService");
const { ROLES } = require("../middleware/authorize");
const { ValidationError, NotFoundError } = require("../utils/errors");

exports.listUsers = async (req, res) => {
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
};

exports.deleteUser = async (req, res) => {
    const targetId = Number(req.params.id);

    if (!Number.isInteger(targetId)) {
        throw new ValidationError("A valid user id is required");
    }

    if (targetId === req.currentUser.ID) {
        throw new ValidationError("You cannot delete your own account");
    }

    const deleted = await userService.deleteUserById(targetId);

    if (!deleted) {
        throw new NotFoundError("User not found");
    }

    res.json({ message: "User deleted successfully" });
};

exports.updateUserRole = async (req, res) => {
    const targetId = Number(req.params.id);
    const { role } = req.body || {};

    if (!Number.isInteger(targetId)) {
        throw new ValidationError("A valid user id is required");
    }

    if (!Object.values(ROLES).includes(role)) {
        throw new ValidationError(`Role must be one of: ${Object.values(ROLES).join(", ")}`);
    }

    if (targetId === req.currentUser.ID) {
        throw new ValidationError("You cannot change your own role");
    }

    const updated = await userService.updateUserRole(targetId, role);

    if (!updated) {
        throw new NotFoundError("User not found");
    }

    res.json({ message: "User role updated successfully" });
};
