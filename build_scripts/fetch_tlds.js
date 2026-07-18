#!/usr/bin/env -S deno run --allow-net --allow-write

import { DOMParser } from "@b-fuze/deno-dom";
import { fromProjectRoot } from "./build_utils.js";

const suffixListUrl = "https://www.iana.org/domains/root/db";
const response = await fetch(suffixListUrl);
if (!response.ok) {
  throw new Error(`Unable to fetch ${suffixListUrl}: ${response.status} ${response.statusText}`);
}

const document = new DOMParser().parseFromString(await response.text(), "text/html");
const domains = Array.from(document.querySelectorAll("span.domain.tld"))
  // Each span contains a TLD such as ".com"; omit the leading period.
  .map((element) => element.textContent.slice(1));
await Deno.writeTextFile(fromProjectRoot("resources", "tlds.txt"), domains.join("\n"));
