jest.mock("fs", () => ({
    mkdirSync: jest.fn(),
    appendFile: jest.fn((file, data, cb) => cb(null)),
}));

const fs = require("fs");
const logger = require("../utils/logger");

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
});

describe("logRegistration", () => {
    test("logs an info-level REGISTRATION entry to console and file", () => {
        logger.logRegistration({ ip: "127.0.0.1" }, { username: "robin99", email: "robin@example.com" });

        expect(console.log).toHaveBeenCalledTimes(1);
        const entry = JSON.parse(console.log.mock.calls[0][0]);
        expect(entry).toMatchObject({
            level: "info",
            event: "REGISTRATION",
            username: "robin99",
            email: "robin@example.com",
            ip: "127.0.0.1",
        });
        expect(entry.timestamp).toEqual(expect.any(String));
        expect(fs.appendFile).toHaveBeenCalledWith(
            expect.stringContaining("app.log"),
            expect.stringContaining("REGISTRATION"),
            expect.any(Function)
        );
    });
});

describe("logLoginSuccess", () => {
    test("logs an info-level LOGIN_SUCCESS entry", () => {
        logger.logLoginSuccess({ ip: "10.0.0.1" }, { username: "robin99" });

        const entry = JSON.parse(console.log.mock.calls[0][0]);
        expect(entry).toMatchObject({ level: "info", event: "LOGIN_SUCCESS", username: "robin99", ip: "10.0.0.1" });
    });
});

describe("logLoginFailure", () => {
    test("logs a warn-level LOGIN_FAILURE entry with a reason", () => {
        logger.logLoginFailure({ ip: "10.0.0.1" }, { username: "ghost", reason: "unknown_user" });

        expect(console.warn).toHaveBeenCalledTimes(1);
        const entry = JSON.parse(console.warn.mock.calls[0][0]);
        expect(entry).toMatchObject({ level: "warn", event: "LOGIN_FAILURE", username: "ghost", reason: "unknown_user" });
    });
});

describe("logError", () => {
    test("logs an error-level ERROR entry with route/method/message/stack", () => {
        const req = { originalUrl: "/api/login", method: "POST", ip: "10.0.0.1" };
        const err = new Error("boom");

        logger.logError(req, err);

        expect(console.error).toHaveBeenCalledTimes(1);
        const entry = JSON.parse(console.error.mock.calls[0][0]);
        expect(entry).toMatchObject({
            level: "error",
            event: "ERROR",
            route: "/api/login",
            method: "POST",
            ip: "10.0.0.1",
            message: "boom",
        });
        expect(entry.stack).toEqual(expect.any(String));
    });

    test("also writes the entry to the log file", () => {
        const req = { originalUrl: "/api/x", method: "GET", ip: "1.2.3.4" };

        logger.logError(req, new Error("oops"));

        expect(fs.appendFile).toHaveBeenCalledTimes(1);
    });
});

describe("log file write failures", () => {
    test("falls back to console.error without throwing", () => {
        fs.appendFile.mockImplementationOnce((file, data, cb) => cb(new Error("disk full")));

        expect(() => logger.logLoginSuccess({ ip: "1.1.1.1" }, { username: "robin99" })).not.toThrow();
        expect(console.error).toHaveBeenCalledWith("Failed to write to log file:", "disk full");
    });
});
