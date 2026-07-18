#!/usr/bin/env -S deno run --allow-read --allow-write

import { createFirefoxManifest, fromProjectRoot, parseManifestFile } from "./build_utils.js";

const manifest = createFirefoxManifest(await parseManifestFile());
await Deno.writeTextFile(
  fromProjectRoot("manifest.json"),
  JSON.stringify(manifest, null, 2),
);
