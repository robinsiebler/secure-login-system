module.exports = [
    {
        ignores: ["node_modules/**", "coverage/**"],
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                require: "readonly",
                module: "writable",
                exports: "writable",
                process: "readonly",
                __dirname: "readonly",
                console: "readonly",
            },
        },
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "error",
        },
    },
    {
        files: ["frontend/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: {
                document: "readonly",
                window: "readonly",
                fetch: "readonly",
                sessionStorage: "readonly",
                localStorage: "readonly",
                URLSearchParams: "readonly",
            },
        },
    },
    {
        files: ["**/*.test.js"],
        languageOptions: {
            globals: {
                describe: "readonly",
                test: "readonly",
                it: "readonly",
                expect: "readonly",
                beforeEach: "readonly",
                afterEach: "readonly",
                jest: "readonly",
            },
        },
    },
];
