#!/usr/bin/env -S deno run --unstable-sloppy-imports --allow-read --allow-run --allow-env

import { parseManifestFile } from "./build_utils.js";

type Bump = "major" | "minor" | "patch";
type Version = [bigint, bigint, bigint];

const maximumChromeVersionComponent = 65535n;

export function parseStableVersion(value: string): Version | null {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  return match == null ? null : [BigInt(match[1]), BigInt(match[2]), BigInt(match[3])];
}

export function formatVersion(version: Version): string {
  return version.join(".");
}

function compareVersions(left: Version, right: Version): number {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
}

export function findLatestVersion(tags: string[], fallback: string): Version {
  const versions = tags.map(parseStableVersion).filter((version) => version != null);
  if (versions.length == 0) {
    const fallbackVersion = parseStableVersion(fallback);
    if (fallbackVersion == null) {
      throw new Error(`The manifest does not contain a stable semantic version: ${fallback}`);
    }
    return fallbackVersion;
  }
  return versions.reduce((latest, version) =>
    compareVersions(version, latest) > 0 ? version : latest
  );
}

export function bumpVersion(version: Version, bump: Bump): Version {
  const [major, minor, patch] = version;
  switch (bump) {
    case "major":
      return [major + 1n, 0n, 0n];
    case "minor":
      return [major, minor + 1n, 0n];
    case "patch":
      return [major, minor, patch + 1n];
  }
}

async function captureGit(args: string[]): Promise<string> {
  const output = await new Deno.Command("git", {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) {
    const error = new TextDecoder().decode(output.stderr).trim();
    throw new Error(`git ${args.join(" ")} failed${error == "" ? "" : `: ${error}`}`);
  }
  return new TextDecoder().decode(output.stdout).trim();
}

async function gitSucceeds(args: string[]): Promise<boolean> {
  const output = await new Deno.Command("git", {
    args,
    stdout: "null",
    stderr: "null",
  }).output();
  return output.success;
}

async function runGit(args: string[]): Promise<void> {
  const status = await new Deno.Command("git", {
    args,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).spawn().status;
  if (!status.success) throw new Error(`git ${args.join(" ")} exited with status ${status.code}`);
}

async function tagRelease(bump: Bump) {
  if (await captureGit(["status", "--porcelain=v1"]) != "") {
    throw new Error("The working tree is not clean. Commit or stash changes before tagging.");
  }
  if (!(await gitSucceeds(["remote", "get-url", "origin"]))) {
    throw new Error("The repository does not have an origin remote.");
  }

  console.log("Fetching origin/main and release tags...");
  await runGit(["fetch", "origin", "main", "--tags"]);

  if (await gitSucceeds(["show-ref", "--verify", "--quiet", "refs/heads/main"])) {
    await runGit(["switch", "main"]);
  } else {
    await runGit(["switch", "--track", "-c", "main", "origin/main"]);
  }
  await runGit(["merge", "--ff-only", "origin/main"]);

  const head = await captureGit(["rev-parse", "HEAD"]);
  const originMain = await captureGit(["rev-parse", "origin/main"]);
  if (head != originMain) {
    throw new Error("Local main has unpushed commits. Push them before creating a release tag.");
  }

  const tags = (await captureGit(["for-each-ref", "--format=%(refname:short)", "refs/tags"]))
    .split("\n")
    .filter((tag) => tag != "");
  const manifest = await parseManifestFile();
  const latestVersion = findLatestVersion(tags, manifest.version);
  const nextVersion = bumpVersion(latestVersion, bump);
  if (nextVersion.some((component) => component > maximumChromeVersionComponent)) {
    throw new Error(
      `The next version exceeds Chrome's 65535 component limit: ${formatVersion(nextVersion)}`,
    );
  }

  const version = formatVersion(nextVersion);
  const tag = `v${version}`;
  console.log(`Tagging ${tag} at origin/main...`);
  await runGit(["tag", "--annotate", "--no-sign", tag, "--message", `Suda ${version}`]);
  try {
    await runGit(["push", "origin", `refs/tags/${tag}`]);
  } catch (error) {
    await runGit(["tag", "--delete", tag]);
    throw new Error(
      `Could not push ${tag}; removed the local tag so the command is safe to retry.`,
      {
        cause: error,
      },
    );
  }

  console.log(`Pushed ${tag}. GitHub Actions will build and publish suda.zip.`);
}

if (import.meta.main) {
  const bump = Deno.args[0];
  if (bump != "major" && bump != "minor" && bump != "patch") {
    console.error("Usage: just tag [patch|minor|major]");
    Deno.exit(2);
  }
  await tagRelease(bump);
}
