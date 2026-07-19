set shell := ["bash", "-euo", "pipefail", "-c"]

check_sources := "types/*.d.ts build_scripts/*.ts background_scripts/*.ts background_scripts/completion/*.ts content_scripts/*.ts lib/*.ts pages/*.ts test_harnesses/*.ts tests/dom_tests/*.ts tests/unit_tests/*.ts tests/unit_tests/completion/*.ts tests/vendor/*.ts"

# List available tasks.
default:
  @just --list

# Download and parse the IANA top-level-domain list.
fetch-tlds:
  ./build_scripts/fetch_tlds.ts

# Compile TypeScript into a Chrome-loadable unpacked extension in dist/suda/.
build:
  ./build_scripts/build.ts

# Format the repository, or pass paths/flags through to deno fmt.
fmt *args:
  deno fmt {{args}}

# Lint the repository, or pass paths/flags through to deno lint.
lint *args:
  deno lint {{args}}

# Type-check the repository, passing any extra paths or flags through to Deno.
check *args:
  deno check --unstable-sloppy-imports {{args}} {{check_sources}}

# Run all tests, or one suite: `just test [all|unit|dom] [test-name filter...]`.
test suite="all" *args:
  #!/usr/bin/env bash
  set -euo pipefail
  case {{quote(suite)}} in
    all)
      ./build_scripts/run_unit_tests.ts {{args}}
      ./build_scripts/run_dom_tests.ts {{args}}
      ;;
    unit)
      ./build_scripts/run_unit_tests.ts {{args}}
      ;;
    dom)
      ./build_scripts/run_dom_tests.ts {{args}}
      ;;
    *)
      echo "Unknown test suite: {{suite}}" >&2
      echo "Usage: just test [all|unit|dom] [test-name filter...]" >&2
      exit 2
      ;;
  esac
