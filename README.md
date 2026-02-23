# braeburn

[![npm](https://img.shields.io/npm/v/braeburn)](https://www.npmjs.com/package/braeburn)

A macOS system updater CLI. Runs update steps for Homebrew, Mac App Store, Oh My Zsh, npm, pip, pyenv, nvm, .NET, and macOS itself.

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

`homebrew` `mas` `ohmyzsh` `npm` `pip` `pyenv` `nvm` `dotnet` `macos` `cleanup`

## Requirements

- macOS
- Node.js ≥ 24
- [Homebrew](https://brew.sh) (required)
