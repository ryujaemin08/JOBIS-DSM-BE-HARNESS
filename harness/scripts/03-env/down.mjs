import { dockerCompose, stopExistingHarnessProcess } from "../_common.mjs";

await stopExistingHarnessProcess();
await dockerCompose(["down", "-v"]);
console.log("Harness app and dependencies stopped.");
