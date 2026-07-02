const jwt = require("jsonwebtoken");
const { AuthError } = require("../utils/errors");

function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
        throw new AuthError("Authentication token required", 401);
    }

    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
}

module.exports = { authenticateToken };
