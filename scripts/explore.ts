import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type ToolSummary = {
  toolName: string;
  filePath: string;
};

const ROOT_DIR = process.cwd();
const OUT_FILE = path.join(ROOT_DIR, "CODEBASE_CONTEXT.md");

const IGNORED_DIRS = new Set(["node_modules", "dist", ".git"]);
const TEXT_FILE_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md"]);

function normalizeSlashes(p: string): string {
  return p.split(path.sep).join("/");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath: string): Promise<string | null> {
  if (!(await exists(filePath))) return null;
  return readFile(filePath, "utf8");
}

function parseEnvKeys(envExample: string): string[] {
  return envExample
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .map((l) => l.split("=", 1)[0]?.trim())
    .filter((k): k is string => Boolean(k));
}

async function listTreeLines(dirPath: string, maxDepth: number): Promise<string[]> {
  async function walk(currentPath: string, depth: number): Promise<string[]> {
    const rel = normalizeSlashes(path.relative(ROOT_DIR, currentPath)) || ".";
    const prefix = "  ".repeat(depth);
    const lines: string[] = [];

    if (depth === 0) {
      lines.push(`${rel}/`);
    }

    if (depth >= maxDepth) return lines;

    const entries = await readdir(currentPath, { withFileTypes: true });
    const filtered = entries.filter((e) => !IGNORED_DIRS.has(e.name));
    filtered.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of filtered) {
      const entryPath = path.join(currentPath, entry.name);
      const entryRel = normalizeSlashes(path.relative(ROOT_DIR, entryPath));
      if (entry.isDirectory()) {
        lines.push(`${prefix}- ${entryRel}/`);
        lines.push(...(await walk(entryPath, depth + 1)));
      } else {
        lines.push(`${prefix}- ${entryRel}`);
      }
    }

    return lines;
  }

  return walk(dirPath, 0);
}

async function collectTsFilesUnderSrc(): Promise<string[]> {
  const srcDir = path.join(ROOT_DIR, "src");
  if (!(await exists(srcDir))) return [];

  const results: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      if (path.extname(entry.name) === ".ts") {
        results.push(entryPath);
      }
    }
  }

  await walk(srcDir);
  results.sort((a, b) => a.localeCompare(b));
  return results.map((p) => normalizeSlashes(path.relative(ROOT_DIR, p)));
}

async function collectTools(): Promise<ToolSummary[]> {
  const toolsDir = path.join(ROOT_DIR, "src", "tools");
  if (!(await exists(toolsDir))) return [];

  const entries = await readdir(toolsDir, { withFileTypes: true });
  const toolFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".ts"))
    .map((e) => path.join(toolsDir, e.name))
    .sort((a, b) => a.localeCompare(b));

  const tools: ToolSummary[] = [];
  const toolRegex = /registerTool\s*\(\s*["'`](?<name>[^"'`]+)["'`]/g;

  for (const file of toolFiles) {
    const content = await readFile(file, "utf8");
    const matches = content.matchAll(toolRegex);
    for (const m of matches) {
      const name = m.groups?.name;
      if (!name) continue;
      tools.push({
        toolName: name,
        filePath: normalizeSlashes(path.relative(ROOT_DIR, file)),
      });
    }
  }

  tools.sort((a, b) => a.toolName.localeCompare(b.toolName));
  return tools;
}

async function collectReadableFilesSummary(): Promise<string[]> {
  const entries = await readdir(ROOT_DIR, { withFileTypes: true });
  const topLevel = entries
    .filter((e) => e.isFile() && TEXT_FILE_EXTS.has(path.extname(e.name)))
    .map((e) => e.name)
    .filter((n) => n !== path.basename(OUT_FILE))
    .sort((a, b) => a.localeCompare(b));

  return topLevel.map((f) => `- ${f}`);
}

function mdSection(title: string, lines: string[]): string {
  const body = lines.length > 0 ? lines.join("\n") : "_(none)_";
  return `## ${title}\n\n${body}\n`;
}

async function main(): Promise<void> {
  const pkgRaw = await readTextIfExists(path.join(ROOT_DIR, "package.json"));
  const pkg = pkgRaw ? (JSON.parse(pkgRaw) as Record<string, unknown>) : null;

  const envExampleRaw = await readTextIfExists(path.join(ROOT_DIR, ".env.example"));
  const envKeys = envExampleRaw ? parseEnvKeys(envExampleRaw) : [];

  const srcTreeLines = (await exists(path.join(ROOT_DIR, "src")))
    ? await listTreeLines(path.join(ROOT_DIR, "src"), 5)
    : [];

  const tsFiles = await collectTsFilesUnderSrc();
  const tools = await collectTools();
  const topLevelTextFiles = await collectReadableFilesSummary();

  const now = new Date().toISOString();

  const overviewLines: string[] = [];
  overviewLines.push(`Generated: ${now}`);
  if (pkg?.name) overviewLines.push(`Package: ${String(pkg.name)}`);
  if (pkg?.version) overviewLines.push(`Version: ${String(pkg.version)}`);
  if (pkg?.description) overviewLines.push(`Description: ${String(pkg.description)}`);
  if (pkg?.type) overviewLines.push(`Module type: ${String(pkg.type)}`);
  if (pkg?.main) overviewLines.push(`Main: ${String(pkg.main)}`);
  if (pkg?.engines && typeof pkg.engines === "object" && pkg.engines && "node" in pkg.engines) {
    overviewLines.push(`Node engine: ${String((pkg.engines as Record<string, unknown>).node)}`);
  }

  const scriptsLines: string[] = [];
  if (pkg?.scripts && typeof pkg.scripts === "object" && pkg.scripts) {
    const scripts = pkg.scripts as Record<string, unknown>;
    const keys = Object.keys(scripts).sort((a, b) => a.localeCompare(b));
    for (const k of keys) {
      scriptsLines.push(`- ${k}: ${String(scripts[k])}`);
    }
  }

  const depsLines: string[] = [];
  if (pkg?.dependencies && typeof pkg.dependencies === "object" && pkg.dependencies) {
    const deps = pkg.dependencies as Record<string, unknown>;
    const keys = Object.keys(deps).sort((a, b) => a.localeCompare(b));
    for (const k of keys) depsLines.push(`- ${k}: ${String(deps[k])}`);
  }

  const devDepsLines: string[] = [];
  if (pkg?.devDependencies && typeof pkg.devDependencies === "object" && pkg.devDependencies) {
    const deps = pkg.devDependencies as Record<string, unknown>;
    const keys = Object.keys(deps).sort((a, b) => a.localeCompare(b));
    for (const k of keys) devDepsLines.push(`- ${k}: ${String(deps[k])}`);
  }

  const entrypoints: string[] = [];
  if (await exists(path.join(ROOT_DIR, "src", "index.ts"))) entrypoints.push("- src/index.ts (MCP server entrypoint)");
  if (await exists(path.join(ROOT_DIR, "opencode.json"))) entrypoints.push("- opencode.json (OpenCode MCP config)");
  if (await exists(path.join(ROOT_DIR, "README.md"))) entrypoints.push("- README.md (usage, tools, setup)");

  const envLines = envKeys.length ? envKeys.map((k) => `- ${k}`) : [];
  const toolLines = tools.length ? tools.map((t) => `- ${t.toolName} (${t.filePath})`) : [];
  const tsFileLines = tsFiles.length ? tsFiles.map((f) => `- ${f}`) : [];

  const parts: string[] = [];
  parts.push(`# Codebase Context Snapshot\n`);
  parts.push(mdSection("Overview", overviewLines));
  parts.push(mdSection("Entrypoints", entrypoints));
  parts.push(mdSection("Top-Level Text Files", topLevelTextFiles));
  parts.push(mdSection("Environment Variables (.env.example)", envLines));
  parts.push(mdSection("NPM Scripts", scriptsLines));
  parts.push(mdSection("Dependencies", depsLines));
  parts.push(mdSection("Dev Dependencies", devDepsLines));
  parts.push(mdSection("MCP Tools (from src/tools/*.ts)", toolLines));
  parts.push(mdSection("Source Tree (src/)", srcTreeLines));
  parts.push(mdSection("All TypeScript Files (src/)", tsFileLines));

  const md = parts.join("\n");
  await writeFile(OUT_FILE, md, "utf8");
  process.stdout.write(md);
}

main().catch((error) => {
  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error));
  process.stderr.write("\n");
  process.exit(1);
});
