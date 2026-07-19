import * as path from "@std/path";
import JSON5 from "json5";

export const projectPath = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

export function fromProjectRoot(...parts) {
  return path.join(projectPath, ...parts);
}

export async function parseManifestFile() {
  // Parse Chrome's commented manifest and emit plain JSON in the unpacked build.
  return JSON5.parse(await Deno.readTextFile(fromProjectRoot("manifest.json")));
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
