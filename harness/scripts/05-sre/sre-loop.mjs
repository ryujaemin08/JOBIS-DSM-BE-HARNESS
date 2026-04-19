import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  spawnLogged,
  reportDir,
  nowIso,
  getGitSha,
  repoRelative,
} from "../_common.mjs";
import {
  resolveTargetRequestPaths,
  resolveExplicitRequestArgs,
  loadRequestSpec,
  buildSreScenarioForRequest,
  writeScenario,
  requestNeedsSre,
} from "../_contract.mjs";

const maxAttempts = 5;
const attempts = [];
let repeatedClassCount = 0;
let lastFailureClass = null;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const recoverableFailures = new Set([
  "contract_security_mismatch",
  "contract_web_mismatch",
  "health_failure",
  "log_failure",
  "app_unreachable",
]);
const terminalFailures = new Set([
  "architecture_violation",
  "fixture_failure",
  "intake_failure",
  "sre_failure",
]);

function classifyFailure(message) {
  const text = (message || "").toLowerCase();
  if (text.includes("architecture_violation")) return "architecture_violation";
  if (text.includes("contract_security_mismatch")) return "contract_security_mismatch";
  if (text.includes("contract_web_mismatch")) return "contract_web_mismatch";
  if (text.includes("fixture_failure")) return "fixture_failure";
  if (text.includes("intake_failure")) return "intake_failure";
  if (text.includes("sre_failure")) return "sre_failure";
  if (text.includes("health")) return "health_failure";
  if (text.includes("exception-like")) return "log_failure";
  if (text.includes("econnrefused") || text.includes("connect")) return "app_unreachable";
  return "unknown_failure";
}

async function runScenario(scenarioPath) {
  return spawnLogged("node", [path.join(__dirname, "run-sre.mjs"), "--scenario", scenarioPath]);
}

async function runArchitectureGuard() {
  return spawnLogged("node", [path.join(__dirname, "../check-architecture.mjs")]);
}

async function buildScenarios(requestPaths) {
  const built = [];
  for (const requestPath of requestPaths) {
    const requestSpec = loadRequestSpec(requestPath);
    if (!requestNeedsSre(requestSpec)) {
      continue;
    }
    const scenario = buildSreScenarioForRequest(requestSpec);
    const scenarioPath = writeScenario("sre", requestSpec, scenario);
    built.push({
      request: requestSpec.__relative_path,
      scenario: repoRelative(scenarioPath),
      absolute_scenario: scenarioPath,
    });
  }
  if (built.length === 0) {
    throw new Error("sre_failure:no_runtime_sensitive_request_contracts");
  }
  return built;
}

function buildRecoveryResult(attempt, failureClass, failureMessage) {
  return {
    scenario: {
      name: "sre-loop",
      path: "harness/scripts/sre-loop.mjs",
      git_sha: null,
      generated_at: nowIso(),
    },
    success: false,
    recoverable: true,
    continue_without_user: true,
    stop_reason: `recovery_required:${failureClass}`,
    attempts: attempt,
    request_contracts: targetRequestPaths.map((requestPath) => repoRelative(requestPath)),
    recovery: {
      failed_stage: "sre",
      failure_class: failureClass,
      message: failureMessage.trim(),
      next_action: nextActionForFailure(failureClass),
      rerun_command: `node harness/scripts/sre-loop.mjs ${targetRequestPaths.map((requestPath) => `--request ${repoRelative(requestPath)}`).join(" ")}`,
    },
    history: attempts,
  };
}

function nextActionForFailure(failureClass) {
  switch (failureClass) {
    case "contract_security_mismatch":
      return "Update SecurityConfig to match the request contract, then rerun sre-loop.";
    case "contract_web_mismatch":
      return "Update the target WebAdapter to match the request contract, then rerun sre-loop.";
    case "health_failure":
    case "app_unreachable":
      return "Fix startup/runtime availability, then rerun sre-loop.";
    case "log_failure":
      return "Fix repeated startup/runtime errors in logs, then rerun sre-loop.";
    default:
      return "Fix the reported blocker, then rerun sre-loop.";
  }
}

const explicitRequests = resolveExplicitRequestArgs();
const targetRequestPaths = await resolveTargetRequestPaths({ explicitPaths: explicitRequests });

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    const architecture = await runArchitectureGuard();
    if (architecture.code !== 0) {
      throw new Error(architecture.stdout || architecture.stderr || "architecture_violation");
    }

    const scenarios = await buildScenarios(targetRequestPaths);
    const results = [];

    for (const builtScenario of scenarios) {
      const run = await runScenario(builtScenario.absolute_scenario);
      if (run.code !== 0) {
        throw new Error(run.stderr || run.stdout || `${builtScenario.request} sre run failed`);
      }
      results.push(JSON.parse(fs.readFileSync(path.join(reportDir, "sre-summary.json"), "utf8")));
    }

    const loopReport = {
      scenario: {
        name: "sre-loop",
        path: "harness/scripts/sre-loop.mjs",
        git_sha: await getGitSha(),
        generated_at: nowIso(),
      },
      success: true,
      attempts: attempt,
      request_contracts: targetRequestPaths.map((requestPath) => repoRelative(requestPath)),
      results,
      history: [
        ...attempts,
        {
          attempt,
          success: true,
          requests: targetRequestPaths.map((requestPath) => repoRelative(requestPath)),
        },
      ],
    };
    fs.writeFileSync(path.join(reportDir, "sre-loop-summary.json"), `${JSON.stringify(loopReport, null, 2)}\n`);
    console.log(JSON.stringify(loopReport, null, 2));
    process.exit(0);
  } catch (error) {
    const failureMessage = String(error?.message ?? error);
    const failureClass = classifyFailure(failureMessage);

    repeatedClassCount = failureClass === lastFailureClass ? repeatedClassCount + 1 : 1;
    lastFailureClass = failureClass;

    attempts.push({
      attempt,
      success: false,
      failure_class: failureClass,
      message_excerpt: failureMessage.slice(0, 500),
    });

    if (recoverableFailures.has(failureClass)) {
      const loopReport = buildRecoveryResult(attempt, failureClass, failureMessage);
      loopReport.scenario.git_sha = await getGitSha();
      fs.writeFileSync(path.join(reportDir, "sre-loop-summary.json"), `${JSON.stringify(loopReport, null, 2)}\n`);
      console.log(JSON.stringify(loopReport, null, 2));
      process.exit(1);
    }

    if (repeatedClassCount >= 3 || terminalFailures.has(failureClass)) {
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
        request_contracts: targetRequestPaths.map((requestPath) => repoRelative(requestPath)),
        history: attempts,
      };
      fs.writeFileSync(path.join(reportDir, "sre-loop-summary.json"), `${JSON.stringify(loopReport, null, 2)}\n`);
      console.log(JSON.stringify(loopReport, null, 2));
      process.exit(1);
    }
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
  request_contracts: targetRequestPaths.map((requestPath) => repoRelative(requestPath)),
  history: attempts,
};
fs.writeFileSync(path.join(reportDir, "sre-loop-summary.json"), `${JSON.stringify(loopReport, null, 2)}\n`);
console.log(JSON.stringify(loopReport, null, 2));
process.exit(1);
