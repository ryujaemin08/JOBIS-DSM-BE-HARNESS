import fs from "node:fs";
import path from "node:path";
import {
  repoRoot,
  generatedQaScenarioDir,
  generatedSreScenarioDir,
  spawnLogged,
  getBaseUrl,
} from "./_common.mjs";

const requestsDir = path.join(repoRoot, "harness", "requests");
const requestGeneratedDir = path.join(requestsDir, "generated");
const securityConfigPath = path.join(
  repoRoot,
  "jobis-infrastructure",
  "src",
  "main",
  "java",
  "team",
  "retum",
  "jobis",
  "global",
  "security",
  "SecurityConfig.java",
);
const webAdapterRoot = path.join(
  repoRoot,
  "jobis-infrastructure",
  "src",
  "main",
  "java",
  "team",
  "retum",
  "jobis",
  "domain",
);
const ignoredRequestFiles = new Set(["sample-short-request.json"]);
const supportedAuthorities = ["STUDENT", "TEACHER", "COMPANY"];

export const harnessAccounts = {
  STUDENT: {
    account_id: "harness.student.01",
    password: "HarnessPass123!",
    platform_type: "WEB",
    device_token: "harness-student-device-token",
  },
  TEACHER: {
    account_id: "harness.teacher.01",
    password: "HarnessPass123!",
    platform_type: "WEB",
    device_token: "harness-teacher-device-token",
  },
  COMPANY: {
    account_id: "harness.company.01",
    password: "HarnessPass123!",
    platform_type: "WEB",
    device_token: "harness-company-device-token",
  },
};

let cachedSecurityRules = null;
let cachedWebEndpoints = null;

export async function resolveTargetRequestPaths({ explicitPaths = [] } = {}) {
  const normalizedExplicitPaths = explicitPaths.map((requestPath) => normalizeRequestFilePath(requestPath));
  if (normalizedExplicitPaths.length > 0) {
    return normalizedExplicitPaths;
  }

  const changedRequestPaths = await detectChangedRequestPaths();
  if (changedRequestPaths.length > 0) {
    return changedRequestPaths;
  }

  const allRequestPaths = listRequestFiles();
  if (allRequestPaths.length === 1) {
    return allRequestPaths;
  }

  if (allRequestPaths.length === 0) {
    throw new Error("intake_failure:no_request_contract_found");
  }

  throw new Error(
    `intake_failure:unable_to_resolve_target_request_contract. Candidates: ${allRequestPaths.map(toRepoRelativePath).join(", ")}`,
  );
}

export function resolveExplicitRequestArgs(argv = process.argv) {
  const explicit = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--request" && argv[i + 1]) {
      explicit.push(argv[i + 1]);
    }
  }
  return explicit;
}

export function loadRequestSpec(requestPath) {
  const absolutePath = normalizeRequestFilePath(requestPath);
  const raw = fs.readFileSync(absolutePath, "utf8").replace(/^\uFEFF/, "");
  const spec = JSON.parse(raw);
  return {
    ...spec,
    __absolute_path: absolutePath,
    __relative_path: toRepoRelativePath(absolutePath),
  };
}

export function requestRequiresAuthorization(requestSpec) {
  return (requestSpec.request?.headers ?? []).some(
    (header) => header.name === "Authorization" && header.required,
  );
}

export function requestNeedsSre(requestSpec) {
  return requestSpec.sre_expectations?.enabled === true ||
    requestSpec.sre_expectations?.latency?.p95_ms_lte != null;
}

export function buildHttpPath(requestSpec, overrides = {}) {
  const normalizedPath = normalizeRequestPath(requestSpec.path);
  const queryExamples = Object.fromEntries(
    (requestSpec.request?.query_params ?? [])
      .filter((queryParam) => queryParam.example != null)
      .map((queryParam) => [queryParam.name, queryParam.example]),
  );
  const mergedQuery = {
    ...extractInlineQueryParams(requestSpec.path),
    ...queryExamples,
    ...(overrides.query_overrides ?? {}),
  };
  const mergedPathParams = Object.fromEntries(
    (requestSpec.request?.path_params ?? [])
      .filter((pathParam) => pathParam.example != null)
      .map((pathParam) => [pathParam.name, pathParam.example]),
  );

  let resolvedPath = normalizedPath;
  for (const [name, value] of Object.entries({ ...mergedPathParams, ...(overrides.path_overrides ?? {}) })) {
    resolvedPath = resolvedPath.replace(`{${name}}`, encodeURIComponent(String(value)));
  }

  const unresolved = resolvedPath.match(/\{[^}]+\}/g);
  if (unresolved) {
    throw new Error(`intake_failure:missing_path_param_examples:${unresolved.join(",")}`);
  }

  const searchParams = new URLSearchParams();
  for (const [name, value] of Object.entries(mergedQuery)) {
    if (value == null || value === "") continue;
    searchParams.set(name, String(value));
  }

  const queryString = searchParams.toString();
  return queryString ? `${resolvedPath}?${queryString}` : resolvedPath;
}

export function buildRequestBody(requestSpec, overrides = {}) {
  const bodyFields = requestSpec.request?.body?.fields ?? [];
  if (bodyFields.length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    bodyFields.map((field) => {
      const overrideValue = overrides.body_overrides?.[field.name];
      return [field.name, overrideValue ?? field.example ?? null];
    }),
  );
}

export function buildQaScenarioForRequest(requestSpec) {
  validateStructuredAssertions(requestSpec);
  assertFixtureCoverage(requestSpec);

  const scenario = {
    name: requestSpec.name,
    kind: "qa",
    base_url: getBaseUrl(),
    source_request: requestSpec.__relative_path,
    steps: [],
  };

  const loginSteps = new Map();
  const requiresAuthorization = requestRequiresAuthorization(requestSpec);

  if (requiresAuthorization) {
    const supportedAllowedAuthorities = (requestSpec.authority ?? []).filter((authority) => harnessAccounts[authority]);
    if (supportedAllowedAuthorities.length === 0) {
      throw new Error(`intake_failure:no_supported_authority_bootstrap:${(requestSpec.authority ?? []).join(",")}`);
    }

    for (const authority of supportedAllowedAuthorities) {
      const loginStep = buildLoginStep(authority);
      loginSteps.set(authority, loginStep.id);
      scenario.steps.push(loginStep);
      scenario.steps.push(
        buildQaHttpStep({
          id: `${authority.toLowerCase()}_target_request`,
          requestSpec,
          authority,
          loginStepId: loginStep.id,
          expect: {
            status: requestSpec.responses?.success?.status,
            assertions: requestSpec.qa_expectations?.success_assertions ?? [],
          },
          meta: {
            endpoint: buildHttpPath(requestSpec),
            authority,
            token_source: "/users/login",
          },
        }),
      );
    }
  } else {
    scenario.steps.push(
      buildQaHttpStep({
        id: "target_request",
        requestSpec,
        expect: {
          status: requestSpec.responses?.success?.status,
          assertions: requestSpec.qa_expectations?.success_assertions ?? [],
        },
        meta: {
          endpoint: buildHttpPath(requestSpec),
          authority: "PUBLIC",
          token_source: "none",
        },
      }),
    );
  }

  for (const negativeAssertion of requestSpec.qa_expectations?.negative_assertions ?? []) {
    const id = `${negativeAssertion.case ?? "negative"}_request`;
    if (negativeAssertion.omit_authorization) {
      scenario.steps.push(
        buildQaHttpStep({
          id,
          requestSpec,
          overrides: negativeAssertion,
          expect: { status: negativeAssertion.status, assertions: negativeAssertion.assertions ?? [] },
          meta: {
            endpoint: buildHttpPath(requestSpec, negativeAssertion),
            authority: "NO_TOKEN",
            token_source: "none",
            failure_case: negativeAssertion.case,
          },
        }),
      );
      continue;
    }

    const authority = negativeAssertion.authority ?? chooseForbiddenAuthority(requestSpec.authority ?? []);
    const loginStepId = requiresAuthorization ? ensureLoginStep(scenario.steps, loginSteps, authority) : null;
    scenario.steps.push(
      buildQaHttpStep({
        id,
        requestSpec,
        authority,
        loginStepId,
        overrides: negativeAssertion,
        expect: { status: negativeAssertion.status, assertions: negativeAssertion.assertions ?? [] },
        meta: {
          endpoint: buildHttpPath(requestSpec, negativeAssertion),
          authority,
          token_source: loginStepId ? "/users/login" : "none",
          failure_case: negativeAssertion.case,
        },
      }),
    );
  }

  return scenario;
}

export function buildSreScenarioForRequest(requestSpec) {
  assertFixtureCoverage(requestSpec);

  const latencyExpectation = requestSpec.sre_expectations?.latency;
  if (!latencyExpectation?.p95_ms_lte) {
    throw new Error(`sre_failure:missing_latency_target:${requestSpec.__relative_path}`);
  }

  const requiresAuthorization = requestRequiresAuthorization(requestSpec);
  const authority = requiresAuthorization
    ? requestSpec.sre_expectations?.authority ?? (requestSpec.authority ?? []).find((candidate) => harnessAccounts[candidate])
    : null;

  if (requiresAuthorization && !authority) {
    throw new Error(`sre_failure:no_supported_authority_bootstrap:${requestSpec.__relative_path}`);
  }

  const setupSteps = requiresAuthorization ? [buildLoginStep(authority)] : [];
  const requiredMetrics = requestSpec.sre_expectations?.metrics_required ?? ["http.server.requests"];

  return {
    name: `${requestSpec.name}-sre`,
    kind: "sre",
    base_url: getBaseUrl(),
    source_request: requestSpec.__relative_path,
    probes: [
      {
        id: "health",
        type: "http_json",
        request: {
          method: "GET",
          path: "/actuator/health",
        },
        expect: {
          status: 200,
          equals: {
            status: "UP",
          },
        },
      },
      {
        id: "metrics-index",
        type: "http_json",
        request: {
          method: "GET",
          path: "/actuator/metrics",
        },
        expect: {
          status: 200,
          assertions: [
            {
              type: "array_contains_all",
              path: "names",
              values: requiredMetrics,
            },
          ],
        },
      },
      {
        id: "prometheus-scrape",
        type: "http_text",
        request: {
          method: "GET",
          path: "/actuator/prometheus",
        },
        expect: {
          status: 200,
          contains: ["jvm_"],
        },
      },
      {
        id: "latency",
        type: "http_latency",
        meta: {
          endpoint: buildHttpPath(requestSpec),
          authority: authority ?? "PUBLIC",
          token_source: requiresAuthorization ? "/users/login" : "none",
        },
        setup_steps: setupSteps,
        request: buildHttpRequest(requestSpec, {
          authority,
          loginStepId: requiresAuthorization ? setupSteps[0].id : null,
        }),
        samples: latencyExpectation.samples ?? 5,
        expect: {
          status: requestSpec.responses?.success?.status,
          p95_ms_lte: latencyExpectation.p95_ms_lte,
        },
      },
      {
        id: "logs",
        type: "logs_post_startup",
        expect: {
          max_matches: requestSpec.sre_expectations?.max_log_matches ?? 0,
        },
      },
    ],
  };
}

export function writeScenario(kind, requestSpec, scenario) {
  const outputDir = kind === "qa" ? generatedQaScenarioDir : generatedSreScenarioDir;
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${requestSpec.name}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(scenario, null, 2)}\n`);
  return outputPath;
}

export function assertContractConsistency(requestSpec) {
  const securityRule = findSecurityRule(requestSpec.method, normalizeRequestPath(requestSpec.path));
  const webEndpoint = findWebEndpoint(requestSpec.method, normalizeRequestPath(requestSpec.path));

  if (!securityRule) {
    throw new Error(`contract_security_mismatch:no_security_rule:${requestSpec.method} ${normalizeRequestPath(requestSpec.path)}`);
  }
  if (!webEndpoint) {
    throw new Error(`contract_web_mismatch:no_web_adapter:${requestSpec.method} ${normalizeRequestPath(requestSpec.path)}`);
  }

  const requiresAuthorization = requestRequiresAuthorization(requestSpec);
  const contractAuthorities = uniqueStrings(requestSpec.authority ?? []);
  const securityAuthorities = uniqueStrings(securityRule.authorities ?? []);

  if (!requiresAuthorization && securityRule.access !== "permitAll") {
    throw new Error(`contract_security_mismatch:request_contract_public_but_security_is_${securityRule.access}`);
  }

  if (requiresAuthorization) {
    if (securityRule.access === "permitAll") {
      throw new Error("contract_security_mismatch:authorization_required_but_security_permit_all");
    }
    if (securityRule.access !== "authorities") {
      throw new Error(`contract_security_mismatch:explicit_authorities_required_but_security_is_${securityRule.access}`);
    }
    if (joinSignature(contractAuthorities) !== joinSignature(securityAuthorities)) {
      throw new Error(
        `contract_security_mismatch:authority_expected_${joinSignature(contractAuthorities)}_actual_${joinSignature(securityAuthorities)}`,
      );
    }
  }

  const contractQueryParams = uniqueStrings((requestSpec.request?.query_params ?? []).map((queryParam) => queryParam.name));
  const contractPathParams = uniqueStrings((requestSpec.request?.path_params ?? []).map((pathParam) => pathParam.name));
  if (joinSignature(contractQueryParams) !== joinSignature(webEndpoint.query_params)) {
    throw new Error(
      `contract_web_mismatch:query_params_expected_${joinSignature(contractQueryParams)}_actual_${joinSignature(webEndpoint.query_params)}`,
    );
  }
  if (joinSignature(contractPathParams) !== joinSignature(webEndpoint.path_params)) {
    throw new Error(
      `contract_web_mismatch:path_params_expected_${joinSignature(contractPathParams)}_actual_${joinSignature(webEndpoint.path_params)}`,
    );
  }

  const bodyFieldCount = requestSpec.request?.body?.fields?.length ?? 0;
  if (bodyFieldCount > 0 && !webEndpoint.has_request_body) {
    throw new Error("contract_web_mismatch:request_body_expected_but_web_adapter_has_no_request_body");
  }
  if (bodyFieldCount === 0 && webEndpoint.has_request_body && ["GET", "HEAD"].includes((requestSpec.method ?? "GET").toUpperCase())) {
    throw new Error("contract_web_mismatch:get_head_should_not_require_request_body");
  }

  return {
    security_rule: securityRule,
    web_endpoint: webEndpoint,
  };
}

export function verifyRuntimeContractConsistency(requestSpec) {
  return assertContractConsistency(requestSpec);
}

export function assertFixtureCoverage(requestSpec) {
  const fixtures = requestSpec.harness?.fixtures;
  if (!fixtures?.seed_script) {
    throw new Error(`fixture_failure:missing_seed_script:${requestSpec.__relative_path}`);
  }

  const seedPath = normalizeFilePath(fixtures.seed_script);
  if (!fs.existsSync(seedPath)) {
    throw new Error(`fixture_failure:seed_script_not_found:${toRepoRelativePath(seedPath)}`);
  }

  const seedSql = fs.readFileSync(seedPath, "utf8");
  for (const fragment of fixtures.required_sql_fragments ?? []) {
    if (!seedSql.includes(fragment)) {
      throw new Error(`fixture_failure:missing_sql_fragment:${fragment}`);
    }
  }
}

function validateStructuredAssertions(requestSpec) {
  const successAssertions = requestSpec.qa_expectations?.success_assertions ?? [];
  if (!Array.isArray(successAssertions) || successAssertions.length === 0 || successAssertions.some((assertion) => typeof assertion !== "object")) {
    throw new Error(`intake_failure:structured_success_assertions_required:${requestSpec.__relative_path}`);
  }

  for (const negativeAssertion of requestSpec.qa_expectations?.negative_assertions ?? []) {
    if (typeof negativeAssertion !== "object" || negativeAssertion.status == null) {
      throw new Error(`intake_failure:structured_negative_assertions_required:${requestSpec.__relative_path}`);
    }
  }
}

function buildLoginStep(authority) {
  const body = harnessAccounts[authority];
  if (!body) {
    throw new Error(`intake_failure:unsupported_authority_bootstrap:${authority}`);
  }

  return {
    id: `login_${authority.toLowerCase()}`,
    request: {
      method: "POST",
      path: "/users/login",
      headers: {
        "content-type": "application/json",
      },
      body,
    },
    expect: {
      status: 200,
      required_paths: ["access_token"],
    },
    meta: {
      step_type: "auth_bootstrap",
      authority,
      endpoint: "/users/login",
      token_source: "/users/login",
    },
  };
}

function ensureLoginStep(steps, loginSteps, authority) {
  if (loginSteps.has(authority)) {
    return loginSteps.get(authority);
  }

  const loginStep = buildLoginStep(authority);
  steps.push(loginStep);
  loginSteps.set(authority, loginStep.id);
  return loginStep.id;
}

function buildQaHttpStep({ id, requestSpec, authority, loginStepId, overrides = {}, expect, meta }) {
  return {
    id,
    request: buildHttpRequest(requestSpec, { authority, loginStepId, overrides }),
    expect,
    meta,
  };
}

function buildHttpRequest(requestSpec, { authority, loginStepId, overrides = {} } = {}) {
  const request = {
    method: requestSpec.method,
    path: buildHttpPath(requestSpec, overrides),
  };

  const headers = Object.fromEntries(
    (requestSpec.request?.headers ?? [])
      .filter((header) => header.name !== "Authorization" && header.example != null)
      .map((header) => [header.name, header.example]),
  );

  if (requestRequiresAuthorization(requestSpec) && !overrides.omit_authorization) {
    if (!authority || !loginStepId) {
      throw new Error(`intake_failure:authorization_required_but_missing_auth_context:${requestSpec.__relative_path}`);
    }
    headers.Authorization = `Bearer {{steps.${loginStepId}.body.access_token}}`;
  }

  for (const [headerName, headerValue] of Object.entries(overrides.headers_override ?? {})) {
    headers[headerName] = headerValue;
  }

  if (Object.keys(headers).length > 0) {
    request.headers = headers;
  }

  const body = buildRequestBody(requestSpec, overrides);
  if (body != null && !["GET", "HEAD"].includes((requestSpec.method ?? "GET").toUpperCase())) {
    request.body = body;
  }

  return request;
}

function chooseForbiddenAuthority(allowedAuthorities) {
  return supportedAuthorities.find((authority) => !allowedAuthorities.includes(authority));
}

function detectSecurityRules() {
  if (cachedSecurityRules) {
    return cachedSecurityRules;
  }

  const source = fs.readFileSync(securityConfigPath, "utf8");
  const normalizedSource = source.replace(/\r/g, "");
  const rules = [];

  for (const match of normalizedSource.matchAll(/\.requestMatchers\(HttpMethod\.([A-Z]+),\s*"([^"]+)"\)\s*\.\s*(permitAll|authenticated)\(\)/g)) {
    const [, method, routePath, accessType] = match;
    rules.push({
      method,
      path: routePath,
      access: accessType,
      authorities: [],
    });
  }

  for (const match of normalizedSource.matchAll(/\.requestMatchers\(HttpMethod\.([A-Z]+),\s*"([^"]+)"\)\s*\.\s*hasAuthority\(\s*([A-Z_]+)\.name\(\)\s*\)/g)) {
    const [, method, routePath, authority] = match;
    rules.push({
      method,
      path: routePath,
      access: "authorities",
      authorities: [authority],
    });
  }

  for (const match of normalizedSource.matchAll(/\.requestMatchers\(HttpMethod\.([A-Z]+),\s*"([^"]+)"\)\s*\.\s*hasAnyAuthority\(\s*((?:[A-Z_]+\.name\(\)\s*,?\s*)+)\)/g)) {
    const [, method, routePath, rawAuthorities] = match;
    rules.push({
      method,
      path: routePath,
      access: "authorities",
      authorities: [...rawAuthorities.matchAll(/([A-Z_]+)\.name\(\)/g)].map((value) => value[1]),
    });
  }

  cachedSecurityRules = rules;

  return cachedSecurityRules;
}

function detectWebEndpoints() {
  if (cachedWebEndpoints) {
    return cachedWebEndpoints;
  }

  cachedWebEndpoints = walkJavaFiles(webAdapterRoot)
    .filter((filePath) => filePath.endsWith("WebAdapter.java"))
    .flatMap((filePath) => parseWebAdapterFile(filePath));

  return cachedWebEndpoints;
}

function findSecurityRule(method, routePath) {
  return detectSecurityRules().find(
    (rule) => rule.method === (method ?? "GET").toUpperCase() && rule.path === routePath,
  );
}

function findWebEndpoint(method, routePath) {
  return detectWebEndpoints().find(
    (endpoint) => endpoint.method === (method ?? "GET").toUpperCase() && endpoint.path === routePath,
  );
}

function parseWebAdapterFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const basePathMatch = source.match(/@RequestMapping\("([^"]*)"\)/);
  const basePath = basePathMatch?.[1] ?? "";
  const endpoints = [];
  const methodRegex = /@(GetMapping|PostMapping|PatchMapping|PutMapping|DeleteMapping)(?:\(([\s\S]*?)\))?[\s\S]*?public\s+[^{]+?\(([\s\S]*?)\)\s*\{/g;

  for (const match of source.matchAll(methodRegex)) {
    const annotation = match[1];
    const annotationArgs = match[2] ?? "";
    const relativePath = extractAnnotationPath(annotationArgs);
    const parameters = match[3] ?? "";
    endpoints.push({
      source_file: toRepoRelativePath(filePath),
      method: annotation.replace("Mapping", "").toUpperCase(),
      path: joinPaths(basePath, relativePath),
      query_params: uniqueStrings(extractParameterNames(parameters, "RequestParam")),
      path_params: uniqueStrings(extractParameterNames(parameters, "PathVariable")),
      has_request_body: /@RequestBody/.test(parameters),
    });
  }

  return endpoints;
}

function detectChangedRequestPaths() {
  return spawnLogged("git", ["status", "--porcelain", "--untracked-files=all", "--", "harness/requests"]).then((result) => {
    if (result.code !== 0) {
      return [];
    }

    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.slice(3).trim())
      .filter((filePath) => filePath.endsWith(".json"))
      .filter((filePath) => filePath.startsWith("harness/requests/generated/"))
      .filter((filePath) => !ignoredRequestFiles.has(path.basename(filePath)))
      .map((filePath) => normalizeRequestFilePath(filePath));
  });
}

function listRequestFiles() {
  return walkJsonFiles(requestGeneratedDir)
    .filter((filePath) => !ignoredRequestFiles.has(path.basename(filePath)));
}

function walkJsonFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkJsonFiles(fullPath);
    }
    return entry.name.endsWith(".json") ? [fullPath] : [];
  });
}

function walkJavaFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkJavaFiles(fullPath);
    }
    return entry.name.endsWith(".java") ? [fullPath] : [];
  });
}

function normalizeRequestFilePath(requestPath) {
  const normalized = normalizeFilePath(requestPath);
  if (!fs.existsSync(normalized)) {
    throw new Error(`intake_failure:request_contract_not_found:${toRepoRelativePath(normalized)}`);
  }
  if (!normalized.startsWith(requestGeneratedDir)) {
    throw new Error(`intake_failure:request_contract_must_be_in_generated_dir:${toRepoRelativePath(normalized)}`);
  }
  return normalized;
}

function normalizeFilePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(repoRoot, filePath);
}

function normalizeRequestPath(routePath = "/") {
  return routePath.split("?")[0];
}

function extractInlineQueryParams(routePath = "/") {
  const [, queryString = ""] = routePath.split("?");
  return Object.fromEntries(new URLSearchParams(queryString).entries());
}

function extractAnnotationPath(annotationArgs) {
  if (!annotationArgs.trim()) {
    return "";
  }

  const directPath = annotationArgs.match(/^\s*"([^"]*)"\s*$/);
  if (directPath) {
    return directPath[1];
  }

  const namedPath = annotationArgs.match(/\b(?:value|path)\s*=\s*"([^"]*)"/);
  return namedPath?.[1] ?? "";
}

function extractParameterNames(parameters, annotationName) {
  const names = [];
  const directPattern = new RegExp(`@${annotationName}\\(\\s*"([^"]+)"`, "g");
  const namedPattern = new RegExp(`@${annotationName}\\(([^)]*?)\\b(?:value|name)\\s*=\\s*"([^"]+)"`, "g");

  for (const match of parameters.matchAll(directPattern)) {
    names.push(match[1]);
  }
  for (const match of parameters.matchAll(namedPattern)) {
    names.push(match[2]);
  }
  return names;
}

function joinPaths(basePath, relativePath) {
  const segments = [basePath, relativePath]
    .filter(Boolean)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""));
  return `/${segments.join("/")}`.replace(/\/+/g, "/");
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).filter(Boolean))].sort();
}

function joinSignature(values) {
  return uniqueStrings(values).join("|") || "none";
}

function toRepoRelativePath(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}
