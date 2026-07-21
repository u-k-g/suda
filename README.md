<h1 align="center">suda</h1>

<p align="center">
  keyboard driven browser navigation inspired by the helix editor.
</p>

<p align="center">
  <img src="icons/icon1024.png" width="192" alt="suda icon">
</p>

<details open>
<summary><strong>overview</strong></summary>

`suda` is an opinionated vimium fork inspired by the helix philosophy.

- helix-style bindings enabled by default
- keyboard-driven links, tabs, history, bookmarks and search
- an Arc Browser-inspired command bar and configurable key mappings
- Arc Dark interface styling by default, with a broad selection of optional themes

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
- `J` / `K` scroll down / up quickly
- `gg` / `ge` go to the top / bottom of the page
- `gh` / `gl` go to the left / right edge of the page
- `ctrl-d` / `ctrl-u` scroll half a page down / up
- `ctrl-o` / `ctrl-i` go backward / forward in browser history
- `gn` / `gp` go to the next / previous tab
- `v` enters select mode and `x` selects the current line
- `space f` selects one or more links; press `enter` to choose an action
- `space t` opens the all-mode command bar
- `space b` opens the tab picker
- `space B` opens the bookmark picker
- `space /` opens find mode; `n` / `N` move through matches
- `space m` creates a mark and `space '` opens the mark picker
- `:` opens the command-bar mode selector
- `ctrl-w q` / `ctrl-w u` close / restore a tab
- `ctrl-w n` opens search mode in a new tab
- `cmd-t` (`ctrl-t` elsewhere) opens all mode in the current tab; protected browser pages use a
  temporary Suda tab which is replaced by the selected result

</details>

<details>
<summary><strong>configuration</strong></summary>

open Suda's options to switch binding profiles and themes, define custom key mappings, and configure
search engines, exclusions, link hints and optional new-tab behavior.

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
