const { withConnection } = require("../database/db");

const HISTORY_LIMIT = 5;

async function getRecentPasswordHashes(userId, limit = HISTORY_LIMIT) {
    return withConnection(async (conn) => {
        const result = await conn.execute(
            `SELECT PASSWORD_HASH FROM PASSWORD_HISTORY
             WHERE USER_ID = :userId
             ORDER BY CREATED_AT DESC
             FETCH FIRST :limit ROWS ONLY`,
            { userId, limit }
        );

        return result.rows.map((row) => row.PASSWORD_HASH);
    });
}

async function addPasswordToHistory(userId, passwordHash) {
    return withConnection(async (conn) => {
        await conn.execute(
            `INSERT INTO PASSWORD_HISTORY (USER_ID, PASSWORD_HASH) VALUES (:userId, :passwordHash)`,
            { userId, passwordHash },
            { autoCommit: true }
        );
    });
}

module.exports = { HISTORY_LIMIT, getRecentPasswordHashes, addPasswordToHistory };
