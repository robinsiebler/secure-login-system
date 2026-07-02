const userService = require("../services/userService");
const { ROLES } = require("../middleware/authorize");
const { ValidationError, AuthError, NotFoundError } = require("../utils/errors");

exports.listEmployees = async (req, res) => {
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
};

exports.deleteEmployee = async (req, res) => {
    const targetId = Number(req.params.id);

    if (!Number.isInteger(targetId)) {
        throw new ValidationError("A valid user id is required");
    }

    const target = await userService.findUserById(targetId);

    if (!target) {
        throw new NotFoundError("User not found");
    }

    if (target.ROLE !== ROLES.EMPLOYEE) {
        throw new AuthError("Managers can only remove employees", 403);
    }

    await userService.deleteUserById(targetId);

    res.json({ message: "Employee removed successfully" });
};
