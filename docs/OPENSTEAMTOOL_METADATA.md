# OpenSteamTool metadata bootstrap

Ferramenta isolada para gerar arquivos TOML de `pattern` e `ipc` sem mexer no fluxo principal do Merlin.

## Objetivo

- gerar `pattern` automaticamente a partir das signatures conhecidas;
- calcular o `sha256` das DLLs e escrever os TOMLs no layout esperado;
- preparar um fluxo simples para `ipc`, usando dados confirmados no Ghidra/export manual.

## Estrutura

- `scripts/opensteamtool-metadata/pattern-definitions.js`: signatures conhecidas de `steamclient64.dll` e `steamui.dll`.
- `scripts/opensteamtool-metadata/ipc-definitions.js`: interfaces e `argc` fixos das seis chamadas usadas pelo Merlin.
- `scripts/opensteamtool-metadata/ghidra-ipc.example.json`: exemplo do formato de entrada para gerar o TOML IPC.
- `scripts/opensteamtool-metadata/cli.js`: comando principal.

## Comandos

Calcular hashes:

```bash
npm run metadata:opensteamtool -- hash --steamclient "C:\\Program Files (x86)\\Steam\\steamclient64.dll" --steamui "C:\\Program Files (x86)\\Steam\\steamui.dll"
```

Gerar TOMLs de `pattern`:

```bash
npm run metadata:opensteamtool -- pattern --steamclient "C:\\Program Files (x86)\\Steam\\steamclient64.dll" --steamui "C:\\Program Files (x86)\\Steam\\steamui.dll"
```

Gerar TOML de `ipc` a partir de um JSON preenchido com valores confirmados:

```bash
npm run metadata:opensteamtool -- ipc --steamclient "C:\\Program Files (x86)\\Steam\\steamclient64.dll" --input "scripts\\opensteamtool-metadata\\ghidra-ipc.example.json"
```

## Saida

Por padrao, os arquivos sao gerados em `tmp/opensteamtool-metadata/`, com subpastas `pattern/steamclient`, `pattern/steamui` e `ipc/`.

## Observacoes

- `pattern` sai pronto porque as signatures sao conhecidas e o script escaneia a DLL local.
- `ipc` ainda depende de valores confirmados do Ghidra, especialmente `vtable_rva`, `method_index`, `funcHash`, `wrapper_rva` e `fencepost`.
- `interface_id` e `argc` sao preenchidos automaticamente com base no schema atual do OpenSteamTool.
