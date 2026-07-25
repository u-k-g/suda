import "./test_helper.js";
import {
  bumpVersion,
  findLatestVersion,
  formatVersion,
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

  should("find the highest stable version tag", () => {
    const latest = findLatestVersion(
      ["not-a-version", "v2.9.9", "2.10.0", "v2.10.0-beta.1", "v1.20.0"],
      "1.0.0",
    );
    assert.equal("2.10.0", formatVersion(latest));
  });

  should("fall back to the manifest version when there are no version tags", () => {
    assert.equal("2.4.2", formatVersion(findLatestVersion([], "2.4.2")));
  });

  should("bump versions using semantic-version reset rules", () => {
    const version = parseStableVersion("2.4.9");
    assert.equal("2.4.10", formatVersion(bumpVersion(version, "patch")));
    assert.equal("2.5.0", formatVersion(bumpVersion(version, "minor")));
    assert.equal("3.0.0", formatVersion(bumpVersion(version, "major")));
  });
});
