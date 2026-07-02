process.env.JWT_SECRET = "test-secret";

const jwt = require("jsonwebtoken");
const { authenticateToken } = require("../middleware/auth");

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
    test("rejects requests with no token", () => {
        const req = { headers: {} };
        const res = mockRes();
        const next = jest.fn();

        authenticateToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("rejects an invalid token", () => {
        const req = { headers: { authorization: "Bearer not-a-real-token" } };
        const res = mockRes();
        const next = jest.fn();

        authenticateToken(req, res, next);

        expect(res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
    });

    test("calls next and attaches user for a valid token", (done) => {
        const token = jwt.sign({ sub: 1, username: "robin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();

        authenticateToken(req, res, () => {
            expect(req.user.username).toBe("robin");
            done();
        });
    });
});
