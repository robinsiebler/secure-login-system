const {
    validateUsername,
    validateEmail,
    validatePassword,
    validateRegistrationInput,
} = require("../utils/validators");

describe("validateUsername", () => {
    test("accepts alphanumeric + underscore, 3-30 chars", () => {
        expect(validateUsername("robin_99")).toBe(true);
    });

    test("rejects too short", () => {
        expect(validateUsername("ab")).toBe(false);
    });

    test("rejects special characters", () => {
        expect(validateUsername("robin!")).toBe(false);
    });
});

describe("validateEmail", () => {
    test("accepts a standard email", () => {
        expect(validateEmail("user@example.com")).toBe(true);
    });

    test("rejects missing @", () => {
        expect(validateEmail("userexample.com")).toBe(false);
    });

    test("rejects missing domain", () => {
        expect(validateEmail("user@")).toBe(false);
    });
});

describe("validatePassword", () => {
    test("accepts a strong password", () => {
        expect(validatePassword("Str0ng!Pass")).toBe(true);
    });

    test("rejects too short", () => {
        expect(validatePassword("Sh0rt!")).toBe(false);
    });

    test("rejects missing special character", () => {
        expect(validatePassword("NoSpecial1")).toBe(false);
    });

    test("rejects missing digit", () => {
        expect(validatePassword("NoDigit!!")).toBe(false);
    });
});

describe("validateRegistrationInput", () => {
    test("returns null for valid input", () => {
        expect(
            validateRegistrationInput({
                username: "robin_99",
                email: "user@example.com",
                password: "Str0ng!Pass",
            })
        ).toBeNull();
    });

    test("returns an error message for invalid username", () => {
        expect(
            validateRegistrationInput({
                username: "a",
                email: "user@example.com",
                password: "Str0ng!Pass",
            })
        ).toMatch(/username/i);
    });
});
