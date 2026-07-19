// @ts-nocheck -- staged conversion of legacy dynamic JavaScript patterns.
import "../pages/all_content_scripts.js";
import "../pages/command_bar_page.js";

function setup() {
  CommandBar.activate(0, {});
}

document.addEventListener("DOMContentLoaded", setup, false);
