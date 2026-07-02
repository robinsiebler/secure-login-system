const userService = require("../services/userService");
const { AuthError } = require("../utils/errors");

const ROLES = { ADMIN: "ADMIN", MANAGER: "MANAGER", EMPLOYEE: "EMPLOYEE" };

function authorizeRoles(...allowedRoles) {
    return async (req, res, next) => {
        const user = await userService.findUserById(req.user.sub);

        if (!user) {
            throw new AuthError("User not found", 401);
        }

        if (!allowedRoles.includes(user.ROLE)) {
            throw new AuthError("You do not have permission to perform this action", 403);
        }

        req.currentUser = user;
        next();
    };
}

module.exports = { authorizeRoles, ROLES };
