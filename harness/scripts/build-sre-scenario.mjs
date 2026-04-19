import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const argIndex = process.argv.indexOf("--request");
if (argIndex < 0 || !process.argv[argIndex + 1]) {
  console.error("Usage: node harness/scripts/build-sre-scenario.mjs --request <request.json>");
  process.exit(1);
}

const requestPath = path.resolve(repoRoot, process.argv[argIndex + 1]);
const requestSpec = JSON.parse(fs.readFileSync(requestPath, "utf8").replace(/^\uFEFF/, ""));

const useTeacherLogin = (requestSpec.authority ?? []).includes("TEACHER");
const loginStepId = useTeacherLogin ? "login_teacher" : "login_student";
const loginAccountId = useTeacherLogin ? "harness.teacher.01" : "harness.student.01";
const requiresAuthorization = (requestSpec.request?.headers ?? []).some((field) => field.name.toLowerCase() === "authorization");

const targetHeaders = Object.fromEntries((requestSpec.request?.headers ?? []).map((field) => {
  if (field.name.toLowerCase() === "authorization" && requiresAuthorization) {
    return [field.name, `Bearer {{steps.${loginStepId}.body.access_token}}`];
  }
  return [field.name, field.example ?? null];
}));

const setupSteps = requiresAuthorization
  ? [
      {
        id: loginStepId,
        request: {
          method: "POST",
          path: "/users/login",
          headers: {
            "content-type": "application/json"
          },
          body: {
            account_id: loginAccountId,
            password: "HarnessPass123!",
            platform_type: "WEB",
            device_token: "harness-device-token"
          }
        },
        expect: {
          status: 200,
          required_paths: ["access_token"]
        }
      }
    ]
  : [];

const scenario = {
  name: `${requestSpec.name}-sre`,
  kind: "sre",
  base_url: "http://localhost:18080",
  source_request: path.relative(repoRoot, requestPath),
  probes: [
    {
      id: "health",
      type: "http_json",
      request: {
        method: "GET",
        path: "/actuator/health"
      },
      expect: {
        status: 200,
        equals: {
          status: "UP"
        }
      }
    },
    {
      id: "metrics-index",
      type: "http_json",
      request: {
        method: "GET",
        path: "/actuator/metrics"
      },
      expect: {
        status: 200
      }
    },
    {
      id: "prometheus-scrape",
      type: "http_text",
      request: {
        method: "GET",
        path: "/actuator/prometheus"
      },
      expect: {
        status: 200,
        contains: ["jvm_"]
      }
    },
    {
      id: `${requestSpec.name}-latency`,
      type: "http_latency",
      setup_steps: setupSteps,
      request: {
        method: requestSpec.method,
        path: requestSpec.path,
        headers: targetHeaders,
        query: Object.fromEntries((requestSpec.request?.query_params ?? []).map((field) => [field.name, field.example ?? null])),
        body: (requestSpec.request?.body?.fields ?? []).length > 0
          ? Object.fromEntries((requestSpec.request?.body?.fields ?? []).map((field) => [field.name, field.example ?? null]))
          : undefined
      },
      samples: 5,
      expect: {
        status: requestSpec.responses?.success?.status ?? 200,
        p95_ms_lte: 400
      }
    },
    {
      id: "logs",
      type: "logs_post_startup",
      expect: {
        "max_matches": 0
      }
    }
  ]
};

const outputDir = path.join(repoRoot, "harness", "scenarios", "reliability", "generated");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `${requestSpec.name}.json`);
fs.writeFileSync(outputPath, `${JSON.stringify(scenario, null, 2)}\n`);

console.log(JSON.stringify({
  source_request: path.relative(repoRoot, requestPath),
  generated_sre_scenario: path.relative(repoRoot, outputPath)
}, null, 2));
