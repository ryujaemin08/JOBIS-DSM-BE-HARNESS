import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, "..", "..");
export const reportDir = path.join(repoRoot, "harness", "reports", "generated");
export const fixtureGeneratedDir = path.join(repoRoot, "harness", "fixtures", "generated");
export const composeFile = path.join(repoRoot, "harness", "docker-compose.harness.yml");
export const pidFile = path.join(reportDir, "app.pid");
export const appOutLog = path.join(reportDir, "app.out.log");
export const appErrLog = path.join(reportDir, "app.err.log");
export const runtimeFile = path.join(reportDir, "runtime.json");
export const fixturePlanFile = path.join(fixtureGeneratedDir, "fixture-plan.json");
export const composeProjectName = `jobis_harness_${path.basename(repoRoot).replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;

// Fixed container names from docker-compose.harness.yml (container_name overrides project-based naming)
export const containerNames = {
  mysql: "jobis-harness-mysql",
  redis: "jobis-harness-redis",
  rabbitmq: "jobis-harness-rabbitmq",
  mockHttp: "jobis-harness-mock-http",
};
export const scenarioGeneratedDir = path.join(repoRoot, "harness", "scenarios", "generated");
export const generatedQaScenarioDir = path.join(scenarioGeneratedDir, "api");
export const generatedSreScenarioDir = path.join(scenarioGeneratedDir, "reliability");

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
  HARNESS_RABBITMQ_MANAGEMENT_PORT: "35673",
  HARNESS_RABBITMQ_USERNAME: "guest",
  HARNESS_RABBITMQ_PASSWORD: "guest",
  HARNESS_JWT_SECRET: "harness-secret-key-please-change-if-needed",
  HARNESS_FCM_JSON: "{}",
  HARNESS_MOCK_HTTP_PORT: "38080",
  HARNESS_SLACK_URL: "http://localhost:38080/slack/",
  HARNESS_SLACK_TOKEN: "noop",
  HARNESS_API_ACCESS_KEY: "harness-access-key",
};

export function ensureReportDir() {
  fs.mkdirSync(reportDir, { recursive: true });
}

export function ensureFixtureGeneratedDir() {
  fs.mkdirSync(fixtureGeneratedDir, { recursive: true });
}

export function readRuntimeEnv() {
  if (!fs.existsSync(runtimeFile)) return { ...harnessEnv };
  try {
    return { ...harnessEnv, ...JSON.parse(fs.readFileSync(runtimeFile, "utf8")) };
  } catch {
    return { ...harnessEnv };
  }
}

export function writeRuntimeEnv(runtimeEnv) {
  ensureReportDir();
  fs.writeFileSync(runtimeFile, `${JSON.stringify(runtimeEnv, null, 2)}\n`);
}

export function readFixturePlan(planPath = fixturePlanFile) {
  if (!fs.existsSync(planPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(planPath, "utf8"));
  } catch {
    return null;
  }
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
      env: { ...process.env, ...readRuntimeEnv(), ...options.env },
      shell: false,
      stdio: options.stdio ?? "pipe",
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

export async function dockerCompose(args) {
  const result = await spawnLogged("docker", ["compose", "-p", composeProjectName, "-f", composeFile, ...args], { env: readRuntimeEnv() });
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

    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

export async function mysqlQuery(sql) {
  const result = await docker(
    ["exec", "-i", containerNames.mysql, "mysql", "-N", "-uroot", "-p1234", "-D", "jobis_harness"],
    `${sql}\n`,
  );
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || "mysql query failed");
  }
  return result.stdout.trim();
}

export async function listExistingTables() {
  const sql = `
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'jobis_harness'
ORDER BY table_name;
  `;
  const raw = await mysqlQuery(sql);
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
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

export async function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once("error", () => resolve(false))
      .once("listening", () => tester.close(() => resolve(true)))
      .listen(port, "127.0.0.1");
  });
}

export async function findFreePort(startPort, endPort = startPort + 200) {
  for (let port = startPort; port <= endPort; port += 1) {
    if (await isPortFree(port)) return String(port);
  }
  throw new Error(`No free port found in range ${startPort}-${endPort}`);
}

export function repoRelative(p) {
  return path.relative(repoRoot, path.resolve(p)).split(path.sep).join("/");
}

async function stopAllJobisProcessesUnix() {
  const result = await spawnLogged("sh", ["-c",
    "pgrep -f 'team\\.retum\\.jobis\\.JobisApplication\\|jobis-infrastructure:bootRun' 2>/dev/null || true",
  ]);
  if (!result.stdout.trim()) return;
  const pids = result.stdout.trim().split(/\n/).filter(Boolean);
  for (const pid of pids) {
    await spawnLogged("kill", ["-TERM", pid]);
  }
  if (pids.length > 0) {
    await sleep(2000);
  }
}

export async function stopAllJobisProcessesWindows() {
  if (!isWindows()) return;

  const command = [
    "$targets = Get-CimInstance Win32_Process | Where-Object {",
    "  ($_.Name -eq 'java.exe' -or $_.Name -eq 'powershell.exe' -or $_.Name -eq 'cmd.exe') -and",
    "  ($_.CommandLine -match 'team\\.retum\\.jobis\\.JobisApplication' -or $_.CommandLine -match ':jobis-infrastructure:bootRun' -or $_.CommandLine -match 'JOBIS-DSM-BE')",
    "};",
    "if ($targets) { $targets.ProcessId | ConvertTo-Json -Compress }"
  ].join(" ");

  const result = await spawnLogged("powershell", ["-NoProfile", "-Command", command]);
  if (result.code !== 0 || !result.stdout.trim()) return;

  let processIds = [];
  try {
    const parsed = JSON.parse(result.stdout.trim());
    processIds = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return;
  }

  for (const processId of processIds) {
    if (!processId) continue;
    await spawnLogged("taskkill", ["/PID", String(processId), "/T", "/F"]);
  }

  if (processIds.length > 0) {
    await sleep(2000);
  }
}

export async function stopExistingHarnessProcess() {
  if (isWindows()) {
    await stopAllJobisProcessesWindows();
  } else {
    await stopAllJobisProcessesUnix();
  }

  if (!fs.existsSync(pidFile)) {
    return;
  }

  const pid = Number(fs.readFileSync(pidFile, "utf8").trim());
  if (pid) {
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
  }

  for (let i = 0; i < 5; i += 1) {
    try {
      fs.rmSync(pidFile, { force: true });
      break;
    } catch {
      await sleep(500);
    }
  }
}

export async function stopExistingHarnessResources() {
  await stopExistingHarnessProcess();
  try {
    await dockerCompose(["down", "-v", "--remove-orphans"]);
  } catch {
  }
}

export function getGradleCommand() {
  if (isWindows()) {
    return {
      command: "cmd.exe",
      args: ["/c", path.join(repoRoot, "gradlew.bat"), ":jobis-infrastructure:bootRun"],
    };
  }

  // gradlew on Windows NTFS has CRLF line endings; strip \r before executing
  return {
    command: "bash",
    args: ["-c", `exec bash <(sed 's/\\r//' '${path.join(repoRoot, "gradlew")}') ':jobis-infrastructure:bootRun'`],
  };
}

export function startBootRunProcess() {
  ensureReportDir();
  fs.rmSync(appOutLog, { force: true });
  fs.rmSync(appErrLog, { force: true });

  const { command, args } = getGradleCommand();
  const runtimeEnv = readRuntimeEnv();
  const outFd = fs.openSync(appOutLog, "a");
  const errFd = fs.openSync(appErrLog, "a");

  const child = spawn(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...runtimeEnv },
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
  const runtimeEnv = readRuntimeEnv();
  const dependencies = [
    { name: containerNames.mysql, port: Number(runtimeEnv.HARNESS_MYSQL_PORT), requireHealth: true },
    { name: containerNames.redis, port: Number(runtimeEnv.HARNESS_REDIS_PORT), requireHealth: false },
    { name: containerNames.rabbitmq, port: Number(runtimeEnv.HARNESS_RABBITMQ_PORT), requireHealth: true },
    { name: containerNames.mockHttp, port: Number(runtimeEnv.HARNESS_MOCK_HTTP_PORT), requireHealth: false },
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
  const runtimeEnv = readRuntimeEnv();
  const url = `http://localhost:${runtimeEnv.HARNESS_APP_PORT}/actuator/health`;
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

export function getBaseUrl(defaultBaseUrl = "http://localhost:18080") {
  const runtimeEnv = readRuntimeEnv();
  if (runtimeEnv.HARNESS_APP_PORT) {
    return `http://localhost:${runtimeEnv.HARNESS_APP_PORT}`;
  }
  return defaultBaseUrl;
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
  const query = deepTemplate(request.query ?? {}, context);
  const queryString = new URLSearchParams(
    Object.entries(query).filter(([, value]) => value != null && value !== ""),
  ).toString();
  const url = `${baseUrl}${pathValue}${queryString ? `?${queryString}` : ""}`;
  const startedAt = Date.now();
  const response = await fetch(url, { method, headers, body: bodyValue });
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
    url,
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

  for (const assertion of expect.assertions ?? []) {
    assertStructuredAssertion(stepId, result, assertion);
  }
}

function assertStructuredAssertion(stepId, result, assertion) {
  switch (assertion.type) {
    case "path_exists": {
      if (getPath(result.body, assertion.path) == null) {
        throw new Error(`${stepId} expected path ${assertion.path} to exist`);
      }
      return;
    }
    case "path_equals": {
      if (getPath(result.body, assertion.path) !== assertion.expected) {
        throw new Error(`${stepId} expected ${assertion.path}=${assertion.expected}`);
      }
      return;
    }
    case "path_not_empty": {
      const value = getPath(result.body, assertion.path);
      if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
        throw new Error(`${stepId} expected ${assertion.path} to be non-empty`);
      }
      return;
    }
    case "body_null": {
      if (result.body != null && result.raw_text !== "") {
        throw new Error(`${stepId} expected empty response body`);
      }
      return;
    }
    case "array_min_items": {
      const items = getRequiredArray(stepId, result, assertion.array_path);
      if (items.length < assertion.count) {
        throw new Error(`${stepId} expected at least ${assertion.count} items at ${assertion.array_path}`);
      }
      return;
    }
    case "array_length_matches_path": {
      const items = getRequiredArray(stepId, result, assertion.array_path);
      const value = getPath(result.body, assertion.path);
      if (value !== items.length) {
        throw new Error(`${stepId} expected ${assertion.path} to equal ${assertion.array_path}.length (${items.length})`);
      }
      return;
    }
    case "all_items_required_fields": {
      const items = getRequiredArray(stepId, result, assertion.array_path);
      if (items.length === 0) {
        throw new Error(`${stepId} expected non-empty array at ${assertion.array_path}`);
      }
      for (const [index, item] of items.entries()) {
        for (const field of assertion.fields ?? []) {
          if (item == null || !(field in item)) {
            throw new Error(`${stepId} item[${index}] missing field ${field}`);
          }
        }
      }
      return;
    }
    case "all_items_field_equals": {
      const items = getRequiredArray(stepId, result, assertion.array_path);
      for (const [index, item] of items.entries()) {
        if (item?.[assertion.field] !== assertion.expected) {
          throw new Error(`${stepId} item[${index}].${assertion.field} expected ${assertion.expected}`);
        }
      }
      return;
    }
    case "all_items_field_contains": {
      const items = getRequiredArray(stepId, result, assertion.array_path);
      for (const [index, item] of items.entries()) {
        const value = item?.[assertion.field];
        if (typeof value !== "string" || !value.includes(assertion.expected)) {
          throw new Error(`${stepId} item[${index}].${assertion.field} expected to contain ${assertion.expected}`);
        }
      }
      return;
    }
    case "all_items_date_part_equals": {
      const items = getRequiredArray(stepId, result, assertion.array_path);
      for (const [index, item] of items.entries()) {
        const value = item?.[assertion.field];
        const actual = readDatePart(value, assertion.part);
        if (actual !== assertion.expected) {
          throw new Error(`${stepId} item[${index}].${assertion.field} ${assertion.part} expected ${assertion.expected} but was ${actual}`);
        }
      }
      return;
    }
    case "array_contains_all": {
      const values = getRequiredArray(stepId, result, assertion.path);
      for (const expectedValue of assertion.values ?? []) {
        if (!values.includes(expectedValue)) {
          throw new Error(`${stepId} expected ${assertion.path} to contain ${expectedValue}`);
        }
      }
      return;
    }
    default:
      throw new Error(`${stepId} has unsupported assertion type ${assertion.type}`);
  }
}

function getRequiredArray(stepId, result, pathValue) {
  const value = getPath(result.body, pathValue);
  if (!Array.isArray(value)) {
    throw new Error(`${stepId} expected array at ${pathValue}`);
  }
  return value;
}

function readDatePart(value, part) {
  if (typeof value !== "string") {
    return null;
  }

  const [year, month] = value.split("-").map((segment) => Number(segment));
  if (part === "year") {
    return year;
  }
  if (part === "month") {
    return month;
  }
  return null;
}
