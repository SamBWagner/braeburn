# braeburn

[![npm](https://img.shields.io/npm/v/braeburn)](https://www.npmjs.com/package/braeburn)

A macOS system updater CLI. Keeps tools installed via Homebrew, npm, pip, .NET, and others up to date.

## Install

```sh
npm install -g braeburn
```

## Usage

```sh
braeburn              # run all enabled steps interactively
braeburn -y           # run all steps, auto-accept everything
braeburn homebrew npm # run specific steps only
```

## Commands

| Command | Description |
|---|---|
| `braeburn [steps...] [-y]` | Run update steps (default) |
| `braeburn log [step]` | View the latest output log for a step |
| `braeburn config` | View current configuration |
| `braeburn config update --no-<step>` | Disable a step |
| `braeburn config update --<step>` | Re-enable a step |

## Steps

Steps run in two stages. The runtime stage runs first and is **off by default** — upgrading a runtime is a larger change than upgrading a tool, and is best done intentionally.

| Step | Stage | Default | Requires |
|---|---|---|---|
| `pyenv` | runtime | off | `pyenv` or Homebrew |
| `nvm` | runtime | off | `~/.nvm` |
| `homebrew` | tools | on | `brew` (required) |
| `mas` | tools | on | `mas` |
| `ohmyzsh` | tools | on | `~/.oh-my-zsh` |
| `npm` | tools | on | `npm` |
| `pip` | tools | on | `pip3` |
| `dotnet` | tools | on | `dotnet` |
| `macos` | tools | on | — |
| `cleanup` | tools | on | `brew` |

## Requirements

- macOS
- Node.js ≥ 24
- [Homebrew](https://brew.sh) (required)
