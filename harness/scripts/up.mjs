import fs from "node:fs";
import path from "node:path";
import {
  ensureReportDir,
  dockerCompose,
  waitForDependencies,
  stopExistingHarnessResources,
  startBootRunProcess,
  waitForHealth,
  waitForTables,
  findFreePort,
  writeRuntimeEnv,
  harnessEnv,
  docker,
  containerNames,
  fixturePlanFile,
  readFixturePlan,
  getBaseUrl,
  httpRequest,
  assertResponse,
  repoRoot,
} from "../_common.mjs";

ensureReportDir();
await stopExistingHarnessResources();

const runtimeEnv = {
  ...harnessEnv,
  HARNESS_APP_PORT: await findFreePort(18080, 18180),
  HARNESS_MYSQL_PORT: await findFreePort(33306, 33450),
  HARNESS_REDIS_PORT: await findFreePort(36379, 36500),
  HARNESS_RABBITMQ_PORT: await findFreePort(35672, 35800),
  HARNESS_RABBITMQ_MANAGEMENT_PORT: await findFreePort(35673, 35850),
  HARNESS_MOCK_HTTP_PORT: await findFreePort(38080, 38200),
};
runtimeEnv.HARNESS_SLACK_URL = `http://localhost:${runtimeEnv.HARNESS_MOCK_HTTP_PORT}/slack/`;

writeRuntimeEnv(runtimeEnv);

await dockerCompose(["up", "-d", "mysql", "redis", "rabbitmq", "mock-http"]);
await waitForDependencies();
startBootRunProcess();
await waitForHealth();

const fixturePlanArgIndex = process.argv.indexOf("--fixture-plan");
const fixturePlanPath = fixturePlanArgIndex >= 0
  ? process.argv[fixturePlanArgIndex + 1]
  : fixturePlanFile;
const fixturePlan = readFixturePlan(fixturePlanPath);
const requiredTables = fixturePlan?.required_tables ?? ["tbl_user", "tbl_student", "tbl_teacher", "tbl_company", "tbl_document_number", "tbl_interview"];
await waitForTables(requiredTables);

async function applySeedSql(seedPath) {
  if (!seedPath) return;
  const sqlPath = path.resolve(repoRoot, seedPath);
  const sql = fs.readFileSync(sqlPath, "utf8");
  const result = await docker(
    ["exec", "-i", containerNames.mysql, "mysql", "-uroot", "-p1234", "-D", "jobis_harness"],
    sql,
  );
  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to apply harness seed: ${seedPath}`);
  }
}

await applySeedSql(fixturePlan?.base_sql_path);

let bootstrapResult = { attempted: false, used_fallback: false, succeeded: false };
if (fixturePlan?.bootstrap?.steps?.length) {
  bootstrapResult.attempted = true;
  const baseUrl = getBaseUrl();
  const context = { steps: {} };
  try {
    for (const step of fixturePlan.bootstrap.steps) {
      const result = await httpRequest(baseUrl, step.request, context);
      assertResponse(step.id ?? "bootstrap_step", result, step.expect ?? {});
      if (step.id) {
        context.steps[step.id] = result;
      }
    }
    bootstrapResult.succeeded = true;
  } catch (error) {
    if (!fixturePlan.bootstrap.fallback_allowed) {
      throw error;
    }
    bootstrapResult.used_fallback = true;
  }
}

const shouldApplyFallbackSeed =
  !fixturePlan?.bootstrap?.steps?.length ||
  fixturePlan.bootstrap.mode === "augment_api" ||
  bootstrapResult.used_fallback;

if (shouldApplyFallbackSeed) {
  await applySeedSql(fixturePlan?.generated_sql_path);
}

console.log(JSON.stringify({
  success: true,
  fixture_key: fixturePlan?.fixture_key ?? "no-plan",
  bootstrap: bootstrapResult,
  app_port: runtimeEnv.HARNESS_APP_PORT,
  mysql_port: runtimeEnv.HARNESS_MYSQL_PORT,
  redis_port: runtimeEnv.HARNESS_REDIS_PORT,
  rabbitmq_port: runtimeEnv.HARNESS_RABBITMQ_PORT,
  rabbitmq_management_port: runtimeEnv.HARNESS_RABBITMQ_MANAGEMENT_PORT,
  mock_http_port: runtimeEnv.HARNESS_MOCK_HTTP_PORT,
}, null, 2));
