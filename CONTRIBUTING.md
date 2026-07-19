# Contributing to Suda

## Reporting a bug

File the issue [here](https://github.com/u-k-g/suda/issues).

## Contributing code

You'd like to fix a bug or implement a feature? Great! Before getting started, understand Suda's
design principles and the goals of the maintainers.

### Suda design principles

When people first start using Suda, it provides an incredibly powerful workflow improvement and it
makes them feel awesome. Surprisingly, Suda is applicable to a huge, broad population of people, not
just users of Vim.

In addition to power, a secondary goal of Suda is approachability: minimizing the barriers which
prevent a new user from feeling awesome. Many of Suda's users haven't used Vim before -- about 1 in
5 Chrome Store reviews say this -- and most people have strong web browsing habits forged from years
of browsing. Given that, it's a great experience when Suda feels like a natural addition to Chrome
which augments, but doesn't break, the user's current browsing habits.

**Principles:**

1. **Easy to understand**. Even if you're not very familiar with Vim. The Suda video shows you all
   you need to know to start using Suda and feel awesome.
2. **Reliable**. The core feature set works on most sites on the web.
3. **Immediately useful**. Suda doesn't require any configuration or doc-reading before it's useful.
   Just watch the video or hit `?`. You can transition into using Suda piecemeal; you don't need to
   jump in whole-hog from the start.
4. **Feels native**. Suda doesn't drastically change the way Chrome looks or behaves.
5. **Simple**. The core feature set isn't overwhelming. This principle is particularly vulnerable as
   we add to Suda, so it requires our active effort to maintain this simplicity.
6. **Code simplicity**. Developers find the Suda codebase relatively simple and easy to jump into.
   This allows more people to fix bugs and implement features.

### Which pull requests get merged?

**Goals of the maintainers**

The maintainers of Suda have limited bandwidth, which influences which PRs we can review and merge.

Our goals are generally to keep Suda small, maintainable, and really nail the broad appeal use
cases. This is in contrast to adding and maintaining an increasing number of complex or niche
features. We recommend those live in forked repos rather than the mainline Suda repo.

PRs we'll likely merge:

- Reflect all of the Suda design principles.
- Are useful for lots of Suda users.
- Have simple implementations (straightforward code, few lines of code).

PRs we likely won't:

- Violate one or more of our design principles.
- Are niche.
- Have complex implementations -- more code than they're worth.

Tips for preparing a PR:

- If you want to check with us first before implementing something big, open an issue proposing the
  idea. You'll get feedback from the maintainers as to whether it's something we'll likely merge.
- Try to keep PRs around 50 LOC or less. Bigger PRs create inertia for review.

Here's the rationale behind this policy:

- Suda is a volunteer effort. To make it possible to keep the project up-to-date as the web and
  browsers evolve, the codebase has to remain small and maintainable.
- If the maintainers don't use a feature, and most other users don't, then the feature will likely
  get neglected.
- Every feature, particularly neglected ones, increase the complexity of the codebase and makes it
  more difficult and less pleasant to work on.
- Adding a new feature is only part of the work. Once it's added, a feature must be maintained
  forever.
- Suda is a project which suffers from the
  [stadium model of open source](https://github.com/philc/book-notes/blob/master/engineering/working%20in%20public%20-%20nadia%20eghbal.md#the-structure-of-an-open-source-project-chap-2):
  there are many users but unfortunately few maintainers. As a result, there is bandwidth to
  maintain only a limited number of features in the main repo.

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

### Coding Style

- Run `just fmt` at the root of the Suda project to format your code.
- We generally follow the recommendations from the
  [Airbnb JavaScript style guide](https://github.com/airbnb/javascript).
- We wrap lines at 100 characters.
- When writing comments, uppercase the first letter of your sentence, and put a period at the end.
- The TypeScript compiler targets the minimum Chrome version declared by the manifest. Update both
  targets together.
