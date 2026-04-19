import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const requestsRoot = path.join(repoRoot, "harness", "requests");

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function readJson(targetPath) {
  return JSON.parse(fs.readFileSync(targetPath, "utf8").replace(/^\uFEFF/, ""));
}

function walk(dir) {
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "templates") continue;
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...walk(absolutePath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      output.push(absolutePath);
    }
  }
  return output;
}

function extractPathHints(task) {
  const explicitPaths = [...String(task).matchAll(/\/[a-zA-Z0-9\-_/{}]+/g)].map((match) => match[0]);
  return explicitPaths;
}

function scoreContract(task, spec) {
  const lowerTask = String(task).toLowerCase();
  let score = 0;
  if (spec.path && lowerTask.includes(String(spec.path).toLowerCase())) score += 100;
  if (spec.name && lowerTask.includes(String(spec.name).toLowerCase().replace(/-/g, " "))) score += 40;
  if (spec.summary && lowerTask.includes(String(spec.summary).toLowerCase())) score += 20;
  if (spec.purpose && lowerTask.includes(String(spec.purpose).toLowerCase())) score += 10;
  const pathTokens = String(spec.path ?? "").toLowerCase().split("/").filter(Boolean);
  for (const token of pathTokens) {
    if (token.length > 2 && lowerTask.includes(token)) score += 15;
  }
  if (/latency|performance|400ms|p95|response time|응답시간|성능/.test(lowerTask) && spec.responses?.success?.status) {
    score += 10;
  }
  return score;
}

const task = argValue("--task") ?? "";
const explicitPath = argValue("--path");
const pathHints = explicitPath ? [explicitPath] : extractPathHints(task);
const files = walk(requestsRoot);

const candidates = files
  .map((filePath) => {
    const spec = readJson(filePath);
    let score = scoreContract(task, spec);
    if (pathHints.length > 0 && pathHints.some((hint) => hint === spec.path)) score += 200;
    return {
      path: path.relative(repoRoot, filePath),
      spec,
      score,
    };
  })
  .filter((candidate) => candidate.score > 0)
  .sort((a, b) => b.score - a.score);

const best = candidates[0] ?? null;
const output = {
  task,
  matched: Boolean(best),
  request_path: best?.path ?? null,
  request_name: best?.spec?.name ?? null,
  score: best?.score ?? 0,
  candidates: candidates.slice(0, 5).map((candidate) => ({
    request_path: candidate.path,
    request_name: candidate.spec.name,
    score: candidate.score,
  })),
};

console.log(JSON.stringify(output, null, 2));
process.exit(best ? 0 : 2);
