const { withConnection } = require("../database/db");

const RESET_TOKEN_EXPIRY_MINUTES = 30;

async function createResetToken(userId, tokenHash) {
    return withConnection(async (conn) => {
        await conn.execute(
            `INSERT INTO PASSWORD_RESET_TOKENS (USER_ID, TOKEN_HASH, EXPIRES_AT)
             VALUES (:userId, :tokenHash, SYSTIMESTAMP + NUMTODSINTERVAL(:expiryMinutes, 'MINUTE'))`,
            { userId, tokenHash, expiryMinutes: RESET_TOKEN_EXPIRY_MINUTES },
            { autoCommit: true }
        );
    });
}

async function findValidResetToken(tokenHash) {
    return withConnection(async (conn) => {
        const result = await conn.execute(
            `SELECT ID, USER_ID, EXPIRES_AT, USED_AT
             FROM PASSWORD_RESET_TOKENS
             WHERE TOKEN_HASH = :tokenHash`,
            { tokenHash }
        );

        return result.rows[0] || null;
    });
}

function isTokenValid(tokenRow) {
    if (!tokenRow || tokenRow.USED_AT) {
        return false;
    }

    return new Date(tokenRow.EXPIRES_AT).getTime() > Date.now();
}

async function markTokenUsed(id) {
    return withConnection(async (conn) => {
        await conn.execute(
            `UPDATE PASSWORD_RESET_TOKENS SET USED_AT = SYSTIMESTAMP WHERE ID = :id`,
            { id },
            { autoCommit: true }
        );
    });
}

module.exports = {
    RESET_TOKEN_EXPIRY_MINUTES,
    createResetToken,
    findValidResetToken,
    isTokenValid,
    markTokenUsed,
};
