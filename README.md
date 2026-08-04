<h1 align="center">suda</h1>

<p align="center">
  zen/arc style command bar and keyboard driven browser navigation from vimium.
</p>

<p align="center">
  <img src="icons/icon1024.png" width="192" alt="suda icon">
</p>

> **Origin and license:** Suda is an independent fork of [Vimium](https://github.com/philc/vimium)
> https://github.com/philc/vimium, originally created by Phil Crosby. The original copyright notice
> also credits Ilya Sukhar. Suda is not affiliated with or endorsed by the Vimium project. It is
> distributed under the MIT License, with Vimium's original copyright notice and license terms
> preserved in [MIT-LICENSE.txt](MIT-LICENSE.txt).

<details open>
<summary><strong>overview</strong></summary>

`suda` is an opinionated Vimium fork inspired by the Helix philosophy.

- helix-style bindings enabled by default
- keyboard-driven links, tabs, history, bookmarks and search
- a zen/arc browser style command bar

<img width="1600" height="1045" alt="image" src="https://github.com/user-attachments/assets/866001f3-efdf-446f-b602-247bc2e1b808" />

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

Suda is distributed under the MIT License. The original Vimium copyright notice and license terms
are preserved in [MIT-LICENSE.txt](MIT-LICENSE.txt), which is included in source and release builds.

</details>
