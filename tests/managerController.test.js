jest.mock("../services/userService", () => ({
    findAllEmployees: jest.fn(),
    findUserById: jest.fn(),
    deleteUserById: jest.fn(),
}));

const userService = require("../services/userService");
const managerController = require("../controllers/managerController");

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

describe("listEmployees", () => {
    test("returns employees without exposing password hashes", async () => {
        userService.findAllEmployees.mockResolvedValue([
            { ID: 3, USERNAME: "emp1", EMAIL: "emp1@example.com", ROLE: "EMPLOYEE", LAST_LOGIN: null, CREATED_AT: "2026-01-01" },
        ]);
        const req = {};
        const res = mockRes();

        await managerController.listEmployees(req, res);

        expect(res.body.employees).toEqual([
            { id: 3, username: "emp1", email: "emp1@example.com", role: "EMPLOYEE", lastLogin: null, createdAt: "2026-01-01" },
        ]);
    });
});

describe("deleteEmployee", () => {
    test("rejects a non-numeric id", async () => {
        const req = { params: { id: "abc" } };
        const res = mockRes();

        await managerController.deleteEmployee(req, res);

        expect(res.statusCode).toBe(400);
        expect(userService.deleteUserById).not.toHaveBeenCalled();
    });

    test("returns 404 when the target user doesn't exist", async () => {
        userService.findUserById.mockResolvedValue(null);
        const req = { params: { id: "3" } };
        const res = mockRes();

        await managerController.deleteEmployee(req, res);

        expect(res.statusCode).toBe(404);
        expect(userService.deleteUserById).not.toHaveBeenCalled();
    });

    test("refuses to delete a Manager", async () => {
        userService.findUserById.mockResolvedValue({ ID: 2, ROLE: "MANAGER" });
        const req = { params: { id: "2" } };
        const res = mockRes();

        await managerController.deleteEmployee(req, res);

        expect(res.statusCode).toBe(403);
        expect(userService.deleteUserById).not.toHaveBeenCalled();
    });

    test("refuses to delete an Admin", async () => {
        userService.findUserById.mockResolvedValue({ ID: 1, ROLE: "ADMIN" });
        const req = { params: { id: "1" } };
        const res = mockRes();

        await managerController.deleteEmployee(req, res);

        expect(res.statusCode).toBe(403);
        expect(userService.deleteUserById).not.toHaveBeenCalled();
    });

    test("deletes an Employee successfully", async () => {
        userService.findUserById.mockResolvedValue({ ID: 3, ROLE: "EMPLOYEE" });
        userService.deleteUserById.mockResolvedValue(true);
        const req = { params: { id: "3" } };
        const res = mockRes();

        await managerController.deleteEmployee(req, res);

        expect(userService.deleteUserById).toHaveBeenCalledWith(3);
        expect(res.body.message).toMatch(/removed successfully/i);
    });
});
