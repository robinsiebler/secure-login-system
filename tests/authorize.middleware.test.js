jest.mock("../services/userService", () => ({
    findUserById: jest.fn(),
}));

const userService = require("../services/userService");
const { authorizeRoles, ROLES } = require("../middleware/authorize");
const { AuthError } = require("../utils/errors");

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

describe("authorizeRoles", () => {
    test("rejects when the user no longer exists", async () => {
        userService.findUserById.mockResolvedValue(null);
        const req = { user: { sub: 1 } };
        const res = mockRes();
        const next = jest.fn();

        await expect(authorizeRoles(ROLES.ADMIN)(req, res, next)).rejects.toMatchObject({
            statusCode: 401,
            message: "User not found",
        });
        expect(next).not.toHaveBeenCalled();
    });

    test("rejects a user whose current role is not allowed", async () => {
        userService.findUserById.mockResolvedValue({ ID: 1, ROLE: "EMPLOYEE" });
        const req = { user: { sub: 1 } };
        const res = mockRes();
        const next = jest.fn();

        await expect(authorizeRoles(ROLES.ADMIN)(req, res, next)).rejects.toMatchObject({
            statusCode: 403,
            message: "You do not have permission to perform this action",
        });
        expect(next).not.toHaveBeenCalled();
    });

    test("allows a user whose current role matches and attaches req.currentUser", async () => {
        userService.findUserById.mockResolvedValue({ ID: 1, ROLE: "ADMIN" });
        const req = { user: { sub: 1 } };
        const res = mockRes();
        const next = jest.fn();

        await authorizeRoles(ROLES.ADMIN)(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.currentUser.ROLE).toBe("ADMIN");
    });

    test("allows any role in a multi-role allow list", async () => {
        userService.findUserById.mockResolvedValue({ ID: 1, ROLE: "MANAGER" });
        const req = { user: { sub: 1 } };
        const res = mockRes();
        const next = jest.fn();

        await authorizeRoles(ROLES.ADMIN, ROLES.MANAGER)(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    test("checks the role fresh from the database rather than trusting the JWT payload", async () => {
        userService.findUserById.mockResolvedValue({ ID: 1, ROLE: "EMPLOYEE" });
        const req = { user: { sub: 1, role: "ADMIN" } };
        const res = mockRes();
        const next = jest.fn();

        await expect(authorizeRoles(ROLES.ADMIN)(req, res, next)).rejects.toBeInstanceOf(AuthError);
        expect(next).not.toHaveBeenCalled();
    });

    test("propagates the raw error when the role lookup throws, for the centralized handler to log", async () => {
        const dbError = new Error("connection lost");
        userService.findUserById.mockRejectedValue(dbError);
        const req = { user: { sub: 1 } };
        const res = mockRes();
        const next = jest.fn();

        await expect(authorizeRoles(ROLES.ADMIN)(req, res, next)).rejects.toBe(dbError);
        expect(next).not.toHaveBeenCalled();
    });
});
