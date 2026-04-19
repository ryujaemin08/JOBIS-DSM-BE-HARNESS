import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnLogged, nowIso } from "./_common.mjs";
import {
  resolveTargetRequestPaths,
  loadRequestSpec,
  requestNeedsSre,
} from "./_contract.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const reportDir = path.join(repoRoot, "harness", "reports", "generated");

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

const task = argValue("--task") ?? "";
const requestPath = argValue("--request");
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
  const runtimeSensitive = /performance|latency|timeout|health|metric|sre|startup|slow|response time|응답속도|응답값|응답시간|성능|지연|안정성|메트릭|\d+ms|\d+초\s*이하|ms\s*이하/.test(lower);

  return {
    harness_required: apiTask || runtimeSensitive,
    qa_required: apiTask,
    sre_required: runtimeSensitive,
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

function readLatestJson(filename) {
  const filePath = path.join(reportDir, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function classifyUpFailure(outputText) {
  const text = (outputText || "").toLowerCase();
  if (
    text.includes("docker compose failed") ||
    text.includes("docker") && text.includes("not recognized") ||
    text.includes("cannot connect to the docker daemon") ||
    text.includes("is the docker daemon running") ||
    text.includes("dependency [") ||
    text.includes("port 18080 is already in use by non-jobis process")
  ) {
    return {
      recoverable: false,
      failure_class: "environment_blocker",
      next_action: "Fix the local environment issue, then rerun harness from the same step.",
    };
  }

  return {
    recoverable: true,
    failure_class: "up_failed",
    next_action: "Fix the startup/build/configuration problem, then rerun up and continue the same harness flow.",
  };
}

async function main() {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), JSON.stringify({ status: "in_progress", started_at: nowIso() }, null, 2) + "\n");
  record("analyze_request", { task });
  const decision = classifyTask(task);
  const targetRequestPaths = requestPath
    ? await resolveTargetRequestPaths({ explicitPaths: [requestPath] })
    : decision.qa_required || decision.sre_required
      ? await resolveTargetRequestPaths()
      : [];
  if (targetRequestPaths.length > 0) {
    decision.harness_required = true;
  }
  const targetRequestSpecs = targetRequestPaths.map((targetPath) => loadRequestSpec(targetPath));
  if (targetRequestSpecs.length > 0) {
    decision.qa_required = targetRequestSpecs.some((spec) => spec.harness?.qa_required !== false);
  }
  record("harness_decision", decision);
  const shouldRunSre = (decision.sre_required || targetRequestSpecs.some((spec) => requestNeedsSre(spec))) && !skipSre;

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

  for (const targetRequestPath of targetRequestPaths) {
    const intake = await runNodeScript("01-intake/intake-api-request.mjs", "--request", targetRequestPath);
    record("intake_request", {
      request: targetRequestPath,
      exit_code: intake.code,
      stdout: intake.stdout.trim(),
      stderr: intake.stderr.trim(),
    });
    if (intake.code !== 0) {
      const output = {
        success: false,
        recoverable: true,
        continue_without_user: true,
        stop_reason: "missing_required_information",
        recovery: {
          failed_stage: "intake",
          next_action: "Add missing required fields to the request contract, then re-run autopilot-harness.mjs from the beginning. Do NOT call intake-api-request.mjs directly.",
          rerun_command: `node harness/scripts/autopilot-harness.mjs --task "${task}"${requestPath ? ` --request "${requestPath}"` : ""}`,
        },
        lifecycle,
      };
      fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
      console.log(JSON.stringify(output, null, 2));
      process.exit(2);
    }

    const fixturePlan = await runNodeScript("02-fixture/build-fixture-plan.mjs", "--request", targetRequestPath);
    record("build_fixture_plan", {
      request: targetRequestPath,
      exit_code: fixturePlan.code,
      stdout: fixturePlan.stdout.trim(),
      stderr: fixturePlan.stderr.trim(),
    });
    if (fixturePlan.code !== 0) {
      const output = {
        success: false,
        recoverable: true,
        continue_without_user: true,
        stop_reason: "fixture_plan_failed",
        recovery: {
          failed_stage: "build_fixture_plan",
          next_action: "Fix the fixture plan error shown in stderr above, then re-run autopilot-harness.mjs from the beginning. Do NOT call build-fixture-plan.mjs directly.",
          rerun_command: `node harness/scripts/autopilot-harness.mjs --task "${task}"${requestPath ? ` --request "${requestPath}"` : ""}`,
        },
        lifecycle,
      };
      fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
      console.log(JSON.stringify(output, null, 2));
      process.exit(2);
    }

    const qaPreflight = await runNodeScript("04-qa/build-qa-scenario.mjs", "--request", targetRequestPath);
    record("build_qa_scenario", {
      request: targetRequestPath,
      exit_code: qaPreflight.code,
      stdout: qaPreflight.stdout.trim(),
      stderr: qaPreflight.stderr.trim(),
    });
    if (qaPreflight.code !== 0) {
      const output = {
        success: false,
        recoverable: true,
        continue_without_user: true,
        stop_reason: "qa_generation_failed",
        recovery: {
          failed_stage: "build_qa_scenario",
          next_action: "Fix the QA generation error shown in stderr above, then re-run autopilot-harness.mjs from the beginning. Do NOT call build-qa-scenario.mjs or qa-loop.mjs directly.",
          rerun_command: `node harness/scripts/autopilot-harness.mjs --task "${task}"${requestPath ? ` --request "${requestPath}"` : ""}`,
        },
        lifecycle,
      };
      fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
      console.log(JSON.stringify(output, null, 2));
      process.exit(2);
    }

    if (requestNeedsSre(loadRequestSpec(targetRequestPath))) {
      const srePreflight = await runNodeScript("05-sre/build-sre-scenario.mjs", "--request", targetRequestPath);
      record("build_sre_scenario", {
        request: targetRequestPath,
        exit_code: srePreflight.code,
        stdout: srePreflight.stdout.trim(),
        stderr: srePreflight.stderr.trim(),
      });
      if (srePreflight.code !== 0) {
        const output = {
          success: false,
          recoverable: true,
          continue_without_user: true,
          stop_reason: "sre_generation_failed",
          recovery: {
            failed_stage: "build_sre_scenario",
            next_action: "Fix the SRE generation error shown in stderr above, then re-run autopilot-harness.mjs from the beginning. Do NOT call build-sre-scenario.mjs or sre-loop.mjs directly.",
            rerun_command: `node harness/scripts/autopilot-harness.mjs --task "${task}"${requestPath ? ` --request "${requestPath}"` : ""}`,
          },
          lifecycle,
        };
        fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
        console.log(JSON.stringify(output, null, 2));
        process.exit(2);
      }
    }
  }

  const up = await runNodeScript("03-env/up.mjs");
  record("up", { exit_code: up.code, stdout: up.stdout.trim(), stderr: up.stderr.trim() });
  if (up.code !== 0) {
    await runNodeScript("03-env/down.mjs");
    const failureText = up.stderr || up.stdout || "";
    const classification = classifyUpFailure(failureText);
    const output = classification.recoverable
      ? {
          success: false,
          recoverable: true,
          continue_without_user: true,
          stop_reason: `recovery_required:${classification.failure_class}`,
          recovery: {
            failed_stage: "up",
            failure_class: classification.failure_class,
            message: failureText.trim(),
            next_action: `${classification.next_action} Then re-run autopilot-harness.mjs from the beginning. Do NOT call up.mjs directly.`,
            rerun_command: `node harness/scripts/autopilot-harness.mjs --task "${task}"${requestPath ? ` --request "${requestPath}"` : ""}`,
          },
          lifecycle,
        }
      : {
          success: false,
          stop_reason: classification.failure_class,
          blocker: failureText.trim(),
          lifecycle,
        };
    fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
    console.log(JSON.stringify(output, null, 2));
    process.exit(1);
  }
  startedByScript.value = true;

  record("fixtures_scenarios_check", { requests: targetRequestPaths });

  let qaResult = null;
  if (decision.qa_required) {
    const qaArgs = targetRequestPaths.flatMap((targetPath) => ["--request", targetPath]);
    const qa = await runNodeScript("04-qa/qa-loop.mjs", ...qaArgs);
    qaResult = { exit_code: qa.code, stdout: qa.stdout.trim(), stderr: qa.stderr.trim() };
    record("qa_loop", qaResult);
    if (qa.code !== 0) {
      const qaSummary = readLatestJson("qa-loop-summary.json");
      if (qaSummary?.recoverable) {
        const output = {
          success: false,
          recoverable: true,
          continue_without_user: true,
          stop_reason: qaSummary.stop_reason,
          recovery: qaSummary.recovery,
          lifecycle,
        };
        fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
        console.log(JSON.stringify(output, null, 2));
        process.exit(1);
      }
      if (startedByScript.value && !keepUp) {
        await runNodeScript("03-env/down.mjs");
      }
      const output = {
        success: false,
        recoverable: true,
        continue_without_user: true,
        stop_reason: "qa_failed",
        recovery: {
          failed_stage: "qa_loop",
          next_action: "Fix the QA assertion failure shown in stderr/qa-loop-summary.json above, then re-run autopilot-harness.mjs from the beginning. Do NOT call qa-loop.mjs directly.",
          rerun_command: `node harness/scripts/autopilot-harness.mjs --task "${task}"${requestPath ? ` --request "${requestPath}"` : ""}`,
        },
        lifecycle,
      };
      fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
      console.log(JSON.stringify(output, null, 2));
      process.exit(1);
    }
  }

  let sreResult = null;
  if (shouldRunSre) {
    const sreArgs = targetRequestPaths.flatMap((targetPath) => ["--request", targetPath]);
    const sre = await runNodeScript("05-sre/sre-loop.mjs", ...sreArgs);
    sreResult = { exit_code: sre.code, stdout: sre.stdout.trim(), stderr: sre.stderr.trim() };
    record("sre_loop", sreResult);
    if (sre.code !== 0) {
      const sreSummary = readLatestJson("sre-loop-summary.json");
      if (sreSummary?.recoverable) {
        const output = {
          success: false,
          recoverable: true,
          continue_without_user: true,
          stop_reason: sreSummary.stop_reason,
          recovery: sreSummary.recovery,
          lifecycle,
        };
        fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
        console.log(JSON.stringify(output, null, 2));
        process.exit(1);
      }
      if (startedByScript.value && !keepUp) {
        await runNodeScript("03-env/down.mjs");
      }
      const output = {
        success: false,
        recoverable: true,
        continue_without_user: true,
        stop_reason: "sre_failed",
        recovery: {
          failed_stage: "sre_loop",
          next_action: "Fix the SRE failure (e.g. p95 exceeded, health check failed) shown in sre-loop-summary.json above, then re-run autopilot-harness.mjs from the beginning. Do NOT call sre-loop.mjs directly.",
          rerun_command: `node harness/scripts/autopilot-harness.mjs --task "${task}"${requestPath ? ` --request "${requestPath}"` : ""}`,
        },
        lifecycle,
      };
      fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
      console.log(JSON.stringify(output, null, 2));
      process.exit(1);
    }
  }

  if (startedByScript.value && !keepUp) {
    const down = await runNodeScript("03-env/down.mjs");
    record("down", { exit_code: down.code, stdout: down.stdout.trim(), stderr: down.stderr.trim() });
  }

  const output = {
    success: true,
    task,
    qa_required: decision.qa_required,
    sre_required: shouldRunSre,
    lifecycle,
  };
  fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output, null, 2));
}

await main();
