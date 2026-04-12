import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, "..", "..");
export const reportDir = path.join(repoRoot, "harness", "reports", "latest");
export const composeFile = path.join(repoRoot, "harness", "docker-compose.harness.yml");
export const pidFile = path.join(reportDir, "app.pid");
export const appOutLog = path.join(reportDir, "app.out.log");
export const appErrLog = path.join(reportDir, "app.err.log");

export const harnessEnv = {
  PROFILE: "harness",
  HARNESS_APP_PORT: "18080",
  HARNESS_MYSQL_PORT: "33306",
  HARNESS_DB_NAME: "jobis_harness",
  HARNESS_DB_USERNAME: "root",
  HARNESS_DB_PASSWORD: "1234",
  HARNESS_REDIS_HOST: "localhost",
  HARNESS_REDIS_PORT: "36379",
  HARNESS_REDIS_PASSWORD: "asdf",
  HARNESS_RABBITMQ_HOST: "localhost",
  HARNESS_RABBITMQ_PORT: "35672",
  HARNESS_RABBITMQ_USERNAME: "guest",
  HARNESS_RABBITMQ_PASSWORD: "guest",
  HARNESS_JWT_SECRET: "harness-secret-key-please-change-if-needed",
  HARNESS_FCM_JSON: "{}",
  HARNESS_SLACK_URL: "http://localhost:38080/slack/",
  HARNESS_SLACK_TOKEN: "noop",
  HARNESS_API_ACCESS_KEY: "harness-access-key",
};

export const qaScenarioPath = "harness/scenarios/api/student-login-recruitments.json";
export const sreScenarioPath = "harness/scenarios/reliability/startup-health.json";

export function ensureReportDir() {
  fs.mkdirSync(reportDir, { recursive: true });
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isWindows() {
  return process.platform === "win32";
}

export function spawnLogged(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: { ...process.env, ...harnessEnv, ...options.env },
      shell: false,
      stdio: options.stdio ?? "pipe",
    });

    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

export async function dockerCompose(args) {
  const result = await spawnLogged("docker", ["compose", "-f", composeFile, ...args]);
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || `docker compose failed: ${args.join(" ")}`);
  }
  return result;
}

export async function docker(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

export async function mysqlQuery(sql) {
  const result = await docker(
    ["exec", "-i", "jobis-harness-mysql", "mysql", "-N", "-uroot", "-p1234", "-D", "jobis_harness"],
    `${sql}\n`,
  );
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || "mysql query failed");
  }
  return result.stdout.trim();
}

export async function getDockerHealth(containerName) {
  const result = await spawnLogged("docker", [
    "inspect",
    "--format",
    "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}",
    containerName,
  ]);
  if (result.code !== 0) {
    return null;
  }
  return result.stdout.trim();
}

export async function waitForPort(port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const done = (value) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(value);
      }
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, "127.0.0.1");
  });
}

export async function stopExistingHarnessProcess() {
  if (!fs.existsSync(pidFile)) {
    return;
  }

  const pid = Number(fs.readFileSync(pidFile, "utf8").trim());
  if (!pid) {
    fs.rmSync(pidFile, { force: true });
    return;
  }

  if (isWindows()) {
    await spawnLogged("taskkill", ["/PID", String(pid), "/T", "/F"]);
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
      }
    }
  }

  await sleep(1500);
  for (let i = 0; i < 5; i += 1) {
    try {
      fs.rmSync(pidFile, { force: true });
      break;
    } catch {
      await sleep(500);
    }
  }
}

export function getGradleCommand() {
  if (isWindows()) {
    return {
      command: "cmd.exe",
      args: ["/c", path.join(repoRoot, "gradlew.bat"), ":jobis-infrastructure:bootRun"],
    };
  }

  return {
    command: path.join(repoRoot, "gradlew"),
    args: [":jobis-infrastructure:bootRun"],
  };
}

export function startBootRunProcess() {
  ensureReportDir();
  fs.rmSync(appOutLog, { force: true });
  fs.rmSync(appErrLog, { force: true });

  const { command, args } = getGradleCommand();
  const outFd = fs.openSync(appOutLog, "a");
  const errFd = fs.openSync(appErrLog, "a");

  const child = spawn(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...harnessEnv },
    detached: !isWindows(),
    shell: false,
    stdio: ["ignore", outFd, errFd],
  });

  fs.writeFileSync(pidFile, String(child.pid));
  child.unref();
  fs.closeSync(outFd);
  fs.closeSync(errFd);

  return child.pid;
}

export async function waitForDependencies() {
  const dependencies = [
    { name: "jobis-harness-mysql", port: 33306, requireHealth: true },
    { name: "jobis-harness-redis", port: 36379, requireHealth: false },
    { name: "jobis-harness-rabbitmq", port: 35672, requireHealth: false },
    { name: "jobis-harness-mock-http", port: 38080, requireHealth: false },
  ];

  for (const dependency of dependencies) {
    let ready = false;
    for (let i = 0; i < 90; i += 1) {
      if (dependency.requireHealth) {
        const health = await getDockerHealth(dependency.name);
        if (["healthy", "none"].includes(health)) {
          ready = true;
          break;
        }
      } else if (await waitForPort(dependency.port, 1000)) {
        ready = true;
        break;
      }
      await sleep(1000);
    }
    if (!ready) {
      throw new Error(`Dependency [${dependency.name}] was not healthy and reachable on port ${dependency.port}.`);
    }
  }
}

export async function waitForHealth() {
  const url = `http://localhost:${harnessEnv.HARNESS_APP_PORT}/actuator/health`;
  for (let i = 0; i < 300; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const body = await response.json();
        if (body.status === "UP") {
          return body;
        }
      }
    } catch {
    }
    await sleep(1000);
  }
  throw new Error("Harness app did not become healthy.");
}

export async function waitForTables(tableNames) {
  for (let i = 0; i < 120; i += 1) {
    try {
      const sql = `
SELECT COUNT(*)
FROM information_schema.tables
WHERE table_schema = 'jobis_harness'
  AND table_name IN (${tableNames.map((name) => `'${name}'`).join(",")});
      `;
      const count = Number(await mysqlQuery(sql));
      if (count === tableNames.length) {
        return;
      }
    } catch {
    }
    await sleep(1000);
  }
  throw new Error(`Required tables were not created in time: ${tableNames.join(", ")}`);
}

export async function getGitSha() {
  const result = await spawnLogged("git", ["rev-parse", "--short", "HEAD"]);
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to read git sha");
  }
  return result.stdout.trim();
}

export function nowIso() {
  return new Date().toISOString();
}

export function getPath(obj, dottedPath) {
  if (!dottedPath) return obj;
  return dottedPath.split(".").reduce((current, segment) => {
    if (current == null) return undefined;
    return current[segment];
  }, obj);
}

export function deepTemplate(value, context) {
  if (typeof value === "string") {
    return value.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
      const resolved = getPath(context, expr.trim());
      return resolved == null ? "" : String(resolved);
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepTemplate(item, context));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, deepTemplate(val, context)]),
    );
  }
  return value;
}

export function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

export async function httpRequest(baseUrl, request, context = {}) {
  const method = request.method ?? "GET";
  const pathValue = deepTemplate(request.path ?? "/", context);
  const headers = deepTemplate(request.headers ?? {}, context);
  const bodyValue = request.body == null ? undefined : JSON.stringify(deepTemplate(request.body, context));
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${pathValue}`, {
    method,
    headers,
    body: bodyValue,
  });
  const durationMs = Date.now() - startedAt;
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return {
    status: response.status,
    duration_ms: durationMs,
    headers: Object.fromEntries(response.headers.entries()),
    body,
    raw_text: text,
  };
}

export function assertResponse(stepId, result, expect = {}) {
  if (expect.status != null && result.status !== expect.status) {
    throw new Error(`${stepId} failed with status ${result.status}`);
  }

  for (const requiredPath of expect.required_paths ?? []) {
    if (getPath(result.body, requiredPath) == null) {
      throw new Error(`${stepId} missing required path ${requiredPath}`);
    }
  }

  for (const [pathKey, expectedValue] of Object.entries(expect.equals ?? {})) {
    if (getPath(result.body, pathKey) !== expectedValue) {
      throw new Error(`${stepId} expected ${pathKey}=${expectedValue}`);
    }
  }

  if (expect.min_items) {
    const items = getPath(result.body, expect.min_items.path);
    if (!Array.isArray(items) || items.length < expect.min_items.count) {
      throw new Error(`${stepId} expected at least ${expect.min_items.count} items at ${expect.min_items.path}`);
    }
  }

  if (expect.first_item_required_paths) {
    const items = getPath(result.body, expect.first_item_required_paths.path);
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error(`${stepId} expected items at ${expect.first_item_required_paths.path}`);
    }
    for (const requiredPath of expect.first_item_required_paths.paths ?? []) {
      if (items[0][requiredPath] == null) {
        throw new Error(`${stepId} first item missing ${requiredPath}`);
      }
    }
  }

  for (const token of expect.contains ?? []) {
    const haystack = typeof result.body === "string" ? result.body : result.raw_text;
    if (!haystack.includes(token)) {
      throw new Error(`${stepId} expected response to contain ${token}`);
    }
  }
}
