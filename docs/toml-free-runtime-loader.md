# TOML-Free Runtime Loader

This branch removes Merlin's runtime dependency on Steam-derived `.toml` metadata files.

## What changed

Merlin previously depended on generated metadata files to resolve:

- pattern signatures used to hook Steam modules
- IPC metadata used to locate Steam client methods

That dependency created maintenance overhead because the metadata had to be regenerated whenever Steam updated its binaries.

This branch replaces that runtime dependency with direct inspection of the local Steam installation:

- `PatternLoader` now derives hook patterns from the live `steamclient64.dll` and `steamui.dll`
- `IPCLoader` now derives IPC metadata directly from the local `steamclient64.dll`

As a result, Merlin no longer needs the generated `.toml` files at runtime for those two loader paths.

## Goals of the refactor

- remove the need to regenerate `.toml` files after routine Steam updates
- keep pattern and IPC resolution local to the machine
- reduce packaging complexity by removing the old helper-based fallback path
- preserve existing Merlin behavior outside TOML-dependent code paths

## Removed runtime pieces

The branch also removes the old runtime path that existed to support TOML-based metadata loading:

- `MerlinHelper`
- `MerlinLocalFallback`
- `RemoteToml`
- installer and dist references to `merlin-helper.dll`

These pieces are not required anymore for the pattern/IPCLoader bootstrap used by Merlin on this branch.

## What did not change

This refactor is intentionally narrow.

It does not change:

- Merlin's higher-level library management behavior
- the Lua-based game configuration model
- the manifest request-code flow used by `ManifestClient`
- unrelated ownership, ticket, or package hooks

## Current behavior summary

At startup, Merlin now:

1. loads the local Steam binaries from the Steam installation
2. scans those binaries to derive pattern metadata
3. derives IPC metadata from the local Steam client
4. loads Lua configuration from `Steam\config\stplug-in`
5. continues with the normal hook initialization flow

## Why this matters

The main win is resilience.

Merlin no longer relies on an external metadata-generation step for the two most update-sensitive loader paths. That makes the loader more self-contained and much easier to keep working across Steam updates.
