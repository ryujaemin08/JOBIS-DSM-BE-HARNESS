import fs from "node:fs";
import {
  ensureReportDir,
  dockerCompose,
  waitForDependencies,
  stopExistingHarnessProcess,
  startBootRunProcess,
  waitForHealth,
  waitForTables,
} from "./_common.mjs";

ensureReportDir();
await stopExistingHarnessProcess();
await dockerCompose(["up", "-d", "mysql", "redis", "rabbitmq", "mock-http"]);
await waitForDependencies();
startBootRunProcess();
await waitForHealth();
await waitForTables([
  "tbl_user",
  "tbl_student",
  "tbl_company",
  "tbl_recruitment",
  "tbl_recruit_area",
  "tbl_code",
  "tbl_recruit_area_code",
]);

const seedSql = fs.readFileSync(new URL("../fixtures/mysql/001-login-recruitments-seed.sql", import.meta.url), "utf8");
const { docker } = await import("./_common.mjs");
const result = await docker(["exec", "-i", "jobis-harness-mysql", "mysql", "-uroot", "-p1234", "-D", "jobis_harness"], seedSql);
if (result.code !== 0) {
  throw new Error(result.stderr || result.stdout || "Failed to seed harness database.");
}

console.log("Harness app is healthy and seeded on http://localhost:18080");
