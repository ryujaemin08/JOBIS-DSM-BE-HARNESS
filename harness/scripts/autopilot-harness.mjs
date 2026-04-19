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
let requestPath = argValue("--request");
const qaScenario = argValue("--qa-scenario") ?? qaScenarioPath;
const sreScenario = argValue("--sre-scenario") ?? sreScenarioPath;
const skipSre = process.argv.includes("--skip-sre");
const keepUp = process.argv.includes("--keep-up");

const lifecycle = [];
const startedByScript = { value: false };
const attemptedUp = { value: false };

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

function missingFieldsForApiTask() {
  return [
    { field: "name", question: "API slug/name 이 필요합니다." },
    { field: "summary", question: "API 한 줄 요약이 필요합니다." },
    { field: "method", question: "HTTP method 가 필요합니다." },
    { field: "path", question: "endpoint path 가 필요합니다." },
    { field: "purpose", question: "비즈니스 목적이 필요합니다." },
    { field: "authority", question: "누가 호출 가능한지 authority 정의가 필요합니다." },
    { field: "request.body.fields", question: "request body 또는 입력 필드 정의가 필요합니다." },
    { field: "responses.success.status", question: "성공 status code 가 필요합니다." },
    { field: "responses.failures", question: "대표 failure case 가 필요합니다." },
    { field: "qa_expectations.success_assertions", question: "성공 시 무엇을 검증해야 하는지 필요합니다." },
    { field: "side_effects", question: "검증해야 할 side effect 가 필요합니다." }
  ];
}

async function runNodeScript(scriptName, ...args) {
  const result = await spawnLogged("node", [path.join(__dirname, scriptName), ...args], { stdio: "pipe" });
  return result;
}

async function main() {
  let selectedQaScenario = qaScenario;
  let selectedSreScenario = sreScenario;
  let stopReason = null;

  try {
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

    if (decision.qa_required && !requestPath) {
      const discovered = await runNodeScript("find-request-contract.mjs", "--task", task);
      record("discover_request_contract", {
        exit_code: discovered.code,
        stdout: discovered.stdout.trim(),
        stderr: discovered.stderr.trim(),
      });
      if (discovered.code === 0) {
        const discoveredOutput = JSON.parse(discovered.stdout.trim());
        requestPath = discoveredOutput.request_path;
      }
    }

    if (decision.qa_required && !requestPath) {
      const output = {
        success: false,
        stop_reason: "missing_required_information",
        lifecycle,
        missing_required_information: missingFieldsForApiTask()
      };
      fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
      console.log(JSON.stringify(output, null, 2));
      process.exit(2);
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

      const generatedScenario = await runNodeScript("build-qa-scenario.mjs", "--request", requestPath);
      record("build_qa_scenario", {
        exit_code: generatedScenario.code,
        stdout: generatedScenario.stdout.trim(),
        stderr: generatedScenario.stderr.trim(),
      });
      if (generatedScenario.code !== 0) {
        stopReason = "build_qa_scenario_failed";
        throw new Error(generatedScenario.stderr || generatedScenario.stdout || stopReason);
      }
      const scenarioOutput = JSON.parse(generatedScenario.stdout.trim());
      selectedQaScenario = scenarioOutput.generated_scenario;

      const generatedSreScenario = await runNodeScript("build-sre-scenario.mjs", "--request", requestPath);
      record("build_sre_scenario", {
        exit_code: generatedSreScenario.code,
        stdout: generatedSreScenario.stdout.trim(),
        stderr: generatedSreScenario.stderr.trim(),
      });
      if (generatedSreScenario.code !== 0) {
        stopReason = "build_sre_scenario_failed";
        throw new Error(generatedSreScenario.stderr || generatedSreScenario.stdout || stopReason);
      }
      const sreScenarioOutput = JSON.parse(generatedSreScenario.stdout.trim());
      selectedSreScenario = sreScenarioOutput.generated_sre_scenario;

      const fixturePlan = await runNodeScript("build-fixture-plan.mjs", "--request", requestPath, "--qa-scenario", selectedQaScenario, "--sre-scenario", selectedSreScenario, "--task", task);
      record("build_fixture_plan", {
        exit_code: fixturePlan.code,
        stdout: fixturePlan.stdout.trim(),
        stderr: fixturePlan.stderr.trim(),
      });
      if (fixturePlan.code !== 0) {
        stopReason = "build_fixture_plan_failed";
        throw new Error(fixturePlan.stderr || fixturePlan.stdout || stopReason);
      }
    }

    record("fixtures_scenarios_check", { requestPath, qaScenario: selectedQaScenario, sreScenario: selectedSreScenario });

    attemptedUp.value = true;
    const up = await runNodeScript("up.mjs", "--fixture-plan", path.join(reportDir, "fixture-plan.json"));
    record("up", { exit_code: up.code, stdout: up.stdout.trim(), stderr: up.stderr.trim() });
    if (up.code !== 0) {
      stopReason = "up_failed";
      throw new Error(up.stderr || up.stdout || stopReason);
    }
    startedByScript.value = true;

    if (decision.qa_required) {
      const qa = await runNodeScript("qa-loop.mjs", "--scenario", selectedQaScenario);
      const qaResult = { exit_code: qa.code, stdout: qa.stdout.trim(), stderr: qa.stderr.trim() };
      record("qa_loop", qaResult);
      if (qa.code !== 0) {
        stopReason = "qa_failed";
        throw new Error(qa.stderr || qa.stdout || stopReason);
      }
    }

    if (decision.sre_required && !skipSre) {
      const sre = await runNodeScript("sre-loop.mjs", "--scenario", selectedSreScenario);
      const sreResult = { exit_code: sre.code, stdout: sre.stdout.trim(), stderr: sre.stderr.trim() };
      record("sre_loop", sreResult);
      if (sre.code !== 0) {
        stopReason = "sre_failed";
        throw new Error(sre.stderr || sre.stdout || stopReason);
      }
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
  } catch (error) {
    const output = {
      success: false,
      stop_reason: stopReason ?? "autopilot_failed",
      lifecycle,
      error: error instanceof Error ? error.message : String(error),
    };
    fs.writeFileSync(path.join(reportDir, "autopilot-harness-summary.json"), `${JSON.stringify(output, null, 2)}\n`);
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = output.stop_reason === "missing_required_information" ? 2 : 1;
  } finally {
    if ((attemptedUp.value || startedByScript.value) && !keepUp) {
      const down = await runNodeScript("down.mjs");
      record("down", { exit_code: down.code, stdout: down.stdout.trim(), stderr: down.stderr.trim() });
      const outputPath = path.join(reportDir, "autopilot-harness-summary.json");
      if (fs.existsSync(outputPath)) {
        const summary = JSON.parse(fs.readFileSync(outputPath, "utf8"));
        summary.lifecycle = lifecycle;
        fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
      }
    }
  }
}

await main();
