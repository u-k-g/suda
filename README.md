<h1 align="center">suda</h1>

<p align="center">
  an opinionated, keyboard first browser extension inspired by the helix editor.
</p>

<details open>
<summary><strong>overview</strong></summary>

`suda` is an opinionated, keyboard-first browser extension for fast navigation and control of the
web. it favors a compact workflow inspired by the helix editor.

- helix-style bindings enabled by default
- keyboard-driven links, tabs, history, bookmarks and search
- an Arc Browser-inspired command bar and configurable key mappings
- Arc Dark interface styling by default, with a broad selection of optional themes

<p align="center">
  <img src="icons/icon1024.png" width="192" alt="suda icon">
</p>

</details>

<details open>
<summary><strong>installation</strong></summary>

1. install [deno](https://deno.com/) and [just](https://just.systems/)
2. run `just build`
3. open `chrome://extensions`
4. enable **developer mode**
5. select **load unpacked**
6. choose `dist/suda`

</details>

<details open>
<summary><strong>key bindings</strong></summary>

- `h` `j` `k` `l` scroll the viewport
- `gg` / `ge` go to the top / bottom of the page
- `gh` / `gl` go to the left / right edge of the page
- `ctrl-d` / `ctrl-u` scroll half a page down / up
- `ctrl-o` / `ctrl-i` go backward / forward in browser history
- `gn` / `gp` go to the next / previous tab
- `v` enters select mode and `x` selects the current line
- `space f` / `space F` open a link in this / a new tab
- `space b` opens the tab picker
- `space /` opens a URL, bookmark, history entry or search
- `space h` shows all active bindings
- `:` opens the command palette
- `ctrl-w q` / `ctrl-w u` close / restore a tab

</details>

<details>
<summary><strong>configuration</strong></summary>

open Suda's options from `chrome://extensions` to switch binding profiles, define custom key
mappings, configure search engines, exclusions, link hints and new-tab behavior.

custom mappings are layered over the selected profile. each line accepts `map key command`,
`unmap key` or `unmapAll`.

</details>

<details>
<summary><strong>upstream</strong></summary>

Suda is an independent, opinionated fork of [Vimium](https://github.com/philc/vimium). it is not
part of the Vimium project.

the fork lightly follows the philosophy of the [helix editor](https://helix-editor.com/) and its
`hx` workflow: selections are central, commands compose around them and keyboard interaction should
stay direct and predictable.

</details>

<details>
<summary><strong>development</strong></summary>

- `just build` builds the unpacked extension in `dist/suda`
- `just test` runs the unit and dom test suites
- `just check` type-checks the source
- `just lint` runs the linter
- `just fmt` formats the repository

</details>

<details>
<summary><strong>license</strong></summary>

Suda retains the upstream MIT license and copyright notice. see [MIT-LICENSE.txt](MIT-LICENSE.txt).

</details>
