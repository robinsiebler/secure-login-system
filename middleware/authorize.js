const userService = require("../services/userService");

const ROLES = { ADMIN: "ADMIN", MANAGER: "MANAGER", EMPLOYEE: "EMPLOYEE" };

function authorizeRoles(...allowedRoles) {
    return async (req, res, next) => {
        try {
            const user = await userService.findUserById(req.user.sub);

            if (!user) {
                return res.status(401).json({ error: "User not found" });
            }

            if (!allowedRoles.includes(user.ROLE)) {
                return res.status(403).json({ error: "You do not have permission to perform this action" });
            }

            req.currentUser = user;
            next();
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Server error" });
        }
    };
}

module.exports = { authorizeRoles, ROLES };
