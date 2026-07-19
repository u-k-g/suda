import * as path from "@std/path";
import JSON5 from "json5";

export const projectPath = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

export function fromProjectRoot(...parts) {
  return path.join(projectPath, ...parts);
}

export async function parseManifestFile() {
  // Chrome accepts comments in manifest.json, but store packages do not. Parse it as JSON5 so the
  // generated manifests contain plain JSON.
  return JSON5.parse(await Deno.readTextFile(fromProjectRoot("manifest.json")));
}

export function createFirefoxManifest(manifest) {
  manifest = globalThis.structuredClone(manifest);

  manifest.permissions = manifest.permissions
    // Firefox needs these permissions for clipboard commands. The minimum supported Firefox
    // version does not expose Chrome's favicon or tabGroups APIs; both call sites degrade cleanly.
    .filter((permission) => !["favicon", "tabGroups"].includes(permission))
    .concat(["clipboardRead", "clipboardWrite"]);

  // Firefox uses background scripts rather than a Manifest V3 service worker.
  delete manifest.background.service_worker;
  manifest.background.scripts = ["background_scripts/main.js"];

  manifest.action.default_area = "navbar";
  manifest.browser_specific_settings = {
    gecko: {
      id: "{d7742d87-e61d-4b78-b8a1-b469842139fa}",
      strict_min_version: "112.0",
      data_collection_permissions: {
        required: ["none"],
      },
    },
  };

  manifest.icons = {
    "16": "icons/icon16.png",
    "32": "icons/icon48.png",
    "48": "icons/icon48.png",
    "64": "icons/icon128.png",
    "96": "icons/icon128.png",
    "128": "icons/icon128.png",
  };
  manifest.action.default_icon = {
    "16": "icons/action_disabled_16.png",
    "32": "icons/action_disabled_32.png",
  };
  return manifest;
}

export async function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string } = {},
) {
  const child = new Deno.Command(command, {
    args,
    cwd: options.cwd ?? projectPath,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();
  const status = await child.status;
  if (!status.success) {
    throw new Error(`${command} exited with status ${status.code}`);
  }
}
