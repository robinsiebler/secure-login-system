const { generateResetToken, hashResetToken } = require("../utils/tokens");

describe("generateResetToken", () => {
    test("returns a 64-character hex string (32 random bytes)", () => {
        const token = generateResetToken();
        expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    test("returns a different value on each call", () => {
        expect(generateResetToken()).not.toBe(generateResetToken());
    });
});

describe("hashResetToken", () => {
    test("is deterministic for the same input", () => {
        const token = generateResetToken();
        expect(hashResetToken(token)).toBe(hashResetToken(token));
    });

    test("produces a 64-character hex SHA-256 digest", () => {
        expect(hashResetToken("some-token")).toMatch(/^[0-9a-f]{64}$/);
    });

    test("different tokens hash to different values", () => {
        expect(hashResetToken("token-a")).not.toBe(hashResetToken("token-b"));
    });
});
