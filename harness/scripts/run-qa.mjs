import fs from "node:fs";
import path from "node:path";
import {
  ensureReportDir,
  getGitSha,
  nowIso,
  qaScenarioPath,
  reportDir,
  httpRequest,
  assertResponse,
  getBaseUrl,
} from "./_common.mjs";

ensureReportDir();

const scenarioArgIndex = process.argv.indexOf("--scenario");
const scenarioPath = scenarioArgIndex >= 0 ? process.argv[scenarioArgIndex + 1] : qaScenarioPath;
const scenario = JSON.parse(fs.readFileSync(path.resolve(scenarioPath), "utf8"));
const baseUrl = getBaseUrl(scenario.base_url);

const context = { steps: {} };
const stepResults = [];

for (const step of scenario.steps ?? []) {
  const result = await httpRequest(baseUrl, step.request, context);
  assertResponse(step.id, result, step.expect);
  context.steps[step.id] = result;
  stepResults.push({
    id: step.id,
    status: result.status,
    duration_ms: result.duration_ms,
  });
}

const summary = {
  scenario: {
    name: scenario.name,
    path: scenarioPath,
    base_url: baseUrl,
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
