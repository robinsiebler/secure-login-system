process.env.JWT_SECRET = "test-secret";

jest.mock("bcrypt", () => ({
    hashSync: jest.fn(() => "dummy-hash"),
    hash: jest.fn(async () => "hashed-password"),
    compare: jest.fn(),
}));

jest.mock("../services/userService", () => ({
    findUserByUsername: jest.fn(),
    findUserById: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserByUsernameOrEmail: jest.fn(),
    createUser: jest.fn(),
    isAccountLocked: jest.fn(),
    recordFailedLogin: jest.fn(),
    resetFailedLogin: jest.fn(),
    updateUserPassword: jest.fn(),
}));

jest.mock("../services/passwordResetService", () => ({
    createResetToken: jest.fn(),
    findValidResetToken: jest.fn(),
    isTokenValid: jest.fn(),
    markTokenUsed: jest.fn(),
}));

const bcrypt = require("bcrypt");
const userService = require("../services/userService");
const passwordResetService = require("../services/passwordResetService");
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

    test("hashes the password and creates the user on valid, unique input", async () => {
        userService.findUserByUsernameOrEmail.mockResolvedValue(null);
        const req = { body: { username: "robin99", email: "robin@example.com", password: "Str0ng!Pass1" } };
        const res = mockRes();

        await authControllers.register(req, res);

        expect(bcrypt.hash).toHaveBeenCalledWith("Str0ng!Pass1", 12);
        expect(userService.createUser).toHaveBeenCalledWith({
            username: "robin99",
            email: "robin@example.com",
            passwordHash: "hashed-password",
        });
        expect(res.statusCode).toBe(201);
    });
});

describe("login", () => {
    test("requires both username and password", async () => {
        const req = { body: { username: "robin99" } };
        const res = mockRes();

        await authControllers.login(req, res);

        expect(res.statusCode).toBe(400);
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
    });

    test("returns 423 for a locked account", async () => {
        userService.findUserByUsername.mockResolvedValue({ ID: 1, FAILED_ATTEMPTS: 5 });
        userService.isAccountLocked.mockReturnValue(true);
        const req = { body: { username: "robin99", password: "whatever" } };
        const res = mockRes();

        await authControllers.login(req, res);

        expect(res.statusCode).toBe(423);
        expect(bcrypt.compare).not.toHaveBeenCalled();
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

    test("updates the password and marks the token used on success", async () => {
        passwordResetService.findValidResetToken.mockResolvedValue({ ID: 9, USER_ID: 1 });
        passwordResetService.isTokenValid.mockReturnValue(true);
        const req = { body: { token: "good-token", password: "Str0ng!Pass1" } };
        const res = mockRes();

        await authControllers.resetPassword(req, res);

        expect(bcrypt.hash).toHaveBeenCalledWith("Str0ng!Pass1", 12);
        expect(userService.updateUserPassword).toHaveBeenCalledWith(1, "hashed-password");
        expect(passwordResetService.markTokenUsed).toHaveBeenCalledWith(9);
        expect(res.body.message).toMatch(/password has been reset/i);
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
