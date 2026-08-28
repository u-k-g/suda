# Contributing to Suda

## Reporting a bug

File the issue [here](https://github.com/u-k-g/suda/issues).

## Contributing code

### Suda design principles

Suda brings Helix-inspired, keyboard-first navigation to the browser. Its default bindings adapt
selection-oriented editor ideas to links, tabs, history, bookmarks, search, and other browser
actions.

**Principles:**

1. **Keyboard first.** Common navigation and control should be fast without reaching for the mouse.
2. **Snappy, responsive, and notchy.** Every interaction should produce immediate, unmistakable
   feedback. Actions, mode changes, and failures should each click into a clear state -- never feel
   silent, mushy, or laggy.
3. **Predictable.** Bindings and modes should compose cleanly and behave consistently across sites.
4. **Immediately useful.** The defaults should provide a complete workflow before any configuration
   is required.
5. **Browser native.** Suda should complement the browser rather than fight its security model,
   accessibility, or established behavior.
6. **Focused.** New features should strengthen keyboard-first browsing without bloating the core
   experience.
7. **Maintainable.** Prefer clear, testable implementations that keep the codebase approachable.

### Installing From Source

Suda is written in TypeScript and compiled to browser-ready JavaScript. To install Suda from source:

1. Run `just build` in the Suda directory.
1. Navigate to `chrome://extensions`.
1. Toggle into Developer Mode.
1. Click on "Load Unpacked Extension...".
1. Select `dist/suda` inside the Suda directory.

### Running the tests

Our tests use [shoulda.js](https://github.com/philc/shoulda.js) and
[Puppeteer](https://github.com/puppeteer/puppeteer). To run the tests:

1. Install [just](https://just.systems/) and [Deno](https://deno.land/) if you don't have them
   already.
2. `deno run -A npm:puppeteer browsers install chrome` to install puppeteer
3. `just test` to run the unit and browser-DOM tests.

Run `just --list` to see the other development, packaging, and maintenance tasks.

The formatting, linting, and checking recipes pass arguments through to Deno. For example,
`just fmt --check content_scripts`, `just lint --fix pages`, and
`just check content_scripts/suda_frontend.ts` all work. Use `just test unit` or `just test dom` to
run one test suite. A suite can be followed by an optional test-name filter, such as
`just test unit "Browser new-tab redirects"`.

### Publishing a release

Run `just tag patch`, `just tag minor`, or `just tag major`. The command requires a clean working
tree, updates local `main` from `origin/main`, finds the latest stable semantic version tag, and
pushes the next `vMAJOR.MINOR.PATCH` tag. Minor and major bumps reset the lower version components
to zero. If the repository has no version tags yet, the version in `manifest.json` is the starting
point.

Pushing the tag starts GitHub Actions, which builds the extension with that version, creates
`suda.zip`, and attaches it to a GitHub Release. The archive contains the compiled `suda` directory
that users can select with Chrome's **Load unpacked** button; users do not need Deno or just.

### Coding Style

- Run `just fmt` at the root of the Suda project to format your code.
- We generally follow the recommendations from the
  [Airbnb JavaScript style guide](https://github.com/airbnb/javascript).
- We wrap lines at 100 characters.
- When writing comments, uppercase the first letter of your sentence, and put a period at the end.
- The TypeScript compiler targets the minimum Chrome version declared by the manifest. Update both
  targets together.
