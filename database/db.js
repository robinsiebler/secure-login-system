const oracledb = require("oracledb");
require("dotenv").config({ quiet: true });

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false;

let pool;

async function initPool() {
    if (pool) {
        return pool;
    }

    pool = await oracledb.createPool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectString: process.env.DB_CONNECTION_STRING,
        poolMin: 1,
        poolMax: 10,
        poolIncrement: 1,
    });

    return pool;
}

async function withConnection(callback) {
    const activePool = await initPool();
    const connection = await activePool.getConnection();

    try {
        return await callback(connection);
    } finally {
        await connection.close();
    }
}

async function closePool() {
    if (pool) {
        await pool.close(10);
        pool = null;
    }
}

module.exports = { initPool, withConnection, closePool };
