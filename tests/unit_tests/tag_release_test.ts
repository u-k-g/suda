import "./test_helper.js";
import {
  bumpVersion,
  developmentTag,
  formatVersion,
  minuteOfDay,
  nextReleaseTag,
  normalizeBump,
  parseStableVersion,
} from "../../build_scripts/tag_release.js";

context("Release tags", () => {
  should("parse stable semantic versions with an optional v prefix", () => {
    assert.equal("1.2.3", formatVersion(parseStableVersion("1.2.3")));
    assert.equal("10.20.30", formatVersion(parseStableVersion("v10.20.30")));
  });

  should("reject non-release versions", () => {
    assert.equal(null, parseStableVersion("v1.2"));
    assert.equal(null, parseStableVersion("v1.2.3-beta.1"));
    assert.equal(null, parseStableVersion("v01.2.3"));
    assert.equal(null, parseStableVersion("release-1.2.3"));
  });

  should("bump versions using semantic-version reset rules", () => {
    const version = parseStableVersion("2.4.9");
    assert.equal("2.4.10", formatVersion(bumpVersion(version, "patch")));
    assert.equal("2.5.0", formatVersion(bumpVersion(version, "minor")));
    assert.equal("3.0.0", formatVersion(bumpVersion(version, "major")));
  });

  should("normalize named and numeric bump arguments", () => {
    assert.equal("patch", normalizeBump("patch"));
    assert.equal("patch", normalizeBump("+0.0.1"));
    assert.equal("minor", normalizeBump("+0.1.0"));
    assert.equal("major", normalizeBump("+1.0.0"));
    assert.equal(null, normalizeBump("+1.1.0"));
  });

  should("format the UTC minute of day", () => {
    assert.equal("0000", minuteOfDay(0, 0));
    assert.equal("0651", minuteOfDay(10, 51));
    assert.equal("1439", minuteOfDay(23, 59));
  });

  should("create stable and development release tags", () => {
    const version = parseStableVersion("5.2.0");
    const date = new Date("2026-08-04T10:51:00Z");
    assert.equal("v5.2.1", nextReleaseTag(version, "patch", "stable", date));
    assert.equal("v5.3.0", nextReleaseTag(version, "minor", "stable", date));
    assert.equal("v6.0.0", nextReleaseTag(version, "major", "stable", date));
    assert.equal(
      "v5.2.1-dev.20260804.0651",
      nextReleaseTag(version, "patch", "dev", date),
    );
    assert.equal("v5.2.0-dev.20260804.0651", developmentTag(version, date));
  });

  should("reject invalid UTC clock components", () => {
    assert.throwsError(() => minuteOfDay(24, 0));
    assert.throwsError(() => minuteOfDay(0, 60));
  });
});
