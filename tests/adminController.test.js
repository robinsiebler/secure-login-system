jest.mock("../services/userService", () => ({
    findAllUsers: jest.fn(),
    deleteUserById: jest.fn(),
    updateUserRole: jest.fn(),
}));

jest.mock("../utils/logger", () => ({
    logError: jest.fn(),
}));

const userService = require("../services/userService");
const adminController = require("../controllers/adminController");

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

describe("listUsers", () => {
    test("returns users without exposing password hashes", async () => {
        userService.findAllUsers.mockResolvedValue([
            { ID: 1, USERNAME: "robin99", EMAIL: "robin@example.com", ROLE: "ADMIN", LAST_LOGIN: null, CREATED_AT: "2026-01-01" },
        ]);
        const req = {};
        const res = mockRes();

        await adminController.listUsers(req, res);

        expect(res.body.users).toEqual([
            { id: 1, username: "robin99", email: "robin@example.com", role: "ADMIN", lastLogin: null, createdAt: "2026-01-01" },
        ]);
    });
});

describe("deleteUser", () => {
    test("rejects a non-numeric id", async () => {
        const req = { params: { id: "abc" }, currentUser: { ID: 1 } };
        const res = mockRes();

        await adminController.deleteUser(req, res);

        expect(res.statusCode).toBe(400);
        expect(userService.deleteUserById).not.toHaveBeenCalled();
    });

    test("refuses to let an admin delete their own account", async () => {
        const req = { params: { id: "1" }, currentUser: { ID: 1 } };
        const res = mockRes();

        await adminController.deleteUser(req, res);

        expect(res.statusCode).toBe(400);
        expect(userService.deleteUserById).not.toHaveBeenCalled();
    });

    test("returns 404 when the target user doesn't exist", async () => {
        userService.deleteUserById.mockResolvedValue(false);
        const req = { params: { id: "2" }, currentUser: { ID: 1 } };
        const res = mockRes();

        await adminController.deleteUser(req, res);

        expect(res.statusCode).toBe(404);
    });

    test("deletes another user successfully", async () => {
        userService.deleteUserById.mockResolvedValue(true);
        const req = { params: { id: "2" }, currentUser: { ID: 1 } };
        const res = mockRes();

        await adminController.deleteUser(req, res);

        expect(userService.deleteUserById).toHaveBeenCalledWith(2);
        expect(res.body.message).toMatch(/deleted successfully/i);
    });
});

describe("updateUserRole", () => {
    test("rejects an invalid role", async () => {
        const req = { params: { id: "2" }, body: { role: "SUPERUSER" }, currentUser: { ID: 1 } };
        const res = mockRes();

        await adminController.updateUserRole(req, res);

        expect(res.statusCode).toBe(400);
        expect(userService.updateUserRole).not.toHaveBeenCalled();
    });

    test("refuses to let an admin change their own role", async () => {
        const req = { params: { id: "1" }, body: { role: "MANAGER" }, currentUser: { ID: 1 } };
        const res = mockRes();

        await adminController.updateUserRole(req, res);

        expect(res.statusCode).toBe(400);
        expect(userService.updateUserRole).not.toHaveBeenCalled();
    });

    test("returns 404 when the target user doesn't exist", async () => {
        userService.updateUserRole.mockResolvedValue(false);
        const req = { params: { id: "2" }, body: { role: "MANAGER" }, currentUser: { ID: 1 } };
        const res = mockRes();

        await adminController.updateUserRole(req, res);

        expect(res.statusCode).toBe(404);
    });

    test("updates another user's role successfully", async () => {
        userService.updateUserRole.mockResolvedValue(true);
        const req = { params: { id: "2" }, body: { role: "MANAGER" }, currentUser: { ID: 1 } };
        const res = mockRes();

        await adminController.updateUserRole(req, res);

        expect(userService.updateUserRole).toHaveBeenCalledWith(2, "MANAGER");
        expect(res.body.message).toMatch(/updated successfully/i);
    });
});
