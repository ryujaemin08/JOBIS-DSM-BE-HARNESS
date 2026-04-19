import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureReportDir, nowIso, qaScenarioPath, reportDir, sreScenarioPath } from "./_common.mjs";
import { buildContextSeed, buildDynamicScenarioFixture, renderBaseIdentitySql } from "./_fixture-generator.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const registryPath = path.join(repoRoot, "harness", "fixtures", "registry.json");

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function readJsonIfExists(targetPath) {
  if (!targetPath) return null;
  const absolutePath = path.resolve(repoRoot, targetPath);
  if (!fs.existsSync(absolutePath)) return null;
  return JSON.parse(fs.readFileSync(absolutePath, "utf8").replace(/^\uFEFF/, ""));
}

function template(text, context) {
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    const value = context[key];
    if (value == null) {
      throw new Error(`Missing fixture template value: ${key}`);
    }
    return String(value);
  });
}

function collectFixtureKey(requestSpec, scenarioSpec) {
  return requestSpec?.name ?? scenarioSpec?.name ?? "student-login-recruitments";
}

ensureReportDir();

const requestPath = argValue("--request");
const qaScenarioArg = argValue("--qa-scenario");
const sreScenarioArg = argValue("--sre-scenario");
const task = argValue("--task") ?? "";
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const requestSpec = readJsonIfExists(requestPath);
const scenarioSpec = readJsonIfExists(qaScenarioArg ?? qaScenarioPath);

const fixtureKey = collectFixtureKey(requestSpec, scenarioSpec);
const fixtureSpec = registry[fixtureKey] ?? registry.default;
const context = buildContextSeed({ fixtureKey, requestSpec });

const baseParts = [];
const scenarioParts = [];
let requiredTables = fixtureSpec.required_tables ?? registry.default.required_tables;
let bootstrap = null;

if (requestSpec) {
  baseParts.push(renderBaseIdentitySql(context));
  const dynamicFixture = buildDynamicScenarioFixture({ requestSpec, context, task });
  if (dynamicFixture.sql.trim()) {
    scenarioParts.push(dynamicFixture.sql);
  }
  requiredTables = dynamicFixture.required_tables;
  if (requestSpec.harness?.bootstrap?.steps?.length) {
    bootstrap = {
      mode: requestSpec.harness.bootstrap.mode ?? "prefer_api",
      fallback_allowed: requestSpec.harness.bootstrap.fallback_allowed ?? true,
      steps: requestSpec.harness.bootstrap.steps,
    };
  }
} else {
  for (const relativePath of fixtureSpec.base_fixtures ?? []) {
    const absolutePath = path.resolve(repoRoot, relativePath);
    baseParts.push(template(fs.readFileSync(absolutePath, "utf8"), context));
  }
  if (fixtureSpec.scenario_fixture) {
    const absolutePath = path.resolve(repoRoot, fixtureSpec.scenario_fixture);
    scenarioParts.push(template(fs.readFileSync(absolutePath, "utf8"), context));
  }
}

const baseSqlPath = path.join(reportDir, "base-fixture.sql");
const generatedSqlPath = path.join(reportDir, "generated-fixture.sql");
const planPath = path.join(reportDir, "fixture-plan.json");
const baseSql = baseParts.length > 0 ? `${baseParts.join("\n\n")}\n` : "";
const scenarioSql = scenarioParts.length > 0 ? `${scenarioParts.join("\n\n")}\n` : "";
if (baseSql) {
  fs.writeFileSync(baseSqlPath, baseSql);
}
if (scenarioSql) {
  fs.writeFileSync(generatedSqlPath, scenarioSql);
}

const plan = {
  generated_at: nowIso(),
  fixture_key: fixtureKey,
  request_path: requestPath ?? null,
  qa_scenario: qaScenarioArg ?? fixtureSpec.qa_scenario ?? qaScenarioPath,
  sre_scenario: sreScenarioArg ?? fixtureSpec.sre_scenario ?? sreScenarioPath,
  required_tables: requiredTables,
  base_sql_path: baseSql ? path.relative(repoRoot, baseSqlPath) : null,
  generated_sql_path: scenarioSql ? path.relative(repoRoot, generatedSqlPath) : null,
  bootstrap,
  context,
};

fs.writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
console.log(JSON.stringify(plan, null, 2));
