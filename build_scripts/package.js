#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run

import * as fs from "@std/fs";
import * as path from "@std/path";
import {
  createFirefoxManifest,
  fromProjectRoot,
  parseManifestFile,
  projectPath,
  runCommand,
} from "./build_utils.js";

function getPathsFromManifest(manifest) {
  let files = Object.values(manifest.icons);
  if (manifest.background.service_worker) files.push(manifest.background.service_worker);
  if (manifest.background.scripts) files = files.concat(manifest.background.scripts);
  files.push(manifest.options_ui.page, manifest.action.default_popup);

  const actionIcon = manifest.action.default_icon;
  files = files.concat(typeof actionIcon == "string" ? [actionIcon] : Object.values(actionIcon));
  for (const script of manifest.content_scripts) {
    if (script.js) files = files.concat(script.js);
    if (script.css) files = files.concat(script.css);
  }
  for (const resourceConfig of manifest.web_accessible_resources) {
    files = files.concat(resourceConfig.resources.filter((resource) => !resource.includes("*")));
  }

  if (files.some((file) => file == null)) {
    throw new Error("manifest.json is missing a path expected by the package builder");
  }
  return Array.from(new Set(files)).sort();
}

async function checkFilesFromManifestArePresent(manifest, distDirectory) {
  const missing = [];
  for (const file of getPathsFromManifest(manifest)) {
    if (!(await fs.exists(path.join(distDirectory, file)))) missing.push(file);
  }
  if (missing.length > 0) {
    throw new Error(
      "These files are referenced in manifest.json but missing from the build:\n" +
        missing.map((file) => `  ${file}`).join("\n"),
    );
  }
}

async function checkForCommonBuildIssues(manifest) {
  if (!/^\d\.\d+\.\d+$/.test(manifest.version)) {
    throw new Error(`The version string "${manifest.version}" is malformed.`);
  }
  const utilsSource = await Deno.readTextFile(fromProjectRoot("lib", "utils.js"));
  if (!utilsSource.includes("debug: false")) {
    throw new Error("Debug logging must be disabled in lib/utils.js for store builds.");
  }
}

const chromeManifest = await parseManifestFile();
await checkForCommonBuildIssues(chromeManifest);

const distDirectory = fromProjectRoot("dist", "vimium");
await fs.emptyDir(distDirectory);
for (const directory of ["chrome-canary", "chrome-store", "firefox"]) {
  await Deno.mkdir(fromProjectRoot("dist", directory), { recursive: true });
}

const excludes = [
  "*.md",
  ".*",
  "CREDITS",
  "MIT-LICENSE.txt",
  "build_scripts",
  "dist",
  "justfile",
  "deno.json",
  "deno.lock",
  "reload.html",
  "reload.js",
  "test_harnesses",
  "tests",
];
const rsyncArgs = ["-r"];
for (const exclude of excludes) rsyncArgs.push("--exclude", exclude);
rsyncArgs.push(projectPath + path.SEPARATOR, distDirectory);
await runCommand("rsync", rsyncArgs);

const writeDistManifest = async (manifest) => {
  await Deno.writeTextFile(
    path.join(distDirectory, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
};
const version = chromeManifest.version;

await checkFilesFromManifestArePresent(chromeManifest, distDirectory);

const firefoxManifest = createFirefoxManifest(chromeManifest);
await writeDistManifest(firefoxManifest);
await checkFilesFromManifestArePresent(firefoxManifest, distDirectory);
await runCommand(
  "zip",
  ["-r", "--filesync", `../firefox/vimium-firefox-${version}.zip`, ".", "-x", "icons/*.png"],
  { cwd: distDirectory },
);

await writeDistManifest(chromeManifest);
await runCommand(
  "zip",
  ["-r", "--filesync", `../chrome-store/vimium-chrome-store-${version}.zip`, "."],
  { cwd: distDirectory },
);

const canaryManifest = {
  ...chromeManifest,
  name: "Vimium Canary",
  description: "This is the development branch of Vimium (it is beta software).",
};
await writeDistManifest(canaryManifest);
await runCommand(
  "zip",
  ["-r", "--filesync", `../chrome-canary/vimium-canary-${version}.zip`, "."],
  { cwd: distDirectory },
);
