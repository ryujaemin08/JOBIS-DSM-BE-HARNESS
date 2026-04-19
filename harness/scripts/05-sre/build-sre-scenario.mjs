import {
  loadRequestSpec,
  buildSreScenarioForRequest,
  writeScenario,
  resolveExplicitRequestArgs,
} from "../_contract.mjs";
import { repoRelative } from "../_common.mjs";

const explicitRequests = resolveExplicitRequestArgs();
if (explicitRequests.length !== 1) {
  console.error("Usage: node harness/scripts/build-sre-scenario.mjs --request <request.json>");
  process.exit(1);
}

const requestSpec = loadRequestSpec(explicitRequests[0]);
const scenario = buildSreScenarioForRequest(requestSpec);
const outputPath = writeScenario("sre", requestSpec, scenario);

console.log(JSON.stringify({
  source_request: requestSpec.__relative_path,
  generated_scenario: repoRelative(outputPath),
  preflight: {
    fixture_ready: true,
    auth_bootstrap_ready: true,
  },
}, null, 2));
