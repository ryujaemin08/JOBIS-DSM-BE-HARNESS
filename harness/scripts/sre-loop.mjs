import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnLogged, reportDir, nowIso, getGitSha } from "./_common.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scenarioArgIndex = process.argv.indexOf("--scenario");
const scenarioPath = scenarioArgIndex >= 0 ? process.argv[scenarioArgIndex + 1] : null;

const maxAttempts = 5;
const attempts = [];
let repeatedClassCount = 0;
let lastFailureClass = null;

function classifyFailure(message) {
  const text = (message || "").toLowerCase();
  if (text.includes("health")) return "health_failure";
  if (text.includes("exception-like")) return "log_failure";
  if (text.includes("econnrefused") || text.includes("remote server") || text.includes("connect")) return "app_unreachable";
  return "unknown_failure";
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const args = [path.join(__dirname, "run-sre.mjs")];
  if (scenarioPath) args.push("--scenario", scenarioPath);
  const run = await spawnLogged("node", args);
  if (run.code === 0) {
    const summary = JSON.parse(fs.readFileSync(path.join(reportDir, "sre-summary.json"), "utf8"));
    const loopReport = {
      scenario: {
        name: "sre-loop",
        path: "harness/scripts/sre-loop.mjs",
        git_sha: await getGitSha(),
        generated_at: nowIso(),
      },
      success: true,
      attempts: attempt,
      history: [
        ...attempts,
        { attempt, success: true, result: summary },
      ],
    };
    fs.writeFileSync(path.join(reportDir, "sre-loop-summary.json"), `${JSON.stringify(loopReport, null, 2)}\n`);
    console.log(JSON.stringify(loopReport, null, 2));
    process.exit(0);
  }

  const failureMessage = (run.stderr || run.stdout || "").trim();
  const failureClass = classifyFailure(failureMessage);

  repeatedClassCount = failureClass === lastFailureClass ? repeatedClassCount + 1 : 1;
  lastFailureClass = failureClass;

  attempts.push({
    attempt,
    success: false,
    failure_class: failureClass,
    message_excerpt: failureMessage.slice(0, 500),
  });

  if (["app_unreachable", "health_failure"].includes(failureClass)) {
    await spawnLogged("node", [path.join(__dirname, "up.mjs")]);
  }

  if (repeatedClassCount >= 3) {
    const loopReport = {
      scenario: {
        name: "sre-loop",
        path: "harness/scripts/sre-loop.mjs",
        git_sha: await getGitSha(),
        generated_at: nowIso(),
      },
      success: false,
      stop_reason: `same_failure_repeated:${failureClass}`,
      attempts: attempt,
      history: attempts,
    };
    fs.writeFileSync(path.join(reportDir, "sre-loop-summary.json"), `${JSON.stringify(loopReport, null, 2)}\n`);
    console.log(JSON.stringify(loopReport, null, 2));
    process.exit(1);
  }
}

const loopReport = {
  scenario: {
    name: "sre-loop",
    path: "harness/scripts/sre-loop.mjs",
    git_sha: await getGitSha(),
    generated_at: nowIso(),
  },
  success: false,
  stop_reason: "max_attempts_reached",
  attempts: maxAttempts,
  history: attempts,
};
fs.writeFileSync(path.join(reportDir, "sre-loop-summary.json"), `${JSON.stringify(loopReport, null, 2)}\n`);
console.log(JSON.stringify(loopReport, null, 2));
process.exit(1);
