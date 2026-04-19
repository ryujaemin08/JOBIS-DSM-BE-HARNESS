import fs from "node:fs";
import path from "node:path";
import { dockerCompose, stopExistingHarnessProcess, runtimeFile, fixturePlanFile, reportDir } from "./_common.mjs";

await stopExistingHarnessProcess();
await dockerCompose(["down", "-v"]);
fs.rmSync(runtimeFile, { force: true });
fs.rmSync(fixturePlanFile, { force: true });
fs.rmSync(path.join(reportDir, "base-fixture.sql"), { force: true });
fs.rmSync(path.join(reportDir, "generated-fixture.sql"), { force: true });
console.log("Harness app and dependencies stopped.");
