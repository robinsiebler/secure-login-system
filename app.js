require("dotenv").config({ quiet: true });

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const managerRoutes = require("./routes/managerRoutes");
const { closePool } = require("./database/db");

const REQUIRED_ENV_VARS = ["PORT", "DB_USER", "DB_PASSWORD", "DB_CONNECTION_STRING", "JWT_SECRET"];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
}

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

app.use(express.static(path.join(__dirname, "frontend")));

app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});

app.use("/api", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/manager", managerRoutes);

// Malformed JSON bodies throw a SyntaxError from body-parser before any route
// runs; without this handler Express's default error page leaks a stack trace
// (file paths, dependency versions) to the client.
app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
        return res.status(400).json({ error: "Invalid JSON in request body" });
    }

    next(err);
});

const server = app.listen(process.env.PORT, () => {
    console.log("Server running on port", process.env.PORT);
});

async function shutdown() {
    console.log("Shutting down...");
    server.close();
    await closePool();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = app;
