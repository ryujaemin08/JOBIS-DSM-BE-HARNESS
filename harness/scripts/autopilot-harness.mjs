import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnLogged, nowIso, qaScenarioPath, sreScenarioPath } from "./_common.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const reportDir = path.join(repoRoot, "harness", "reports", "latest");

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

const task = argValue("--task") ?? "";
const requestPath = argValue("--request");
const qaScenario = argValue("--qa-scenario") ?? qaScenarioPath;
const sreScenario = argValue("--sre-scenario") ?? sreScenarioPath;
const skipSre = process.argv.includes("--skip-sre");
const keepUp = process.argv.includes("--keep-up");

const lifecycle = [];
const startedByScript = { value: false };

function record(step, data = {}) {
  lifecycle.push({
    step,
    timestamp: nowIso(),
    ...data,
  });
}

function classifyTask(taskText) {
  const lower = taskText.toLowerCase();
  const apiTask = /api|endpoint|controller|webadapter|request|response|면접|채용|interview|recruit/.test(lower);
  const runtimeSensitive = /performance|latency|timeout|health|metric|sre|startup|slow|response time/.test(lower);

  return {
    harness_required: apiTask || runtimeSensitive,
    qa_required: apiTask,
    sre_required: runtimeSensitive || apiTask,
    reason: {
      api_task: apiTask,
      runtime_sensitive: runtimeSensitive,
    }
  };
}

async function runNodeScript(scriptName, ...args) {
  const result = await spawnLogged("node", [path.join(__dirname, scriptName), ...args], { stdio: "pipe" });
  return result;
}

async function main() {
  record("analyze_request", { task });
  const decision = classifyTask(task);
  record("harness_decision", decision);

  if (!decision.harness_required) {
    const output = {
      success: true,
      harness_required: false,
      lifecycle,
      message: "Harness not required for this task."
    };
    fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (requestPath) {
    const intake = await runNodeScript("intake-api-request.mjs", "--request", requestPath);
    record("intake_request", {
      exit_code: intake.code,
      stdout: intake.stdout.trim(),
      stderr: intake.stderr.trim(),
    });
    if (intake.code !== 0) {
      const output = {
        success: false,
        stop_reason: "missing_required_information",
        lifecycle,
      };
      fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
      console.log(JSON.stringify(output, null, 2));
      process.exit(2);
    }
  }

  const up = await runNodeScript("up.mjs");
  record("up", { exit_code: up.code, stdout: up.stdout.trim(), stderr: up.stderr.trim() });
  if (up.code !== 0) {
    const output = { success: false, stop_reason: "up_failed", lifecycle };
    fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }
  startedByScript.value = true;

  record("fixtures_scenarios_check", { requestPath, qaScenario, sreScenario });

  let qaResult = null;
  if (decision.qa_required) {
    const qa = await runNodeScript("qa-loop.mjs");
    qaResult = { exit_code: qa.code, stdout: qa.stdout.trim(), stderr: qa.stderr.trim() };
    record("qa_loop", qaResult);
    if (qa.code !== 0) {
      if (startedByScript.value && !keepUp) {
        await runNodeScript("down.mjs");
      }
      const output = { success: false, stop_reason: "qa_failed", lifecycle };
      fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
      console.log(JSON.stringify(output, null, 2));
      process.exit(1);
    }
  }

  let sreResult = null;
  if (decision.sre_required && !skipSre) {
    const sre = await runNodeScript("sre-loop.mjs");
    sreResult = { exit_code: sre.code, stdout: sre.stdout.trim(), stderr: sre.stderr.trim() };
    record("sre_loop", sreResult);
    if (sre.code !== 0) {
      if (startedByScript.value && !keepUp) {
        await runNodeScript("down.mjs");
      }
      const output = { success: false, stop_reason: "sre_failed", lifecycle };
      fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
      console.log(JSON.stringify(output, null, 2));
      process.exit(1);
    }
  }

  if (startedByScript.value && !keepUp) {
    const down = await runNodeScript("down.mjs");
    record("down", { exit_code: down.code, stdout: down.stdout.trim(), stderr: down.stderr.trim() });
  }

  const output = {
    success: true,
    task,
    qa_required: decision.qa_required,
    sre_required: decision.sre_required && !skipSre,
    lifecycle,
  };
  fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output, null, 2));
}

await main();
