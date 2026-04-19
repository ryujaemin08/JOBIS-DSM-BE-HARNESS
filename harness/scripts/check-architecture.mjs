import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const applicationRoot = path.join(repoRoot, "jobis-application", "src", "main", "java");
const infrastructureRoot = path.join(repoRoot, "jobis-infrastructure", "src", "main", "java");
const excludedArchitectureFiles = new Set([
  "jobis-infrastructure/src/main/java/team/retum/jobis/domain/HealthCheckWebAdapter.java",
]);

const violations = [
  ...checkApplicationImports(),
  ...checkAdapterPlacement(),
];

const output = {
  success: violations.length === 0,
  rule_source: "docs/architecture.md",
  violations,
};

console.log(JSON.stringify(output, null, 2));
process.exit(violations.length === 0 ? 0 : 1);

function checkApplicationImports() {
  const violations = [];
  for (const filePath of walkJavaFiles(applicationRoot)) {
    const source = fs.readFileSync(filePath, "utf8");
    const lines = source.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      const importsInfrastructure =
        trimmed.startsWith("import jakarta.persistence") ||
        trimmed.startsWith("import org.springframework.web") ||
        trimmed.startsWith("import org.springframework.data.jpa") ||
        trimmed.startsWith("import team.retum.jobis.global.security") ||
        (trimmed.startsWith("import team.retum.jobis") &&
          (trimmed.includes(".persistence.") || trimmed.includes(".presentation.")));

      if (importsInfrastructure) {
        violations.push({
          type: "architecture_violation",
          rule: "jobis-application must not depend on infrastructure implementation details",
          file: toRepoRelativePath(filePath),
          detail: trimmed,
        });
      }
    }
  }
  return violations;
}

function checkAdapterPlacement() {
  const violations = [];
  for (const filePath of walkJavaFiles(infrastructureRoot)) {
    const normalized = toRepoRelativePath(filePath);
    if (excludedArchitectureFiles.has(normalized)) {
      continue;
    }
    if (normalized.endsWith("WebAdapter.java") && !normalized.includes("/presentation/")) {
      violations.push({
        type: "architecture_violation",
        rule: "WebAdapter must live under infrastructure presentation packages",
        file: normalized,
        detail: "Expected path to include /presentation/",
      });
    }
    if (normalized.endsWith("PersistenceAdapter.java") && !normalized.includes("/persistence/")) {
      violations.push({
        type: "architecture_violation",
        rule: "PersistenceAdapter must live under infrastructure persistence packages",
        file: normalized,
        detail: "Expected path to include /persistence/",
      });
    }
  }
  return violations;
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

function toRepoRelativePath(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}
