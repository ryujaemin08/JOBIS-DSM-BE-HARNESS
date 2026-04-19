import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const argIndex = process.argv.indexOf("--request");
if (argIndex < 0 || !process.argv[argIndex + 1]) {
  console.error("Usage: node harness/scripts/intake-api-request.mjs --request <request.json>");
  process.exit(1);
}

const requestPath = path.resolve(repoRoot, process.argv[argIndex + 1]);
const raw = fs.readFileSync(requestPath, "utf8").replace(/^\uFEFF/, "");
const spec = JSON.parse(raw);

const requiredChecks = [
  { key: "name", question: "이 API를 식별할 slug/name 이 필요합니다." },
  { key: "summary", question: "이 API의 목적을 한 줄로 설명해 주세요." },
  { key: "method", question: "HTTP method 가 필요합니다." },
  { key: "path", question: "endpoint path 가 필요합니다." },
  { key: "purpose", question: "비즈니스 목적이 필요합니다." },
  { key: "authority", question: "누가 호출 가능한지 authority 정의가 필요합니다." },
  { key: "responses.success.status", question: "성공 status code 가 필요합니다." },
  { key: "responses.failures", question: "대표 failure case 가 필요합니다." },
  { key: "qa_expectations.success_assertions", question: "성공 시 무엇을 검증해야 하는지 필요합니다." }
];

function getPath(obj, dottedPath) {
  return dottedPath.split(".").reduce((current, segment) => {
    if (current == null) return undefined;
    return current[segment];
  }, obj);
}

const missing = [];
for (const check of requiredChecks) {
  const value = getPath(spec, check.key);
  const isMissing =
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);
  if (isMissing) {
    missing.push({
      field: check.key,
      question: check.question
    });
  }
}

const requestShape =
  spec.request?.path_params?.length ||
  spec.request?.query_params?.length ||
  spec.request?.headers?.length ||
  spec.request?.body?.fields?.length;

if (!requestShape) {
  missing.push({
    field: "request",
    question: "request 입력 정의가 필요합니다. path/query/header/body 중 하나 이상을 명시해 주세요."
  });
}

const output = {
  request_path: path.relative(repoRoot, requestPath),
  complete: missing.length === 0,
  missing_required_information: missing
};

console.log(JSON.stringify(output, null, 2));
process.exit(missing.length === 0 ? 0 : 2);
