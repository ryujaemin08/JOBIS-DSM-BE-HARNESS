import fs from "node:fs";
import path from "node:path";
import {
  ensureReportDir,
  getGitSha,
  nowIso,
  reportDir,
  httpRequest,
  assertResponse,
} from "../_common.mjs";
import { loadRequestSpec, verifyRuntimeContractConsistency } from "../_contract.mjs";

ensureReportDir();

const scenarioArgIndex = process.argv.indexOf("--scenario");
if (scenarioArgIndex < 0 || !process.argv[scenarioArgIndex + 1]) {
  console.error("Usage: node harness/scripts/run-qa.mjs --scenario <scenario.json>");
  process.exit(1);
}

const scenarioPath = path.resolve(process.argv[scenarioArgIndex + 1]);
try {
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));
  const requestSpec = scenario.source_request ? loadRequestSpec(scenario.source_request) : null;
  const contractConsistency = requestSpec ? verifyRuntimeContractConsistency(requestSpec) : null;

  const context = { steps: {} };
  const stepResults = [];

  for (const step of scenario.steps ?? []) {
    const result = await httpRequest(scenario.base_url, step.request, context);
    assertResponse(step.id, result, step.expect);
    context.steps[step.id] = result;
    stepResults.push({
      id: step.id,
      status: result.status,
      duration_ms: result.duration_ms,
      meta: step.meta ?? null,
      request: {
        method: step.request.method,
        path: step.request.path,
      },
    });
  }

  const summary = {
    scenario: {
      name: scenario.name,
      path: scenarioPath,
      source_request: scenario.source_request ?? null,
      contract_consistency: contractConsistency,
      git_sha: await getGitSha(),
      generated_at: nowIso(),
    },
    success: true,
    steps: stepResults,
    outputs: context.steps,
  };

  const outputPath = path.join(reportDir, "qa-summary.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(String(error?.message ?? error));
  process.exit(1);
}
