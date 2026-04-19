import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureReportDir, ensureFixtureGeneratedDir, fixtureGeneratedDir, nowIso, reportDir, repoRelative } from "../_common.mjs";
import { buildContextSeed, buildDynamicScenarioFixture, renderBaseIdentitySql } from "../_fixture-generator.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

ensureReportDir();
ensureFixtureGeneratedDir();

const requestPath = argValue("--request");
const task = argValue("--task") ?? "";

if (!requestPath) {
  throw new Error("--request <path> is required");
}

const absoluteRequestPath = path.resolve(repoRoot, requestPath);
if (!fs.existsSync(absoluteRequestPath)) {
  throw new Error(`Request contract not found: ${requestPath}`);
}

const requestSpec = JSON.parse(fs.readFileSync(absoluteRequestPath, "utf8").replace(/^\uFEFF/, ""));
const context = buildContextSeed({ fixtureKey: requestSpec.name, requestSpec });

const baseSql = `${renderBaseIdentitySql(context)}\n`;
const dynamicFixture = buildDynamicScenarioFixture({ requestSpec, context, task });
const scenarioSql = dynamicFixture.sql.trim() ? `${dynamicFixture.sql}\n` : "";

const baseSqlPath = path.join(fixtureGeneratedDir, "base-fixture.sql");
const generatedSqlPath = path.join(fixtureGeneratedDir, "generated-fixture.sql");
const planPath = path.join(fixtureGeneratedDir, "fixture-plan.json");

fs.writeFileSync(baseSqlPath, baseSql);
if (scenarioSql) {
  fs.writeFileSync(generatedSqlPath, scenarioSql);
}

let bootstrap = null;
if (requestSpec.harness?.bootstrap?.steps?.length) {
  bootstrap = {
    mode: requestSpec.harness.bootstrap.mode ?? "prefer_api",
    fallback_allowed: requestSpec.harness.bootstrap.fallback_allowed ?? true,
    steps: requestSpec.harness.bootstrap.steps,
  };
}

const plan = {
  generated_at: nowIso(),
  fixture_key: requestSpec.name,
  request_path: requestPath,
  required_tables: dynamicFixture.required_tables,
  base_sql_path: repoRelative(baseSqlPath),
  generated_sql_path: scenarioSql ? repoRelative(generatedSqlPath) : null,
  bootstrap,
  context,
};

fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
console.log(JSON.stringify(plan, null, 2));
