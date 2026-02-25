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
| `braeburn config` | Show config subcommand help |
| `braeburn config list` | Print current configuration |
| `braeburn config update` | Open interactive configuration editor |
| `braeburn config update --no-<step>` | Disable a step |
| `braeburn config update --<step>` | Re-enable a step |

## Steps

Steps are grouped by system capability. For new setups, braeburn uses a conservative default profile: only package-manager-driven CLI/tooling updates are enabled by default.

| Step | Category | Default (new setup) | Requires |
|---|---|---|---|
| `pyenv` | Runtimes | off | `pyenv` or Homebrew |
| `nvm` | Runtimes | off | `~/.nvm` |
| `homebrew` | Apps & Packages | on | `brew` (required) |
| `mas` | Apps & Packages | off | `mas` |
| `macos` | Apps & Packages | off | — |
| `npm` | CLI Tools | on | `npm` |
| `braeburn` | CLI Tools | on | `npm` |
| `pip` | CLI Tools | on | `pip3` |
| `dotnet` | CLI Tools | on | `dotnet` |
| `ohmyzsh` | Shell | off | `~/.oh-my-zsh` |
| `cleanup` (`homebrew cleanup`) | Maintenance | off | `brew` |

## Requirements

- macOS
- Node.js ≥ 24
- [Homebrew](https://brew.sh) (required)
