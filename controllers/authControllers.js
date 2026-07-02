const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const userService = require("../services/userService");
const passwordResetService = require("../services/passwordResetService");
const passwordHistoryService = require("../services/passwordHistoryService");
const { validateRegistrationInput, validateEmail, validatePassword } = require("../utils/validators");
const { generateResetToken, hashResetToken } = require("../utils/tokens");

const BCRYPT_SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = "1h";

// Precomputed so a failed login (unknown user) takes roughly as long as a
// real password comparison, reducing username-enumeration via response timing.
const DUMMY_HASH = bcrypt.hashSync("timing-attack-mitigation", BCRYPT_SALT_ROUNDS);

async function isPasswordReused(userId, plainPassword) {
    const recentHashes = await passwordHistoryService.getRecentPasswordHashes(userId);

    for (const hash of recentHashes) {
        if (await bcrypt.compare(plainPassword, hash)) {
            return true;
        }
    }

    return false;
}

exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body || {};

        const validationError = validateRegistrationInput({ username, email, password });
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        const existing = await userService.findUserByUsernameOrEmail(username, email);
        if (existing) {
            return res.status(409).json({ error: "Username or email is already in use" });
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        const newUser = await userService.createUser({ username, email, passwordHash });
        await passwordHistoryService.addPasswordToHistory(newUser.id, passwordHash);

        res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password required" });
        }

        const user = await userService.findUserByUsername(username);

        if (!user) {
            await bcrypt.compare(password, DUMMY_HASH);
            return res.status(401).json({ error: "Invalid username or password" });
        }

        if (userService.isAccountLocked(user)) {
            return res.status(423).json({ error: "Account temporarily locked due to repeated failed logins. Try again later." });
        }

        const isMatch = await bcrypt.compare(password, user.PASSWORD_HASH);

        if (!isMatch) {
            await userService.recordFailedLogin(user.ID, user.FAILED_ATTEMPTS);
            return res.status(401).json({ error: "Invalid username or password" });
        }

        await userService.resetFailedLogin(user.ID);

        const token = jwt.sign(
            { sub: user.ID, username: user.USERNAME },
            process.env.JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body || {};

        if (!validateEmail(email)) {
            return res.status(400).json({ error: "A valid email address is required" });
        }

        const user = await userService.findUserByEmail(email);

        if (user) {
            const token = generateResetToken();
            const tokenHash = hashResetToken(token);
            await passwordResetService.createResetToken(user.ID, tokenHash);

            // Stand-in for a real email provider: log the link the user would receive.
            console.log(`Password reset requested for ${email}. Reset link: /?token=${token}`);
        }

        // Same response whether or not the email is registered, so this endpoint
        // can't be used to enumerate valid accounts.
        res.json({ message: "If that email is registered, a password reset link has been sent." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body || {};

        if (!token || typeof token !== "string") {
            return res.status(400).json({ error: "Reset token is required" });
        }

        if (!validatePassword(password)) {
            return res.status(400).json({ error: "Password must be 8-128 characters and include an uppercase letter, a lowercase letter, a number, and a special character" });
        }

        const tokenHash = hashResetToken(token);
        const tokenRow = await passwordResetService.findValidResetToken(tokenHash);

        if (!passwordResetService.isTokenValid(tokenRow)) {
            return res.status(400).json({ error: "Reset link is invalid or has expired" });
        }

        if (await isPasswordReused(tokenRow.USER_ID, password)) {
            return res.status(400).json({ error: `You cannot reuse any of your last ${passwordHistoryService.HISTORY_LIMIT} passwords` });
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        await userService.updateUserPassword(tokenRow.USER_ID, passwordHash);
        await passwordHistoryService.addPasswordToHistory(tokenRow.USER_ID, passwordHash);
        await passwordResetService.markTokenUsed(tokenRow.ID);

        res.json({ message: "Password has been reset successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Current password and new password are required" });
        }

        if (!validatePassword(newPassword)) {
            return res.status(400).json({ error: "Password must be 8-128 characters and include an uppercase letter, a lowercase letter, a number, and a special character" });
        }

        const user = await userService.findUserByIdWithPassword(req.user.sub);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.PASSWORD_HASH);

        if (!isMatch) {
            return res.status(401).json({ error: "Current password is incorrect" });
        }

        if (await isPasswordReused(user.ID, newPassword)) {
            return res.status(400).json({ error: `You cannot reuse any of your last ${passwordHistoryService.HISTORY_LIMIT} passwords` });
        }

        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
        await userService.updateUserPassword(user.ID, passwordHash);
        await passwordHistoryService.addPasswordToHistory(user.ID, passwordHash);

        res.json({ message: "Password changed successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await userService.findUserById(req.user.sub);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json({
            username: user.USERNAME,
            email: user.EMAIL,
            lastLogin: user.LAST_LOGIN,
            createdAt: user.CREATED_AT,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
};
