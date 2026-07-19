#!/usr/bin/env -S deno run --unstable-sloppy-imports --allow-read --allow-write --allow-env --allow-run

import * as path from "@std/path";
import { buildExtension } from "./build.js";
import { createFirefoxManifest, fromProjectRoot, parseManifestFile } from "./build_utils.js";

const manifest = createFirefoxManifest(await parseManifestFile());
await buildExtension();
await Deno.writeTextFile(
  path.join(fromProjectRoot("dist", "suda"), "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
