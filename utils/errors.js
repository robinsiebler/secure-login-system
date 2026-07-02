class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
    }
}

class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}

class AuthError extends AppError {
    constructor(message, statusCode = 401) {
        super(message, statusCode);
    }
}

class NotFoundError extends AppError {
    constructor(message) {
        super(message, 404);
    }
}

class ConflictError extends AppError {
    constructor(message) {
        super(message, 409);
    }
}

module.exports = { AppError, ValidationError, AuthError, NotFoundError, ConflictError };
