jest.mock("../utils/logger", () => ({
    logError: jest.fn(),
}));

const logger = require("../utils/logger");
const errorHandler = require("../middleware/errorHandler");
const { ValidationError, AuthError, NotFoundError, ConflictError } = require("../utils/errors");

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

describe("errorHandler", () => {
    test("returns 400 for a malformed-JSON body-parser error, without logging", () => {
        const err = new SyntaxError("Unexpected token");
        err.type = "entity.parse.failed";
        const req = {};
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: "Invalid JSON in request body" });
        expect(logger.logError).not.toHaveBeenCalled();
    });

    test("returns 401 for an expired JWT, without logging", () => {
        const err = new Error("jwt expired");
        err.name = "TokenExpiredError";
        const req = {};
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/session has expired/i);
        expect(logger.logError).not.toHaveBeenCalled();
    });

    test("returns 403 for a malformed JWT, without logging", () => {
        const err = new Error("jwt malformed");
        err.name = "JsonWebTokenError";
        const req = {};
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(res.statusCode).toBe(403);
        expect(res.body.error).toMatch(/invalid authentication token/i);
        expect(logger.logError).not.toHaveBeenCalled();
    });

    test("returns 403 for a not-yet-valid JWT (NotBeforeError), without logging", () => {
        const err = new Error("jwt not active");
        err.name = "NotBeforeError";
        const req = {};
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(res.statusCode).toBe(403);
        expect(logger.logError).not.toHaveBeenCalled();
    });

    test.each([
        [new ValidationError("bad input"), 400],
        [new AuthError("nope"), 401],
        [new AuthError("forbidden", 403), 403],
        [new NotFoundError("missing"), 404],
        [new ConflictError("duplicate"), 409],
    ])("formats %p as %i without logging (expected, client-facing errors)", (err, expectedStatus) => {
        const req = {};
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(res.statusCode).toBe(expectedStatus);
        expect(res.body).toEqual({ error: err.message });
        expect(logger.logError).not.toHaveBeenCalled();
    });

    test("returns 409 for an Oracle unique-constraint violation, and logs it", () => {
        const err = new Error("ORA-00001: unique constraint violated");
        err.errorNum = 1;
        const req = {};
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(res.statusCode).toBe(409);
        expect(res.body.error).toMatch(/already in use/i);
        expect(logger.logError).toHaveBeenCalledWith(req, err);
    });

    test("returns 500 for any other Oracle error, and logs it", () => {
        const err = new Error("ORA-12154: TNS could not resolve");
        err.errorNum = 12154;
        const req = {};
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toMatch(/database error/i);
        expect(logger.logError).toHaveBeenCalledWith(req, err);
    });

    test("returns a generic 500 for any other unexpected error, and logs it", () => {
        const err = new Error("something exploded");
        const req = {};
        const res = mockRes();

        errorHandler(err, req, res, jest.fn());

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: "Server error" });
        expect(logger.logError).toHaveBeenCalledWith(req, err);
    });
});
