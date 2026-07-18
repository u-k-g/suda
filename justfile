set shell := ["bash", "-euo", "pipefail", "-c"]

check_sources := "build_scripts/*.js background_scripts/*.js background_scripts/completion/*.js content_scripts/*.js lib/*.js pages/*.js tests/dom_tests/*.js tests/unit_tests/*.js tests/unit_tests/completion/*.js tests/vendor/*.js"

# List available tasks.
default:
  @just --list

# Download and parse the IANA top-level-domain list.
fetch-tlds:
  ./build_scripts/fetch_tlds.js

# Format the repository, or pass paths/flags through to deno fmt.
fmt *args:
  deno fmt {{args}}

# Lint the repository, or pass paths/flags through to deno lint.
lint *args:
  deno lint {{args}}

# Type-check the repository, or only the paths passed as arguments.
check *args:
  deno check {{ if args == "" { check_sources } else { args } }}

# Run all tests, or one suite: `just test [all|unit|dom] [test-name filter...]`.
test suite="all" *args:
  #!/usr/bin/env bash
  set -euo pipefail
  case {{quote(suite)}} in
    all)
      ./build_scripts/run_unit_tests.js {{args}}
      ./build_scripts/run_dom_tests.js {{args}}
      ;;
    unit)
      ./build_scripts/run_unit_tests.js {{args}}
      ;;
    dom)
      ./build_scripts/run_dom_tests.js {{args}}
      ;;
    *)
      echo "Unknown test suite: {{suite}}" >&2
      echo "Usage: just test [all|unit|dom] [test-name filter...]" >&2
      exit 2
      ;;
  esac

# Build the static command listing and Chrome, Chrome Canary, and Firefox store archives in dist/.
package:
  ./build_scripts/write_command_listing_page.js
  ./build_scripts/package.js

# Replace manifest.json with a Firefox-compatible development manifest.
write-firefox-manifest:
  ./build_scripts/write_firefox_manifest.js
