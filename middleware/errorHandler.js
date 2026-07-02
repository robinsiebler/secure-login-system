const logger = require("../utils/logger");
const { AppError } = require("../utils/errors");

const ORA_UNIQUE_CONSTRAINT_VIOLATED = 1;

function isOracleError(err) {
    return typeof err.errorNum === "number";
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
        return res.status(400).json({ error: "Invalid JSON in request body" });
    }

    if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Your session has expired. Please log in again." });
    }

    if (err.name === "JsonWebTokenError" || err.name === "NotBeforeError") {
        return res.status(403).json({ error: "Invalid authentication token." });
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
    }

    if (isOracleError(err)) {
        logger.logError(req, err);

        if (err.errorNum === ORA_UNIQUE_CONSTRAINT_VIOLATED) {
            return res.status(409).json({ error: "That value is already in use." });
        }

        return res.status(500).json({ error: "A database error occurred. Please try again." });
    }

    logger.logError(req, err);
    res.status(500).json({ error: "Server error" });
}

module.exports = errorHandler;
