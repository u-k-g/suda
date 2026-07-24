// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import * as testHelper from "./test_helper.js";
import "../../tests/unit_tests/test_chrome_stubs.js";
import "../../background_scripts/completion/completers.js";
import { allCommands } from "../../background_scripts/all_commands.js";
import { HelpDialogPage } from "../../pages/help_dialog_page.js";

context("help dialog", () => {
  setup(async () => {
    await testHelper.jsdomStub("pages/help_dialog_page.html");
    await Settings.onLoaded();
    stub(chrome.storage.session, "get", async (key) => {
      if (key == "commandToOptionsToKeys") {
        const data = {
          "reload": {
            "": ["a"],
          },
          "hardReload": {
            "": ["b"],
          },
        };
        return { commandToOptionsToKeys: data };
      }
    });
  });

  should("list reload and hard reload as separate commands", () => {
    const config = {
      "reload": {
        "": ["a"],
      },
      "hardReload": {
        "": ["b", "c"],
      },
    };
    const result = HelpDialogPage.getRowsForDialog(config);
    const rows = result["navigation"].filter((row) =>
      ["reload", "hardReload"].includes(row[0].name)
    );
    assert.equal(2, rows.length);
    assert.equal(["reload", "", ["a"]], [rows[0][0].name, rows[0][1], rows[0][2]]);
    assert.equal(
      ["hardReload", "", ["b", "c"]],
      [rows[1][0].name, rows[1][1], rows[1][2]],
    );
  });

  should("have a section in the help dialog for every group", async () => {
    // This test is to prevent code editing errors, where a command is added but doesn't have a
    // corresponding group in the help dialog.
    HelpDialogPage.init();
    await HelpDialogPage.show();
    const groups = Array.from(new Set(allCommands.map((c) => c.group))).sort();
    const groupsInDialog = Array.from(
      HelpDialogPage.dialogElement.querySelectorAll("div[data-group]"),
    )
      .map((e) => e.dataset.group)
      .sort();
    assert.equal(groups, groupsInDialog);
  });
});
