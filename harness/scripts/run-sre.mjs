import fs from "node:fs";
import path from "node:path";
import {
  ensureReportDir,
  getGitSha,
  nowIso,
  sreScenarioPath,
  reportDir,
  appOutLog,
  appErrLog,
  httpRequest,
  assertResponse,
  percentile,
  getBaseUrl,
} from "./_common.mjs";

ensureReportDir();

const scenarioArgIndex = process.argv.indexOf("--scenario");
const scenarioPath = scenarioArgIndex >= 0 ? process.argv[scenarioArgIndex + 1] : sreScenarioPath;
const scenario = JSON.parse(fs.readFileSync(path.resolve(scenarioPath), "utf8"));
const baseUrl = getBaseUrl(scenario.base_url);

let logText = "";
if (fs.existsSync(appOutLog)) {
  logText += fs.readFileSync(appOutLog, "utf8");
}
if (fs.existsSync(appErrLog)) {
  logText += `\n${fs.readFileSync(appErrLog, "utf8")}`;
}

const startupMarker = "Started JobisApplication";
const markerIndex = logText.lastIndexOf(startupMarker);
if (markerIndex >= 0) {
  logText = logText.slice(markerIndex);
}

const noisePatterns = [
  /GenerationTarget encountered exception accepting command/gi,
  /CommandAcceptanceException/gi,
  /Table 'jobis_harness\.[^']+' doesn't exist/gi,
  /DefaultHandlerExceptionResolver[^\r\n]*/gi,
  /HttpMessageNotReadableException[^\r\n]*/gi,
];
for (const pattern of noisePatterns) {
  logText = logText.replace(pattern, "");
}

const probeResults = [];

for (const probe of scenario.probes ?? []) {
  if (probe.type === "http_json" || probe.type === "http_text") {
    const result = await httpRequest(baseUrl, probe.request, { steps: {} });
    assertResponse(probe.id, result, probe.expect);
    probeResults.push({
      id: probe.id,
      success: true,
      status: result.status,
      duration_ms: result.duration_ms,
    });
    continue;
  }

  if (probe.type === "http_latency") {
    const context = { steps: {} };
    for (const setupStep of probe.setup_steps ?? []) {
      const setupResult = await httpRequest(baseUrl, setupStep.request, context);
      assertResponse(setupStep.id, setupResult, setupStep.expect);
      context.steps[setupStep.id] = setupResult;
    }

    const samples = [];
    for (let i = 0; i < (probe.samples ?? 3); i += 1) {
      const result = await httpRequest(baseUrl, probe.request, context);
      assertResponse(probe.id, result, probe.expect);
      samples.push(result.duration_ms);
    }

    const p95 = percentile(samples, 95);
    if (probe.expect?.p95_ms_lte != null && p95 > probe.expect.p95_ms_lte) {
      throw new Error(`${probe.id} p95 ${p95} exceeded ${probe.expect.p95_ms_lte}ms`);
    }

    probeResults.push({
      id: probe.id,
      success: true,
      avg_ms: Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length),
      p95_ms: p95,
      samples_ms: samples,
    });
    continue;
  }

  if (probe.type === "logs_post_startup") {
    const exceptionMatches = logText.match(/exception|failed to start|application run failed/gi) ?? [];
    const maxMatches = probe.expect?.max_matches ?? 0;
    if (exceptionMatches.length > maxMatches) {
      throw new Error(`logs probe found ${exceptionMatches.length} exception-like matches`);
    }
    probeResults.push({
      id: probe.id,
      success: true,
      repeated_exception_patterns: exceptionMatches.length,
    });
  }
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
  probes: probeResults,
};

const outputPath = path.join(reportDir, "sre-summary.json");
fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
