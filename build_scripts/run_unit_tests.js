#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-net --allow-run --allow-sys

import * as path from "@std/path";
import * as shoulda from "../tests/vendor/shoulda.js";
import { fromProjectRoot } from "./build_utils.js";

const testDirectory = fromProjectRoot("tests", "unit_tests");
const files = Array.from(Deno.readDirSync(testDirectory)).map((file) => file.name).sort();
for (const file of files) {
  if (file.endsWith("_test.js")) {
    await import(path.join(testDirectory, file));
  }
}

const testNameFilter = Deno.args.length > 0 ? Deno.args.join(" ") : undefined;
if (!(await shoulda.run(testNameFilter))) Deno.exit(1);
