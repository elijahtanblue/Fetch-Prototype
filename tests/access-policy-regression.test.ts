/**
 * Regression test ensuring no direct access logic duplicated outside policy module.
 *
 * Scans the codebase to verify that ALL access decisions route through
 * domain/policy/access.ts and no ad-hoc access logic exists elsewhere.
 */

import * as fs from "fs";
import * as path from "path";

function getFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .next, .git, tests, generated
      if (
        ["node_modules", ".next", ".git", "tests", "generated"].includes(
          entry.name
        )
      ) {
        continue;
      }
      results.push(...getFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const PROJECT_ROOT = path.resolve(__dirname, "..");

describe("Access Policy Regression - No Duplicated Logic", () => {
  const sourceFiles = getFiles(PROJECT_ROOT, [".ts", ".tsx"]);

  test("only domain/policy/access.ts exports evaluateAccess", () => {
    const filesExportingEvaluateAccess = sourceFiles.filter((f) => {
      if (f.includes(path.join("domain", "policy", "access"))) return false;
      const content = fs.readFileSync(f, "utf-8");
      return (
        content.includes("export function evaluateAccess") ||
        content.includes("export { evaluateAccess")
      );
    });

    expect(filesExportingEvaluateAccess).toEqual([]);
  });

  test("no route handler contains inline access decision logic", () => {
    const apiFiles = sourceFiles.filter((f) => f.includes(path.join("app", "api")));

    const filesWithInlineAccessLogic = apiFiles.filter((f) => {
      if (f.includes(path.join("snapshots"))) {
        // The snapshot route is allowed to CALL the policy — but not implement its own
        const content = fs.readFileSync(f, "utf-8");
        const importsPolicy = content.includes("domain/policy/access");
        const hasInlineLogic =
          content.includes("if (!clinic.optedIn)") ||
          content.includes("if (clinic.optedIn ===");
        return !importsPolicy || hasInlineLogic;
      }

      // Other API routes should not have access decision reason codes
      const content = fs.readFileSync(f, "utf-8");
      return (
        content.includes("OPTED_OUT") ||
        content.includes("INACTIVE_CONTRIBUTOR") ||
        content.includes("NO_SNAPSHOT")
      );
    });

    expect(filesWithInlineAccessLogic).toEqual([]);
  });

  test("no frontend component contains access decision logic", () => {
    const componentFiles = sourceFiles.filter(
      (f) =>
        f.includes(path.join("components")) ||
        (f.includes(path.join("app")) && f.endsWith(".tsx"))
    );

    const filesWithAccessLogic = componentFiles.filter((f) => {
      const content = fs.readFileSync(f, "utf-8");
      // Components should NOT compute access decisions — they should only render based on API response
      return (
        content.includes("evaluateAccess") ||
        content.includes("CONTRIBUTION_WINDOW") ||
        (content.includes("lastContributionAt") &&
          content.includes("30") &&
          content.includes("days"))
      );
    });

    expect(filesWithAccessLogic).toEqual([]);
  });

  test("policy module does not import Prisma", () => {
    const policyFile = path.join(
      PROJECT_ROOT,
      "domain",
      "policy",
      "access.ts"
    );
    const content = fs.readFileSync(policyFile, "utf-8");

    expect(content).not.toContain("@prisma");
    expect(content).not.toContain("from \"prisma\"");
    expect(content).not.toContain("PrismaClient");
    expect(content).not.toContain("@/lib/db");
  });

  test("snapshot endpoint routes through evaluateAccess", () => {
    const snapshotRoute = sourceFiles.find((f) =>
      f.includes(path.join("snapshots")) && f.endsWith("route.ts")
    );
    expect(snapshotRoute).toBeDefined();

    const content = fs.readFileSync(snapshotRoute!, "utf-8");
    expect(content).toContain("evaluateAccess");
    expect(content).toContain("domain/policy/access");
  });
});
