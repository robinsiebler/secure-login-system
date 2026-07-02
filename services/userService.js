const oracledb = require("oracledb");

const { withConnection } = require("../database/db");

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function findUserByUsername(username) {
    return withConnection(async (conn) => {
        const result = await conn.execute(
            `SELECT ID, USERNAME, EMAIL, PASSWORD_HASH, FAILED_ATTEMPTS, LOCKED_UNTIL
             FROM USERS WHERE USERNAME = :username`,
            { username }
        );

        return result.rows[0] || null;
    });
}

async function findUserById(id) {
    return withConnection(async (conn) => {
        const result = await conn.execute(
            `SELECT ID, USERNAME, EMAIL, ROLE, LAST_LOGIN, CREATED_AT
             FROM USERS WHERE ID = :id`,
            { id }
        );

        return result.rows[0] || null;
    });
}

async function findAllUsers() {
    return withConnection(async (conn) => {
        const result = await conn.execute(
            `SELECT ID, USERNAME, EMAIL, ROLE, LAST_LOGIN, CREATED_AT
             FROM USERS ORDER BY ID`
        );

        return result.rows;
    });
}

async function findUserByIdWithPassword(id) {
    return withConnection(async (conn) => {
        const result = await conn.execute(
            `SELECT ID, PASSWORD_HASH FROM USERS WHERE ID = :id`,
            { id }
        );

        return result.rows[0] || null;
    });
}

async function findUserByEmail(email) {
    return withConnection(async (conn) => {
        const result = await conn.execute(
            `SELECT ID, USERNAME, EMAIL FROM USERS WHERE EMAIL = :email`,
            { email }
        );

        return result.rows[0] || null;
    });
}

async function findUserByUsernameOrEmail(username, email) {
    return withConnection(async (conn) => {
        const result = await conn.execute(
            `SELECT ID FROM USERS WHERE USERNAME = :username OR EMAIL = :email`,
            { username, email }
        );

        return result.rows[0] || null;
    });
}

async function createUser({ username, email, passwordHash }) {
    return withConnection(async (conn) => {
        const result = await conn.execute(
            `INSERT INTO USERS (USERNAME, EMAIL, PASSWORD_HASH)
             VALUES (:username, :email, :passwordHash)
             RETURNING ID INTO :id`,
            {
                username,
                email,
                passwordHash,
                id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            },
            { autoCommit: true }
        );

        return { id: result.outBinds.id[0], username, email };
    });
}

function isAccountLocked(user) {
    return Boolean(user.LOCKED_UNTIL && new Date(user.LOCKED_UNTIL).getTime() > Date.now());
}

async function recordFailedLogin(id, currentFailedAttempts) {
    return withConnection(async (conn) => {
        const attempts = currentFailedAttempts + 1;
        const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

        await conn.execute(
            `UPDATE USERS
             SET FAILED_ATTEMPTS = :attempts,
                 LOCKED_UNTIL = CASE WHEN :shouldLock = 1
                     THEN SYSTIMESTAMP + NUMTODSINTERVAL(:lockMinutes, 'MINUTE')
                     ELSE LOCKED_UNTIL END
             WHERE ID = :id`,
            { attempts, shouldLock: shouldLock ? 1 : 0, lockMinutes: LOCKOUT_MINUTES, id },
            { autoCommit: true }
        );

        return { attempts, locked: shouldLock };
    });
}

async function updateUserPassword(id, passwordHash) {
    return withConnection(async (conn) => {
        await conn.execute(
            `UPDATE USERS
             SET PASSWORD_HASH = :passwordHash, FAILED_ATTEMPTS = 0, LOCKED_UNTIL = NULL
             WHERE ID = :id`,
            { passwordHash, id },
            { autoCommit: true }
        );
    });
}

async function deleteUserById(id) {
    return withConnection(async (conn) => {
        const result = await conn.execute(
            `DELETE FROM USERS WHERE ID = :id`,
            { id },
            { autoCommit: true }
        );

        return result.rowsAffected > 0;
    });
}

async function updateUserRole(id, role) {
    return withConnection(async (conn) => {
        const result = await conn.execute(
            `UPDATE USERS SET ROLE = :role WHERE ID = :id`,
            { id, role },
            { autoCommit: true }
        );

        return result.rowsAffected > 0;
    });
}

async function findAllEmployees() {
    return withConnection(async (conn) => {
        const result = await conn.execute(
            `SELECT ID, USERNAME, EMAIL, ROLE, LAST_LOGIN, CREATED_AT
             FROM USERS WHERE ROLE = 'EMPLOYEE' ORDER BY ID`
        );

        return result.rows;
    });
}

async function getUserRoleCounts() {
    return withConnection(async (conn) => {
        const result = await conn.execute(
            `SELECT ROLE, COUNT(*) AS CNT FROM USERS GROUP BY ROLE`
        );

        return result.rows;
    });
}

async function resetFailedLogin(id) {
    return withConnection(async (conn) => {
        await conn.execute(
            `UPDATE USERS
             SET FAILED_ATTEMPTS = 0, LOCKED_UNTIL = NULL, LAST_LOGIN = SYSTIMESTAMP
             WHERE ID = :id`,
            { id },
            { autoCommit: true }
        );
    });
}

module.exports = {
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_MINUTES,
    findUserByUsername,
    findUserById,
    findUserByIdWithPassword,
    findUserByEmail,
    findUserByUsernameOrEmail,
    findAllUsers,
    findAllEmployees,
    getUserRoleCounts,
    createUser,
    isAccountLocked,
    recordFailedLogin,
    resetFailedLogin,
    updateUserPassword,
    deleteUserById,
    updateUserRole,
};
