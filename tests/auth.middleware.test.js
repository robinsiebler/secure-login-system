process.env.JWT_SECRET = "test-secret";

const jwt = require("jsonwebtoken");
const { authenticateToken } = require("../middleware/auth");
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

describe("authenticateToken", () => {
    test("throws an AuthError for requests with no token", () => {
        const req = { headers: {} };
        const res = mockRes();
        const next = jest.fn();

        expect(() => authenticateToken(req, res, next)).toThrow(AuthError);

        try {
            authenticateToken(req, res, next);
        } catch (err) {
            expect(err.statusCode).toBe(401);
            expect(err.message).toBe("Authentication token required");
        }

        expect(next).not.toHaveBeenCalled();
    });

    test("throws jsonwebtoken's error for an invalid token", () => {
        const req = { headers: { authorization: "Bearer not-a-real-token" } };
        const res = mockRes();
        const next = jest.fn();

        expect(() => authenticateToken(req, res, next)).toThrow();

        try {
            authenticateToken(req, res, next);
        } catch (err) {
            expect(err.name).toBe("JsonWebTokenError");
        }

        expect(next).not.toHaveBeenCalled();
    });

    test("throws a TokenExpiredError for an expired token", () => {
        const token = jwt.sign({ sub: 1, username: "robin" }, process.env.JWT_SECRET, { expiresIn: -1 });
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        const next = jest.fn();

        try {
            authenticateToken(req, res, next);
            throw new Error("expected authenticateToken to throw");
        } catch (err) {
            expect(err.name).toBe("TokenExpiredError");
        }

        expect(next).not.toHaveBeenCalled();
    });

    test("calls next and attaches user for a valid token", () => {
        const token = jwt.sign({ sub: 1, username: "robin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        const next = jest.fn();

        authenticateToken(req, res, next);

        expect(req.user.username).toBe("robin");
        expect(next).toHaveBeenCalled();
    });
});
