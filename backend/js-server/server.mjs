import dotenv from "dotenv";
import express from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const execFileAsync = promisify(execFile);
const app = express();
const port = Number(process.env.PORT || 8000);

app.use(express.json({ limit: "32kb" }));
app.use((request, response, next) => {
    response.header("Access-Control-Allow-Origin", "*");
    response.header("Access-Control-Allow-Headers", "Content-Type");
    response.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (request.method === "OPTIONS") return response.sendStatus(204);
    next();
});

app.get("/", (_request, response) => {
    response.json({ status: "online", service: "Bhoomi Rakshak TinyFish proxy", health: "/health" });
});

app.get("/health", (_request, response) => {
    response.json({
        status: "ok",
        service: "bhoomi-rakshak-js-proxy",
        tinyfish: { configured: Boolean(process.env.TINYFISH_API_KEY) },
    });
});

app.post("/api/tinyfish/search", async (request, response) => {
    const query = typeof request.body?.query === "string" ? request.body.query.trim() : "";
    if (query.length < 2 || query.length > 500) {
        return response.status(422).json({ detail: "Search query must be between 2 and 500 characters" });
    }
    if (!process.env.TINYFISH_API_KEY) {
        return response.status(503).json({ detail: "TINYFISH_API_KEY is not configured" });
    }

    const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
    const cliQuery = process.platform === "win32"
        ? `"${query.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
        : query;
    try {
        const { stdout } = await execFileAsync(
            npxCommand,
            ["-y", "@tiny-fish/cli@latest", "search", "query", "--pretty", "--", cliQuery],
            {
                env: { ...process.env, TINYFISH_API_KEY: process.env.TINYFISH_API_KEY },
                timeout: 60000,
                maxBuffer: 1024 * 1024,
                shell: process.platform === "win32",
            },
        );
        let results = stdout.trim();
        try {
            results = JSON.parse(results);
        } catch {
            // Pretty CLI output is valid to return as text.
        }
        return response.json({ query, results });
    } catch (error) {
        const detail = error.stderr?.trim() || error.stdout?.trim() || error.message;
        return response.status(503).json({ detail: detail || "TinyFish search failed" });
    }
});

app.listen(port, () => {
    console.log(`TinyFish proxy listening on http://localhost:${port}`);
});
