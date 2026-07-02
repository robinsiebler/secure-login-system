const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNonEmptyString(value) {
    return typeof value === "string" && value.length > 0;
}

function validateUsername(username) {
    return typeof username === "string" && USERNAME_REGEX.test(username);
}

function validateEmail(email) {
    return typeof email === "string" && email.length <= 255 && EMAIL_REGEX.test(email);
}

function validatePassword(password) {
    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
        return false;
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    return hasUpper && hasLower && hasDigit && hasSpecial;
}

function validateRegistrationInput({ username, email, password }) {
    if (!validateUsername(username)) {
        return "Username must be 3-30 characters and contain only letters, numbers, and underscores";
    }

    if (!validateEmail(email)) {
        return "A valid email address is required";
    }

    if (!validatePassword(password)) {
        return "Password must be 8-128 characters and include an uppercase letter, a lowercase letter, a number, and a special character";
    }

    return null;
}

module.exports = {
    isNonEmptyString,
    validateUsername,
    validateEmail,
    validatePassword,
    validateRegistrationInput,
};
