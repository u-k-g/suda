#!/usr/bin/env -S deno run --unstable-sloppy-imports --allow-read --allow-write --allow-env --allow-net --allow-run --allow-sys

import * as fs from "@std/fs";
import * as path from "@std/path";
import * as fileServer from "@std/http/file-server";
import { transform } from "esbuild";
import puppeteer from "puppeteer";
import { projectPath } from "./build_utils.js";

function isPortAvailable(port) {
  try {
    const listener = Deno.listen({ port });
    listener.close();
    return true;
  } catch {
    return false;
  }
}

function getAvailablePort() {
  const min = 7000;
  const max = 65535;
  const range = max - min + 1;
  let port = Math.floor(Math.random() * range) + min;
  for (let count = 0; count < range; count += 1) {
    if (isPortAvailable(port)) return port;
    port = port == max ? min : port + 1;
  }
  throw new Error(`No port is available in the range ${min}-${max}`);
}

async function findBrowserExecutable() {
  const configuredPath = Deno.env.get("PUPPETEER_EXECUTABLE_PATH");
  if (configuredPath != null) {
    if (await fs.exists(configuredPath)) return configuredPath;
    throw new Error(`PUPPETEER_EXECUTABLE_PATH does not exist: ${configuredPath}`);
  }

  // Prefer the version installed and managed by Puppeteer when it is available.
  const puppeteerPath = puppeteer.executablePath();
  if (await fs.exists(puppeteerPath)) return puppeteerPath;

  // A contributor may already have Chrome or Chromium installed without having downloaded the
  // exact revision pinned by Puppeteer. Use that browser for the DOM tests as a fallback.
  const candidates = {
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ],
    windows: [],
  }[Deno.build.os] ?? [];

  if (Deno.build.os == "windows") {
    for (
      const directory of [
        Deno.env.get("PROGRAMFILES"),
        Deno.env.get("PROGRAMFILES(X86)"),
        Deno.env.get("LOCALAPPDATA"),
      ]
    ) {
      if (directory != null) {
        candidates.push(path.join(directory, "Google", "Chrome", "Application", "chrome.exe"));
      }
    }
  }

  for (const candidate of candidates) {
    if (await fs.exists(candidate)) return candidate;
  }

  throw new Error(
    "Could not find Chrome or Chromium. Install Chrome, set PUPPETEER_EXECUTABLE_PATH, or run " +
      "`deno run -A npm:puppeteer@23.11.1 browsers install chrome`.",
  );
}

function setupPuppeteerPageForTests(page) {
  // Resolve console arguments in order so batches of asynchronous messages remain readable.
  const messageQueue = [];
  let processing = false;
  const processMessageQueue = async () => {
    while (messageQueue.length > 0) {
      console.log(...await Promise.all(messageQueue.shift()));
    }
    processing = false;
  };

  page.on("console", (message) => {
    messageQueue.push(message.args().map((argument) => argument.jsonValue()));
    if (!processing) {
      processing = true;
      processMessageQueue();
    }
  });
  page.on("error", (error) => console.error(error));
  page.on("pageerror", (error) => {
    page.receivedErrorOutput = true;
    console.log(error.toString());
  });
  page.on("requestfailed", (request) => {
    console.log(`${request.failure().errorText} ${request.url()}`);
  });
}

async function runPuppeteerTest(page, url, testNameFilter) {
  await page.goto(url, { waitUntil: "load" });
  return await page.evaluate(
    async (filter) =>
      await (globalThis as typeof globalThis & {
        shoulda: { run(filter?: string): Promise<boolean> };
      }).shoulda.run(filter),
    testNameFilter,
  );
}

const testNameFilter = Deno.args.length > 0 ? Deno.args.join(" ") : undefined;
const port = getAvailablePort();
let served404 = false;
const httpServer = Deno.serve({ port }, async (request) => {
  const url = new URL(request.url);
  const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const requestedPath = path.resolve(projectPath, relativePath);
  const isInsideProject = requestedPath == projectPath ||
    requestedPath.startsWith(projectPath + path.SEPARATOR);
  if (!isInsideProject) {
    return new Response(null, { status: 403 });
  }

  // Test HTML deliberately references the same .js paths as the built extension. During source
  // tests, compile the corresponding TypeScript file on demand instead of serving raw TypeScript.
  if (requestedPath.endsWith(".js") && !(await fs.exists(requestedPath))) {
    const sourcePath = requestedPath.replace(/\.js$/, ".ts");
    if (await fs.exists(sourcePath)) {
      const result = await transform(await Deno.readTextFile(sourcePath), {
        loader: "ts",
        target: "chrome117",
        sourcefile: path.relative(projectPath, sourcePath),
      });
      return new Response(result.code, {
        headers: { "content-type": "text/javascript; charset=utf-8" },
      });
    }
  }

  if (!(await fs.exists(requestedPath))) {
    console.error("dom-tests: requested missing file (not found):", requestedPath);
    served404 = true;
    return new Response(null, { status: 404 });
  }
  return await fileServer.serveFile(request, requestedPath);
});

let browser;
let success = true;
try {
  browser = await puppeteer.launch({ executablePath: await findBrowserExecutable() });
  for (const file of ["dom_tests.html"]) {
    const page = await browser.newPage();
    console.log("Running", file);
    setupPuppeteerPageForTests(page);
    const url = `http://localhost:${port}/tests/dom_tests/${file}?dom_tests=true`;
    success = (await runPuppeteerTest(page, url, testNameFilter)) && success;
    if (served404) {
      console.log(`${file} failed: a background or content script requested a missing file.`);
    }
    if (page.receivedErrorOutput) {
      console.log(`${file} failed: there was a page-level error.`);
      success = false;
    }
  }
} finally {
  if (browser != null) await browser.close();
  await httpServer.shutdown();
}

if (served404 || !success) Deno.exit(1);
