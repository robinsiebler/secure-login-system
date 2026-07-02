const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

fs.mkdirSync(LOG_DIR, { recursive: true });

function writeToFile(line) {
    fs.appendFile(LOG_FILE, line + "\n", (err) => {
        if (err) {
            console.error("Failed to write to log file:", err.message);
        }
    });
}

function write(level, event, details) {
    const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...details });
    const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

    consoleMethod(entry);
    writeToFile(entry);
}

function logRegistration(req, { username, email }) {
    write("info", "REGISTRATION", { username, email, ip: req.ip });
}

function logLoginSuccess(req, { username }) {
    write("info", "LOGIN_SUCCESS", { username, ip: req.ip });
}

function logLoginFailure(req, { username, reason }) {
    write("warn", "LOGIN_FAILURE", { username, ip: req.ip, reason });
}

function logError(req, err) {
    write("error", "ERROR", { route: req.originalUrl, method: req.method, ip: req.ip, message: err.message, stack: err.stack });
}

module.exports = {
    logRegistration,
    logLoginSuccess,
    logLoginFailure,
    logError,
};
