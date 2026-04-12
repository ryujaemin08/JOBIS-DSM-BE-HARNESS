import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnLogged, reportDir, nowIso, getGitSha } from "./_common.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const maxAttempts = 5;
const attempts = [];
let repeatedClassCount = 0;
let lastFailureClass = null;

function classifyFailure(message) {
  const text = (message || "").toLowerCase();
  if (text.includes("access_token") || text.includes("login failed")) return "auth_failure";
  if (text.includes("recruitments")) return "recruitments_failure";
  if (text.includes("econnrefused") || text.includes("remote server") || text.includes("connect")) return "app_unreachable";
  if (text.includes("500")) return "unexpected_5xx";
  return "unknown_failure";
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const run = await spawnLogged("node", [path.join(__dirname, "run-qa.mjs")]);
  if (run.code === 0) {
    const summary = JSON.parse(fs.readFileSync(path.join(reportDir, "qa-summary.json"), "utf8"));
    const loopReport = {
      scenario: {
        name: "qa-loop",
        path: "harness/scripts/qa-loop.mjs",
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
    fs.writeFileSync(path.join(reportDir, "qa-loop-summary.json"), `${JSON.stringify(loopReport, null, 2)}\n`);
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

  if (["app_unreachable", "unexpected_5xx"].includes(failureClass)) {
    await spawnLogged("node", [path.join(__dirname, "up.mjs")]);
  }

  if (repeatedClassCount >= 3) {
    const loopReport = {
      scenario: {
        name: "qa-loop",
        path: "harness/scripts/qa-loop.mjs",
        git_sha: await getGitSha(),
        generated_at: nowIso(),
      },
      success: false,
      stop_reason: `same_failure_repeated:${failureClass}`,
      attempts: attempt,
      history: attempts,
    };
    fs.writeFileSync(path.join(reportDir, "qa-loop-summary.json"), `${JSON.stringify(loopReport, null, 2)}\n`);
    console.log(JSON.stringify(loopReport, null, 2));
    process.exit(1);
  }
}

const loopReport = {
  scenario: {
    name: "qa-loop",
    path: "harness/scripts/qa-loop.mjs",
    git_sha: await getGitSha(),
    generated_at: nowIso(),
  },
  success: false,
  stop_reason: "max_attempts_reached",
  attempts: maxAttempts,
  history: attempts,
};
fs.writeFileSync(path.join(reportDir, "qa-loop-summary.json"), `${JSON.stringify(loopReport, null, 2)}\n`);
console.log(JSON.stringify(loopReport, null, 2));
process.exit(1);
