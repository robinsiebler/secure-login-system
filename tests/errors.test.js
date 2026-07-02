const { AppError, ValidationError, AuthError, NotFoundError, ConflictError } = require("../utils/errors");

describe("AppError", () => {
    test("sets message, statusCode, and name", () => {
        const err = new AppError("something broke", 418);

        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe("something broke");
        expect(err.statusCode).toBe(418);
        expect(err.name).toBe("AppError");
    });
});

describe("ValidationError", () => {
    test("defaults to a 400 status code", () => {
        const err = new ValidationError("bad input");

        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(400);
        expect(err.message).toBe("bad input");
        expect(err.name).toBe("ValidationError");
    });
});

describe("AuthError", () => {
    test("defaults to a 401 status code", () => {
        const err = new AuthError("not allowed");

        expect(err.statusCode).toBe(401);
        expect(err.name).toBe("AuthError");
    });

    test("accepts a custom status code (e.g. 403 or 423)", () => {
        expect(new AuthError("forbidden", 403).statusCode).toBe(403);
        expect(new AuthError("locked", 423).statusCode).toBe(423);
    });
});

describe("NotFoundError", () => {
    test("defaults to a 404 status code", () => {
        const err = new NotFoundError("missing");

        expect(err.statusCode).toBe(404);
        expect(err.name).toBe("NotFoundError");
    });
});

describe("ConflictError", () => {
    test("defaults to a 409 status code", () => {
        const err = new ConflictError("duplicate");

        expect(err.statusCode).toBe(409);
        expect(err.name).toBe("ConflictError");
    });
});
