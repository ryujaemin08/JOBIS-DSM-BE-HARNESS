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
const requestSpec = JSON.parse(fs.readFileSync(requestPath, "utf8").replace(/^\uFEFF/, ""));

function collectRequiredPaths(body, prefix = "") {
  if (body == null) return [];
  if (Array.isArray(body)) {
    if (body.length === 0) return [];
    return collectRequiredPaths(body[0], prefix ? `${prefix}.0` : "0");
  }
  if (typeof body !== "object") {
    return prefix ? [prefix] : [];
  }
  return Object.entries(body).flatMap(([key, value]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value == null) return [next];
    if (Array.isArray(value)) {
      if (value.length === 0) return [next];
      return [next, ...collectRequiredPaths(value[0], `${next}.0`)];
    }
    if (typeof value === "object") {
      return [next, ...collectRequiredPaths(value, next)];
    }
    return [next];
  });
}

const useTeacherLogin = (requestSpec.authority ?? []).includes("TEACHER");
const loginStepId = useTeacherLogin ? "login_teacher" : "login_student";
const loginAccountId = useTeacherLogin ? "harness.teacher.01" : "harness.student.01";
const requiresAuthorization = (requestSpec.request?.headers ?? []).some((field) => field.name.toLowerCase() === "authorization");
const expectedBody = requestSpec.responses?.success?.body;
const interviewItem = Array.isArray(expectedBody?.interviews) ? expectedBody.interviews[0] : null;

const scenario = {
  name: requestSpec.name,
  kind: "qa",
  base_url: "http://localhost:18080",
  source_request: path.relative(repoRoot, requestPath),
  steps: []
};

if (requiresAuthorization) {
  scenario.steps.push({
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
  });
}

const headers = Object.fromEntries((requestSpec.request?.headers ?? []).map((field) => {
  if (field.name.toLowerCase() === "authorization" && requiresAuthorization) {
    return [field.name, `Bearer {{steps.${loginStepId}.body.access_token}}`];
  }
  return [field.name, field.example ?? null];
}));

scenario.steps.push({
  id: "target_request",
  request: {
    method: requestSpec.method,
    path: requestSpec.path,
    headers,
    query: Object.fromEntries((requestSpec.request?.query_params ?? []).map((field) => [field.name, field.example ?? null])),
    body: (requestSpec.request?.body?.fields ?? []).length > 0
      ? Object.fromEntries((requestSpec.request?.body?.fields ?? []).map((field) => [field.name, field.example ?? null]))
      : undefined
  },
  expect: {
    status: requestSpec.responses?.success?.status,
    required_paths: collectRequiredPaths(expectedBody).filter((value, index, array) => value && array.indexOf(value) === index),
    min_items: Array.isArray(expectedBody?.interviews)
      ? {
          path: "interviews",
          count: Math.max(1, expectedBody.interviews.length)
        }
      : undefined,
    first_item_required_paths: interviewItem
      ? {
          path: "interviews",
          paths: Object.keys(interviewItem)
        }
      : undefined
  }
});

const outputDir = path.join(repoRoot, "harness", "scenarios", "api", "generated");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `${requestSpec.name}.json`);
fs.writeFileSync(outputPath, `${JSON.stringify(scenario, null, 2)}\n`);

console.log(JSON.stringify({
  source_request: path.relative(repoRoot, requestPath),
  generated_scenario: path.relative(repoRoot, outputPath)
}, null, 2));
