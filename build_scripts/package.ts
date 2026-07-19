#!/usr/bin/env -S deno run --unstable-sloppy-imports --allow-read --allow-write --allow-env --allow-run

import * as fs from "@std/fs";
import * as path from "@std/path";
import { buildExtension } from "./build.js";
import {
  createFirefoxManifest,
  fromProjectRoot,
  parseManifestFile,
  runCommand,
} from "./build_utils.js";

type ExtensionManifest = {
  version: string;
  name: string;
  description: string;
  icons: Record<string, string>;
  background: { service_worker?: string; scripts?: string[] };
  options_ui: { page: string };
  action: {
    default_popup: string;
    default_icon: string | Record<string, string>;
    default_area?: string;
  };
  chrome_url_overrides?: Record<string, string>;
  content_scripts: Array<{ js?: string[]; css?: string[] }>;
  web_accessible_resources: Array<{ resources: string[] }>;
  permissions: string[];
  [key: string]: unknown;
};

function getPathsFromManifest(manifest: ExtensionManifest): string[] {
  let files = Object.values(manifest.icons) as string[];
  if (manifest.background.service_worker) files.push(manifest.background.service_worker);
  if (manifest.background.scripts) files = files.concat(manifest.background.scripts);
  files.push(manifest.options_ui.page, manifest.action.default_popup);
  if (manifest.chrome_url_overrides) {
    files = files.concat(Object.values(manifest.chrome_url_overrides));
  }

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

async function checkFilesFromManifestArePresent(
  manifest: ExtensionManifest,
  distDirectory: string,
) {
  const missing: string[] = [];
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

async function checkForCommonBuildIssues(manifest: ExtensionManifest) {
  if (!/^\d\.\d+\.\d+$/.test(manifest.version)) {
    throw new Error(`The version string "${manifest.version}" is malformed.`);
  }
  const utilsSource = await Deno.readTextFile(fromProjectRoot("lib", "utils.ts"));
  if (!utilsSource.includes("debug: false")) {
    throw new Error("Debug logging must be disabled in lib/utils.ts for store builds.");
  }
}

const chromeManifest = await parseManifestFile() as ExtensionManifest;
await checkForCommonBuildIssues(chromeManifest);

const distDirectory = fromProjectRoot("dist", "suda");
await buildExtension();
for (const directory of ["chrome-canary", "chrome-store", "firefox"]) {
  await Deno.mkdir(fromProjectRoot("dist", directory), { recursive: true });
}

const writeDistManifest = async (manifest: ExtensionManifest) => {
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
  ["-r", "--filesync", `../firefox/suda-firefox-${version}.zip`, ".", "-x", "icons/*.png"],
  { cwd: distDirectory },
);

await writeDistManifest(chromeManifest);
await runCommand(
  "zip",
  ["-r", "--filesync", `../chrome-store/suda-chrome-store-${version}.zip`, "."],
  { cwd: distDirectory },
);

const canaryManifest = {
  ...chromeManifest,
  name: "Suda Canary",
  description: "This is the development branch of Suda (it is beta software).",
};
await writeDistManifest(canaryManifest);
await runCommand(
  "zip",
  ["-r", "--filesync", `../chrome-canary/suda-canary-${version}.zip`, "."],
  { cwd: distDirectory },
);

// Leave dist/suda ready to load as the normal Chrome extension after packaging.
await writeDistManifest(chromeManifest);
