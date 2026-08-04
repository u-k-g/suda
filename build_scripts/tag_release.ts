#!/usr/bin/env -S deno run --unstable-sloppy-imports --allow-read --allow-run --allow-env

type Bump = "major" | "minor" | "patch";
type ReleaseType = "dev" | "stable";
type Version = [bigint, bigint, bigint];

interface ReleaseSelection {
  bump: Bump;
  releaseType: ReleaseType;
}

const maximumChromeVersionComponent = 65535n;

export function parseStableVersion(value: string): Version | null {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  return match == null ? null : [BigInt(match[1]), BigInt(match[2]), BigInt(match[3])];
}

export function formatVersion(version: Version): string {
  return version.join(".");
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

export function minuteOfDay(hour: number, minute: number): string {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`Invalid UTC hour: ${hour}`);
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error(`Invalid UTC minute: ${minute}`);
  }
  return String(hour * 60 + minute).padStart(4, "0");
}

export function developmentTag(version: Version, date: Date): string {
  if (Number.isNaN(date.getTime())) throw new Error("Cannot create a tag from an invalid date.");
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const timestamp = `${year}${month}${day}.${
    minuteOfDay(
      date.getUTCHours(),
      date.getUTCMinutes(),
    )
  }`;
  return `v${formatVersion(version)}-dev.${timestamp}`;
}

export function nextReleaseTag(
  version: Version,
  bump: Bump,
  releaseType: ReleaseType,
  date = new Date(),
): string {
  const nextVersion = bumpVersion(version, bump);
  return releaseType == "dev"
    ? developmentTag(nextVersion, date)
    : `v${formatVersion(nextVersion)}`;
}

function usage(): string {
  return `Usage:
  just tag
  just tag <patch|minor|major>
  just tag dev <patch|minor|major>
  just tag <+0.0.1|+0.1.0|+1.0.0>

Create and push a Suda stable or development release tag.

The command:
  1. Requires a clean working tree.
  2. Switches to main and fast-forwards it to origin/main.
  3. Reads the stable GitHub release labeled Latest (vX.Y.Z).
  4. Applies a patch, minor, or major bump and creates either a stable
     tag or, when dev is selected, a development prerelease tag.
  5. Development tags append UTC -dev.YYYYMMDD.mmmm, where mmmm is
     the zero-padded minute of day (0000-1439).
  6. Shows the tag and release title, then asks before creating and
     pushing the annotated tag that starts the release workflow.

Examples:
  Assuming the latest stable release is v5.2.0:

  just tag             # interactively choose a dev or stable release
  just tag patch       # v5.2.1
  just tag minor       # v5.3.0
  just tag major       # v6.0.0
  just tag dev patch   # v5.2.1-dev.YYYYMMDD.mmmm
  just tag dev minor   # v5.3.0-dev.YYYYMMDD.mmmm
  just tag dev major   # v6.0.0-dev.YYYYMMDD.mmmm
  just tag +0.0.1      # same as patch

All stable and development release tags use the v prefix.
No tag is created or pushed until the final confirmation is accepted.`;
}

export function normalizeBump(value: string): Bump | null {
  switch (value) {
    case "patch":
    case "+0.0.1":
      return "patch";
    case "minor":
    case "+0.1.0":
      return "minor";
    case "major":
    case "+1.0.0":
      return "major";
    default:
      return null;
  }
}

function isInteractive(): boolean {
  return Deno.stdin.isTerminal() && Deno.stdout.isTerminal();
}

function chooseFromPrompt(message: string, choices: ReleaseSelection[]): ReleaseSelection {
  if (!isInteractive()) {
    throw new Error(
      "A release selection is required without a TTY. Run 'just tag --help' for usage.",
    );
  }
  console.log(message);
  const answer = prompt(`Selection [1-${choices.length}]:`);
  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= choices.length) {
    throw new Error(`Invalid selection '${answer ?? ""}'.`);
  }
  return choices[index];
}

function chooseRelease(releaseArgument: string, bumpArgument: string): ReleaseSelection {
  if (releaseArgument == "dev") {
    if (bumpArgument == "") {
      return chooseFromPrompt(
        [
          "Choose the development version bump:",
          "  1) +0.0.1 (patch)",
          "  2) +0.1.0 (minor)",
          "  3) +1.0.0 (major)",
        ].join("\n"),
        [
          { releaseType: "dev", bump: "patch" },
          { releaseType: "dev", bump: "minor" },
          { releaseType: "dev", bump: "major" },
        ],
      );
    }
    const bump = normalizeBump(bumpArgument);
    if (bump == null) {
      throw new Error(
        `Unknown dev bump '${bumpArgument}'. Use patch, minor, major, +0.0.1, +0.1.0, or +1.0.0.`,
      );
    }
    return { releaseType: "dev", bump };
  }

  if (releaseArgument != "") {
    if (bumpArgument != "") {
      throw new Error("Stable releases take one bump argument: just tag <patch|minor|major>");
    }
    const bump = normalizeBump(releaseArgument);
    if (bump == null) {
      throw new Error(
        `Unknown stable bump '${releaseArgument}'. Use patch, minor, major, +0.0.1, +0.1.0, or +1.0.0.`,
      );
    }
    return { releaseType: "stable", bump };
  }

  return chooseFromPrompt(
    [
      "Choose the release:",
      "  1) dev patch",
      "  2) dev minor",
      "  3) dev major",
      "  4) stable patch",
      "  5) stable minor",
      "  6) stable major",
    ].join("\n"),
    [
      { releaseType: "dev", bump: "patch" },
      { releaseType: "dev", bump: "minor" },
      { releaseType: "dev", bump: "major" },
      { releaseType: "stable", bump: "patch" },
      { releaseType: "stable", bump: "minor" },
      { releaseType: "stable", bump: "major" },
    ],
  );
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

async function commandStatus(command: string, args: string[]): Promise<number> {
  try {
    return (await new Deno.Command(command, {
      args,
      stdout: "null",
      stderr: "null",
    }).output()).code;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`Required command not found: ${command}`);
    }
    throw error;
  }
}

async function capture(command: string, args: string[]): Promise<string> {
  let output: Deno.CommandOutput;
  try {
    output = await new Deno.Command(command, {
      args,
      stdout: "piped",
      stderr: "piped",
    }).output();
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`Required command not found: ${command}`);
    }
    throw error;
  }
  if (!output.success) {
    const details = new TextDecoder().decode(output.stderr).trim();
    throw new Error(`${command} ${args.join(" ")} failed${details == "" ? "" : `: ${details}`}`);
  }
  return new TextDecoder().decode(output.stdout).trim();
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

async function tagRelease(selection: ReleaseSelection) {
  await capture("git", ["--version"]);
  await capture("gh", ["--version"]);

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

  const repository = await capture("gh", [
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "--jq",
    ".nameWithOwner",
  ]);
  const latestTag = await capture("gh", [
    "api",
    `repos/${repository}/releases/latest`,
    "--jq",
    "select(.draft == false and .prerelease == false) | .tag_name",
  ]);
  const latestVersion = latestTag.startsWith("v") ? parseStableVersion(latestTag) : null;
  if (latestVersion == null) {
    throw new Error(`GitHub's release labeled Latest is missing or is not vX.Y.Z: '${latestTag}'`);
  }

  const nextVersion = bumpVersion(latestVersion, selection.bump);
  if (nextVersion.some((component) => component > maximumChromeVersionComponent)) {
    throw new Error(
      `The next version exceeds Chrome's 65535 component limit: ${formatVersion(nextVersion)}`,
    );
  }

  const tag = nextReleaseTag(latestVersion, selection.bump, selection.releaseType);
  if (await gitSucceeds(["show-ref", "--verify", "--quiet", `refs/tags/${tag}`])) {
    throw new Error(`Tag '${tag}' already exists locally.`);
  }
  const remoteTagStatus = await commandStatus("git", [
    "ls-remote",
    "--exit-code",
    "--tags",
    "origin",
    `refs/tags/${tag}`,
  ]);
  if (remoteTagStatus == 0) throw new Error(`Tag '${tag}' already exists on origin.`);
  if (remoteTagStatus != 2) {
    throw new Error(`Could not check whether tag '${tag}' exists on origin.`);
  }

  const version = tag.slice(1);
  const releaseTitle = `Suda ${version}`;
  console.log(`\nLatest stable release: ${latestTag}`);
  console.log(`Release type:          ${selection.releaseType}`);
  console.log(`Version bump:          ${selection.bump}`);
  console.log(`Tag:                   ${tag}`);
  console.log(`Release title:         ${releaseTitle}\n`);

  if (!isInteractive()) {
    throw new Error(`Refusing to create and push '${tag}' without an interactive confirmation.`);
  }
  const answer = prompt(`Create and push ${tag}? [y/N]`);
  if (answer != "y" && answer != "Y") {
    console.log("Cancelled; no tag was created.");
    return;
  }

  await runGit(["tag", "--annotate", "--no-sign", tag, "--message", releaseTitle]);
  try {
    await runGit(["push", "origin", `refs/tags/${tag}`]);
  } catch (error) {
    console.error(`ERROR: Push failed. The local tag still exists: ${tag}`);
    console.error(`Delete it only after diagnosing the push failure: git tag -d ${tag}`);
    throw error;
  }

  console.log(`Pushed ${tag}; the release workflow will publish ${releaseTitle}.`);
}

if (import.meta.main) {
  const [releaseArgument = "", bumpArgument = "", ...extraArguments] = Deno.args;
  if (["-h", "--help", "help"].includes(releaseArgument)) {
    if (bumpArgument != "" || extraArguments.length != 0) {
      throw new Error("The help option does not accept additional arguments.");
    }
    console.log(usage());
  } else {
    if (extraArguments.length != 0) {
      throw new Error("Too many arguments. Run 'just tag --help' for usage.");
    }
    await tagRelease(chooseRelease(releaseArgument, bumpArgument));
  }
}
