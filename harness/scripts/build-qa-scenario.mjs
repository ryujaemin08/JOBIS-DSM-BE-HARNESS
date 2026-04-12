import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const argIndex = process.argv.indexOf("--request");
if (argIndex < 0 || !process.argv[argIndex + 1]) {
  console.error("Usage: node harness/scripts/build-qa-scenario.mjs --request <request.json>");
  process.exit(1);
}

const requestPath = path.resolve(repoRoot, process.argv[argIndex + 1]);
const requestSpec = JSON.parse(fs.readFileSync(requestPath, "utf8"));

const scenario = {
  name: requestSpec.name,
  kind: "qa",
  base_url: "http://localhost:18080",
  source_request: path.relative(repoRoot, requestPath),
  steps: [
    {
      id: "target_request",
      request: {
        method: requestSpec.method,
        path: requestSpec.path,
        body: Object.fromEntries((requestSpec.request?.body?.fields ?? []).map((field) => [field.name, field.example ?? null]))
      },
      expect: {
        status: requestSpec.responses?.success?.status,
        required_paths: []
      }
    }
  ]
};

const outputDir = path.join(repoRoot, "harness", "scenarios", "api", "generated");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `${requestSpec.name}.json`);
fs.writeFileSync(outputPath, `${JSON.stringify(scenario, null, 2)}\n`);

console.log(JSON.stringify({
  source_request: path.relative(repoRoot, requestPath),
  generated_scenario: path.relative(repoRoot, outputPath)
}, null, 2));
