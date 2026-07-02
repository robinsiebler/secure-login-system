const fs = require("fs");
const path = require("path");

const SCAN_DIRS = ["services", "database", "controllers", "routes", "middleware"];
const PROJECT_ROOT = path.join(__dirname, "..");

function findJsFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            return findJsFiles(fullPath);
        }

        return entry.name.endsWith(".js") ? [fullPath] : [];
    });
}

// Finds every `conn.execute(` call in the given source and inspects its first
// argument. Every query in this codebase passes a plain backtick template
// literal directly, with values bound via the second argument object — never
// a variable, a concatenated string, or a function call. `sql` is the
// captured literal body when that holds, or null when the call doesn't match
// that shape (a red flag worth failing the build over).
function scanExecuteCalls(source) {
    const calls = [];
    const callRegex = /conn\.execute\(/g;
    let match;

    while ((match = callRegex.exec(source)) !== null) {
        const after = source.slice(match.index + match[0].length);
        const firstNonSpaceIndex = after.search(/\S/);

        if (after[firstNonSpaceIndex] !== "`") {
            calls.push({ sql: null });
            continue;
        }

        const rest = after.slice(firstNonSpaceIndex + 1);
        calls.push({ sql: rest.slice(0, rest.indexOf("`")) });
    }

    return calls;
}

describe("SQL injection regression guard", () => {
    const jsFiles = SCAN_DIRS.flatMap((dir) => findJsFiles(path.join(PROJECT_ROOT, dir)));
    const allCalls = jsFiles.flatMap((file) =>
        scanExecuteCalls(fs.readFileSync(file, "utf8")).map((call) => ({
            file: path.relative(PROJECT_ROOT, file),
            ...call,
        }))
    );

    test("found conn.execute() calls to check (sanity check that the scanner itself works)", () => {
        expect(allCalls.length).toBeGreaterThan(10);
    });

    test("every conn.execute() call passes a plain template-literal SQL string as its first argument", () => {
        const nonLiteral = allCalls.filter((call) => call.sql === null);
        expect(nonLiteral).toEqual([]);
    });

    test.each(
        allCalls
            .filter((call) => call.sql !== null)
            .map((call) => [call.file, call.sql.replace(/\s+/g, " ").trim().slice(0, 60), call.sql])
    )("%s (%s) has no interpolated expressions", (file, label, sql) => {
        expect(sql).not.toMatch(/\$\{/);
    });
});
