import "./test_helper.js";
import "../../lib/url_utils.js";
import "../../background_scripts/tab_recency.js";
import * as bgUtils from "../../background_scripts/bg_utils.js";

context("runTabOperation", () => {
  should("ignore a missing-tab error from a rejected browser promise", async () => {
    const result = await bgUtils.runTabOperation(() =>
      Promise.reject(new Error("No tab with id: 1648448729."))
    );
    assert.equal(undefined, result);
  });

  should("ignore a synchronously thrown missing-tab error", async () => {
    const result = await bgUtils.runTabOperation(() => {
      throw new Error("No tab with id: 1648448729.");
    });
    assert.equal(undefined, result);
  });

  should("preserve unexpected browser errors", async () => {
    let caughtError = null;
    try {
      await bgUtils.runTabOperation(() => Promise.reject(new Error("Unexpected failure")));
    } catch (error) {
      caughtError = error;
    }
    assert.equal("Unexpected failure", caughtError?.message);
  });
});
