<h1 align="center">suda</h1>

<p align="center">
  zen/arc style command bar and keyboard driven browser navigation inspired by the helix editor.
</p>

<p align="center">
  <img src="icons/icon1024.png" width="192" alt="suda icon">
</p>

<details open>
<summary><strong>overview</strong></summary>

`suda` is an opinionated vimium fork inspired by the helix philosophy.

- helix-style bindings enabled by default
- keyboard-driven links, tabs, history, bookmarks and search
- a zen/arc browser style command bar

<img width="1600" height="1045" alt="image" src="https://github.com/user-attachments/assets/5da89cb4-33aa-43a2-b31e-d18623404e60" />

</details>

<details open>
<summary><strong>installation</strong></summary>

1. download `suda.zip` from the [latest release](https://github.com/u-k-g/suda/releases/latest)
2. unzip it
3. open `chrome://extensions`
4. enable **developer mode**
5. select **load unpacked**
6. choose the extracted `suda` directory

> **Enable keyboard-driven navigation:** click the Suda icon in the browser toolbar, open
> **Options**, then turn off **Command bar only**. This enables Suda's normal, insert, link-hint,
> and other page modes.

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

- install [Deno](https://deno.com/) and [just](https://just.systems/)
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
