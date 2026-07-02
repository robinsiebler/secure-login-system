process.env.JWT_SECRET = "test-secret";

jest.mock("bcrypt", () => ({
    hashSync: jest.fn(() => "dummy-hash"),
    hash: jest.fn(async () => "hashed-password"),
    compare: jest.fn(),
}));

jest.mock("../services/userService", () => ({
    findUserByUsername: jest.fn(),
    findUserById: jest.fn(),
    findUserByIdWithPassword: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserByUsernameOrEmail: jest.fn(),
    createUser: jest.fn(),
    isAccountLocked: jest.fn(),
    recordFailedLogin: jest.fn(),
    resetFailedLogin: jest.fn(),
    updateUserPassword: jest.fn(),
    getUserRoleCounts: jest.fn(),
}));

jest.mock("../services/passwordResetService", () => ({
    createResetToken: jest.fn(),
    findValidResetToken: jest.fn(),
    isTokenValid: jest.fn(),
    markTokenUsed: jest.fn(),
}));

jest.mock("../services/passwordHistoryService", () => ({
    HISTORY_LIMIT: 5,
    getRecentPasswordHashes: jest.fn(async () => []),
    addPasswordToHistory: jest.fn(),
}));

jest.mock("../utils/logger", () => ({
    logRegistration: jest.fn(),
    logLoginSuccess: jest.fn(),
    logLoginFailure: jest.fn(),
    logError: jest.fn(),
}));

const bcrypt = require("bcrypt");
const userService = require("../services/userService");
const passwordResetService = require("../services/passwordResetService");
const passwordHistoryService = require("../services/passwordHistoryService");
const logger = require("../utils/logger");
const authControllers = require("../controllers/authControllers");

function mockRes() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe("register", () => {
    test("rejects invalid input without touching the database", async () => {
        const req = { body: { username: "a", email: "not-an-email", password: "short" } };
        const res = mockRes();

        await authControllers.register(req, res);

        expect(res.statusCode).toBe(400);
        expect(userService.findUserByUsernameOrEmail).not.toHaveBeenCalled();
    });

    test("rejects a duplicate username or email", async () => {
        userService.findUserByUsernameOrEmail.mockResolvedValue({ ID: 1 });
        const req = { body: { username: "robin99", email: "robin@example.com", password: "Str0ng!Pass1" } };
        const res = mockRes();

        await authControllers.register(req, res);

        expect(res.statusCode).toBe(409);
        expect(userService.createUser).not.toHaveBeenCalled();
    });

    test("hashes the password, creates the user, and seeds password history", async () => {
        userService.findUserByUsernameOrEmail.mockResolvedValue(null);
        userService.createUser.mockResolvedValue({ id: 1, username: "robin99", email: "robin@example.com" });
        const req = { body: { username: "robin99", email: "robin@example.com", password: "Str0ng!Pass1" } };
        const res = mockRes();

        await authControllers.register(req, res);

        expect(bcrypt.hash).toHaveBeenCalledWith("Str0ng!Pass1", 12);
        expect(userService.createUser).toHaveBeenCalledWith({
            username: "robin99",
            email: "robin@example.com",
            passwordHash: "hashed-password",
        });
        expect(passwordHistoryService.addPasswordToHistory).toHaveBeenCalledWith(1, "hashed-password");
        expect(res.statusCode).toBe(201);
        expect(logger.logRegistration).toHaveBeenCalledWith(req, { username: "robin99", email: "robin@example.com" });
    });

    test("logs the error and returns 500 if user creation fails unexpectedly", async () => {
        userService.findUserByUsernameOrEmail.mockResolvedValue(null);
        const dbError = new Error("connection lost");
        userService.createUser.mockRejectedValue(dbError);
        const req = { body: { username: "robin99", email: "robin@example.com", password: "Str0ng!Pass1" } };
        const res = mockRes();

        await authControllers.register(req, res);

        expect(res.statusCode).toBe(500);
        expect(logger.logError).toHaveBeenCalledWith(req, dbError);
    });
});

describe("login", () => {
    test("requires both username and password", async () => {
        const req = { body: { username: "robin99" } };
        const res = mockRes();

        await authControllers.login(req, res);

        expect(res.statusCode).toBe(400);
    });

    test("rejects a non-string username without touching the database", async () => {
        const req = { body: { username: { a: 1 }, password: "whatever" } };
        const res = mockRes();

        await authControllers.login(req, res);

        expect(res.statusCode).toBe(400);
        expect(userService.findUserByUsername).not.toHaveBeenCalled();
    });

    test("rejects a non-string password without touching the database", async () => {
        const req = { body: { username: "robin99", password: [1, 2, 3] } };
        const res = mockRes();

        await authControllers.login(req, res);

        expect(res.statusCode).toBe(400);
        expect(userService.findUserByUsername).not.toHaveBeenCalled();
    });

    test("returns a generic error for an unknown user and still runs a bcrypt compare", async () => {
        userService.findUserByUsername.mockResolvedValue(null);
        bcrypt.compare.mockResolvedValue(false);
        const req = { body: { username: "ghost", password: "whatever" } };
        const res = mockRes();

        await authControllers.login(req, res);

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBe("Invalid username or password");
        expect(bcrypt.compare).toHaveBeenCalledWith("whatever", "dummy-hash");
        expect(logger.logLoginFailure).toHaveBeenCalledWith(req, { username: "ghost", reason: "unknown_user" });
    });

    test("returns 423 for a locked account", async () => {
        userService.findUserByUsername.mockResolvedValue({ ID: 1, FAILED_ATTEMPTS: 5 });
        userService.isAccountLocked.mockReturnValue(true);
        const req = { body: { username: "robin99", password: "whatever" } };
        const res = mockRes();

        await authControllers.login(req, res);

        expect(res.statusCode).toBe(423);
        expect(bcrypt.compare).not.toHaveBeenCalled();
        expect(logger.logLoginFailure).toHaveBeenCalledWith(req, { username: "robin99", reason: "account_locked" });
    });

    test("records a failed attempt and rejects on wrong password", async () => {
        userService.findUserByUsername.mockResolvedValue({ ID: 1, PASSWORD_HASH: "stored-hash", FAILED_ATTEMPTS: 2 });
        userService.isAccountLocked.mockReturnValue(false);
        bcrypt.compare.mockResolvedValue(false);
        const req = { body: { username: "robin99", password: "wrong" } };
        const res = mockRes();

        await authControllers.login(req, res);

        expect(userService.recordFailedLogin).toHaveBeenCalledWith(1, 2);
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toBe("Invalid username or password");
        expect(logger.logLoginFailure).toHaveBeenCalledWith(req, { username: "robin99", reason: "invalid_password" });
    });

    test("resets failed attempts and issues a JWT on success", async () => {
        userService.findUserByUsername.mockResolvedValue({ ID: 1, USERNAME: "robin99", PASSWORD_HASH: "stored-hash", FAILED_ATTEMPTS: 0 });
        userService.isAccountLocked.mockReturnValue(false);
        bcrypt.compare.mockResolvedValue(true);
        const req = { body: { username: "robin99", password: "Str0ng!Pass1" } };
        const res = mockRes();

        await authControllers.login(req, res);

        expect(userService.resetFailedLogin).toHaveBeenCalledWith(1);
        expect(res.body.token).toEqual(expect.any(String));
        expect(logger.logLoginSuccess).toHaveBeenCalledWith(req, { username: "robin99" });
    });

    test("logs the error and returns 500 if the database lookup throws", async () => {
        const dbError = new Error("connection lost");
        userService.findUserByUsername.mockRejectedValue(dbError);
        const req = { body: { username: "robin99", password: "whatever" } };
        const res = mockRes();

        await authControllers.login(req, res);

        expect(res.statusCode).toBe(500);
        expect(logger.logError).toHaveBeenCalledWith(req, dbError);
    });
});

describe("forgotPassword", () => {
    test("rejects an invalid email without touching the database", async () => {
        const req = { body: { email: "not-an-email" } };
        const res = mockRes();

        await authControllers.forgotPassword(req, res);

        expect(res.statusCode).toBe(400);
        expect(userService.findUserByEmail).not.toHaveBeenCalled();
    });

    test("creates a reset token when the email is registered", async () => {
        userService.findUserByEmail.mockResolvedValue({ ID: 1, EMAIL: "robin@example.com" });
        const req = { body: { email: "robin@example.com" } };
        const res = mockRes();

        await authControllers.forgotPassword(req, res);

        expect(passwordResetService.createResetToken).toHaveBeenCalledWith(1, expect.any(String));
        expect(res.body.message).toMatch(/if that email is registered/i);
    });

    test("gives the same generic response for an unregistered email, without creating a token", async () => {
        userService.findUserByEmail.mockResolvedValue(null);
        const req = { body: { email: "ghost@example.com" } };
        const res = mockRes();

        await authControllers.forgotPassword(req, res);

        expect(passwordResetService.createResetToken).not.toHaveBeenCalled();
        expect(res.body.message).toMatch(/if that email is registered/i);
    });
});

describe("resetPassword", () => {
    test("requires a token", async () => {
        const req = { body: { password: "Str0ng!Pass1" } };
        const res = mockRes();

        await authControllers.resetPassword(req, res);

        expect(res.statusCode).toBe(400);
    });

    test("rejects a weak new password without looking up the token", async () => {
        const req = { body: { token: "some-token", password: "weak" } };
        const res = mockRes();

        await authControllers.resetPassword(req, res);

        expect(res.statusCode).toBe(400);
        expect(passwordResetService.findValidResetToken).not.toHaveBeenCalled();
    });

    test("rejects an invalid or expired token", async () => {
        passwordResetService.findValidResetToken.mockResolvedValue(null);
        passwordResetService.isTokenValid.mockReturnValue(false);
        const req = { body: { token: "bad-token", password: "Str0ng!Pass1" } };
        const res = mockRes();

        await authControllers.resetPassword(req, res);

        expect(res.statusCode).toBe(400);
        expect(userService.updateUserPassword).not.toHaveBeenCalled();
    });

    test("rejects a password that matches recent history, without updating anything", async () => {
        passwordResetService.findValidResetToken.mockResolvedValue({ ID: 9, USER_ID: 1 });
        passwordResetService.isTokenValid.mockReturnValue(true);
        passwordHistoryService.getRecentPasswordHashes.mockResolvedValue(["old-hash-1"]);
        bcrypt.compare.mockResolvedValue(true);
        const req = { body: { token: "good-token", password: "ReusedStr0ng!Pass1" } };
        const res = mockRes();

        await authControllers.resetPassword(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/cannot reuse/i);
        expect(userService.updateUserPassword).not.toHaveBeenCalled();
    });

    test("updates the password, records history, and marks the token used on success", async () => {
        passwordResetService.findValidResetToken.mockResolvedValue({ ID: 9, USER_ID: 1 });
        passwordResetService.isTokenValid.mockReturnValue(true);
        passwordHistoryService.getRecentPasswordHashes.mockResolvedValue([]);
        const req = { body: { token: "good-token", password: "Str0ng!Pass1" } };
        const res = mockRes();

        await authControllers.resetPassword(req, res);

        expect(bcrypt.hash).toHaveBeenCalledWith("Str0ng!Pass1", 12);
        expect(userService.updateUserPassword).toHaveBeenCalledWith(1, "hashed-password");
        expect(passwordHistoryService.addPasswordToHistory).toHaveBeenCalledWith(1, "hashed-password");
        expect(passwordResetService.markTokenUsed).toHaveBeenCalledWith(9);
        expect(res.body.message).toMatch(/password has been reset/i);
    });
});

describe("changePassword", () => {
    test("requires both current and new password", async () => {
        const req = { body: { currentPassword: "OldStr0ng!Pass1" }, user: { sub: 1 } };
        const res = mockRes();

        await authControllers.changePassword(req, res);

        expect(res.statusCode).toBe(400);
        expect(userService.findUserByIdWithPassword).not.toHaveBeenCalled();
    });

    test("rejects a non-string current password without looking up the user", async () => {
        const req = { body: { currentPassword: 12345, newPassword: "NewStr0ng!Pass2" }, user: { sub: 1 } };
        const res = mockRes();

        await authControllers.changePassword(req, res);

        expect(res.statusCode).toBe(400);
        expect(userService.findUserByIdWithPassword).not.toHaveBeenCalled();
    });

    test("rejects a weak new password without looking up the user", async () => {
        const req = { body: { currentPassword: "OldStr0ng!Pass1", newPassword: "weak" }, user: { sub: 1 } };
        const res = mockRes();

        await authControllers.changePassword(req, res);

        expect(res.statusCode).toBe(400);
        expect(userService.findUserByIdWithPassword).not.toHaveBeenCalled();
    });

    test("returns 404 when the user no longer exists", async () => {
        userService.findUserByIdWithPassword.mockResolvedValue(null);
        const req = { body: { currentPassword: "OldStr0ng!Pass1", newPassword: "NewStr0ng!Pass2" }, user: { sub: 1 } };
        const res = mockRes();

        await authControllers.changePassword(req, res);

        expect(res.statusCode).toBe(404);
    });

    test("rejects an incorrect current password without updating anything", async () => {
        userService.findUserByIdWithPassword.mockResolvedValue({ ID: 1, PASSWORD_HASH: "stored-hash" });
        bcrypt.compare.mockResolvedValue(false);
        const req = { body: { currentPassword: "WrongPass1!", newPassword: "NewStr0ng!Pass2" }, user: { sub: 1 } };
        const res = mockRes();

        await authControllers.changePassword(req, res);

        expect(res.statusCode).toBe(401);
        expect(userService.updateUserPassword).not.toHaveBeenCalled();
    });

    test("rejects a new password that matches recent history, without updating anything", async () => {
        userService.findUserByIdWithPassword.mockResolvedValue({ ID: 1, PASSWORD_HASH: "stored-hash" });
        passwordHistoryService.getRecentPasswordHashes.mockResolvedValue(["old-hash-1"]);
        bcrypt.compare.mockResolvedValue(true);
        const req = { body: { currentPassword: "OldStr0ng!Pass1", newPassword: "ReusedStr0ng!Pass1" }, user: { sub: 1 } };
        const res = mockRes();

        await authControllers.changePassword(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/cannot reuse/i);
        expect(userService.updateUserPassword).not.toHaveBeenCalled();
    });

    test("hashes and stores the new password, and records history, on success", async () => {
        userService.findUserByIdWithPassword.mockResolvedValue({ ID: 1, PASSWORD_HASH: "stored-hash" });
        passwordHistoryService.getRecentPasswordHashes.mockResolvedValue([]);
        bcrypt.compare.mockResolvedValue(true);
        const req = { body: { currentPassword: "OldStr0ng!Pass1", newPassword: "NewStr0ng!Pass2" }, user: { sub: 1 } };
        const res = mockRes();

        await authControllers.changePassword(req, res);

        expect(bcrypt.compare).toHaveBeenCalledWith("OldStr0ng!Pass1", "stored-hash");
        expect(bcrypt.hash).toHaveBeenCalledWith("NewStr0ng!Pass2", 12);
        expect(userService.updateUserPassword).toHaveBeenCalledWith(1, "hashed-password");
        expect(passwordHistoryService.addPasswordToHistory).toHaveBeenCalledWith(1, "hashed-password");
        expect(res.body.message).toMatch(/password changed/i);
    });
});

describe("getProfile", () => {
    test("returns 404 when the user no longer exists", async () => {
        userService.findUserById.mockResolvedValue(null);
        const req = { user: { sub: 1 } };
        const res = mockRes();

        await authControllers.getProfile(req, res);

        expect(res.statusCode).toBe(404);
    });

    test("returns profile fields for an existing user", async () => {
        userService.findUserById.mockResolvedValue({
            USERNAME: "robin99",
            EMAIL: "robin@example.com",
            LAST_LOGIN: null,
            CREATED_AT: "2026-01-01T00:00:00.000Z",
        });
        const req = { user: { sub: 1 } };
        const res = mockRes();

        await authControllers.getProfile(req, res);

        expect(res.body.username).toBe("robin99");
        expect(res.body.email).toBe("robin@example.com");
    });
});

describe("getDashboard", () => {
    test("returns 404 when the user no longer exists", async () => {
        userService.findUserById.mockResolvedValue(null);
        const req = { user: { sub: 1 } };
        const res = mockRes();

        await authControllers.getDashboard(req, res);

        expect(res.statusCode).toBe(404);
    });

    test("returns base fields with no stats for an Employee", async () => {
        userService.findUserById.mockResolvedValue({ USERNAME: "robin99", ROLE: "EMPLOYEE", LAST_LOGIN: null });
        const req = { user: { sub: 1 } };
        const res = mockRes();

        await authControllers.getDashboard(req, res);

        expect(res.body).toEqual({ username: "robin99", role: "EMPLOYEE", lastLogin: null });
        expect(userService.getUserRoleCounts).not.toHaveBeenCalled();
    });

    test("includes user-count stats for a Manager", async () => {
        userService.findUserById.mockResolvedValue({ USERNAME: "mgr1", ROLE: "MANAGER", LAST_LOGIN: null });
        userService.getUserRoleCounts.mockResolvedValue([
            { ROLE: "ADMIN", CNT: 1 },
            { ROLE: "EMPLOYEE", CNT: 3 },
        ]);
        const req = { user: { sub: 2 } };
        const res = mockRes();

        await authControllers.getDashboard(req, res);

        expect(res.body.stats).toEqual({
            totalUsers: 4,
            usersByRole: { ADMIN: 1, MANAGER: 0, EMPLOYEE: 3 },
        });
    });

    test("includes user-count stats for an Admin", async () => {
        userService.findUserById.mockResolvedValue({ USERNAME: "admin1", ROLE: "ADMIN", LAST_LOGIN: null });
        userService.getUserRoleCounts.mockResolvedValue([{ ROLE: "ADMIN", CNT: 1 }]);
        const req = { user: { sub: 3 } };
        const res = mockRes();

        await authControllers.getDashboard(req, res);

        expect(res.body.stats).toEqual({
            totalUsers: 1,
            usersByRole: { ADMIN: 1, MANAGER: 0, EMPLOYEE: 0 },
        });
    });
});
