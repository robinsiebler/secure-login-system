const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const userService = require("../services/userService");
const { validateRegistrationInput } = require("../utils/validators");

const BCRYPT_SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = "1h";

// Precomputed so a failed login (unknown user) takes roughly as long as a
// real password comparison, reducing username-enumeration via response timing.
const DUMMY_HASH = bcrypt.hashSync("timing-attack-mitigation", BCRYPT_SALT_ROUNDS);

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
        await userService.createUser({ username, email, passwordHash });

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
