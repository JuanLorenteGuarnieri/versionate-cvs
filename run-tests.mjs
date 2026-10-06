import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

async function findTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return findTestFiles(entryPath);
    }
    return entry.isFile() && entry.name.endsWith(".test.ts") ? [entryPath] : [];
  }));

  return nestedFiles.flat();
}

const testFiles = (await findTestFiles(resolve("src"))).sort();
if (testFiles.length === 0) {
  console.error("No test files found under src.");
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...testFiles], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
}