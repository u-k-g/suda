#!/usr/bin/env -S deno run --unstable-sloppy-imports --allow-read --allow-write --allow-env --allow-run

import * as fs from "@std/fs";
import * as path from "@std/path";
import { transform } from "esbuild";
import { fromProjectRoot, parseManifestFile, projectPath, runCommand } from "./build_utils.js";

const sourceDirectories = ["background_scripts", "content_scripts", "lib", "pages"];

async function compileDirectory(sourceDirectory: string, outputDirectory: string) {
  for await (const entry of fs.walk(sourceDirectory, { includeDirs: false, exts: [".ts"] })) {
    const relativePath = path.relative(projectPath, entry.path);
    const outputPath = path.join(outputDirectory, relativePath.replace(/\.ts$/, ".js"));
    const result = await transform(await Deno.readTextFile(entry.path), {
      loader: "ts",
      target: "chrome117",
      sourcefile: relativePath,
      sourcemap: false,
    });
    await Deno.mkdir(path.dirname(outputPath), { recursive: true });
    await Deno.writeTextFile(outputPath, result.code);
  }
}

export async function buildExtension() {
  const outputDirectory = fromProjectRoot("dist", "suda");
  await fs.emptyDir(outputDirectory);

  const excludes = [
    "*.md",
    "*.ts",
    ".*",
    "CREDITS",
    "MIT-LICENSE.txt",
    "build_scripts",
    "dist",
    "justfile",
    "deno.json",
    "deno.lock",
    "test_harnesses",
    "tests",
    "types",
  ];
  const rsyncArgs = ["-r"];
  for (const exclude of excludes) rsyncArgs.push("--exclude", exclude);
  rsyncArgs.push(projectPath + path.SEPARATOR, outputDirectory);
  await runCommand("rsync", rsyncArgs);

  for (const directory of sourceDirectories) {
    await compileDirectory(fromProjectRoot(directory), outputDirectory);
  }

  // Chrome accepts comments in a development manifest, but emitting plain JSON keeps the build
  // identical to what is validated and placed in store archives.
  await Deno.writeTextFile(
    path.join(outputDirectory, "manifest.json"),
    JSON.stringify(await parseManifestFile(), null, 2),
  );
  console.log(`Built unpacked extension in ${outputDirectory}`);
}

if (import.meta.main) await buildExtension();
