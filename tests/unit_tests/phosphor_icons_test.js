import "./test_helper.js";
import { icon } from "../../lib/phosphor_icons.js";

context("Phosphor icons", () => {
  should("use bold variants for command-bar action icons", () => {
    const boldIcons = ["arrow-right", "magnifying-glass", "command", "link", "pencil-simple"];
    assert.isTrue(
      boldIcons.every((name) => icon(name).includes('data-phosphor-weight="bold"')),
    );
  });

  should("retain fill variants for the other command-bar icons", () => {
    const fillIcons = ["clock-counter-clockwise", "folder-open", "globe", "map-pin", "tabs"];
    assert.isTrue(
      fillIcons.every((name) => icon(name).includes('data-phosphor-weight="fill"')),
    );
  });
});
