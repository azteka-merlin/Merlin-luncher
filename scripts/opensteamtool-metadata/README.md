# OpenSteamTool metadata bootstrap

Ferramenta isolada para gerar arquivos TOML de `pattern` e `ipc` sem mexer no fluxo principal do Merlin.

Objetivo:

- gerar `pattern` automaticamente a partir das signatures conhecidas;
- calcular o `sha256` das DLLs e escrever os TOMLs no layout esperado;
- preparar um fluxo simples para `ipc`, usando dados confirmados no Ghidra/export manual.

## Estrutura

- `pattern-definitions.js`: signatures conhecidas de `steamclient64.dll` e `steamui.dll`
- `ipc-definitions.js`: interfaces e `argc` fixos das 6 chamadas usadas pelo Merlin
- `ghidra-ipc.example.json`: exemplo do formato de entrada para gerar o TOML IPC
- `cli.js`: comando principal

## Comandos

Calcular hashes:

```bash
npm run metadata:opensteamtool -- hash --steamclient "C:\\Program Files (x86)\\Steam\\steamclient64.dll" --steamui "C:\\Program Files (x86)\\Steam\\steamui.dll"
```

Gerar TOMLs de `pattern`:

```bash
npm run metadata:opensteamtool -- pattern --steamclient "C:\\Program Files (x86)\\Steam\\steamclient64.dll" --steamui "C:\\Program Files (x86)\\Steam\\steamui.dll"
```

Gerar TOML de `ipc` a partir de um JSON preenchido com os valores confirmados:

```bash
npm run metadata:opensteamtool -- ipc --steamclient "C:\\Program Files (x86)\\Steam\\steamclient64.dll" --input "scripts\\opensteamtool-metadata\\ghidra-ipc.example.json"
```

## Saída

Por padrão, os arquivos são gerados em:

```txt
tmp/opensteamtool-metadata/
```

Com layout:

```txt
tmp/opensteamtool-metadata/
  pattern/
    steamclient/<sha256>.toml
    steamui/<sha256>.toml
  ipc/
    steamclient/<sha256>.toml
```

## Observações importantes

- `pattern` já sai pronto porque as signatures são conhecidas e o script escaneia a DLL local.
- `ipc` ainda depende de valores confirmados do Ghidra, especialmente:
  - `vtable_rva`
  - `method_index`
  - `funcHash`
  - `wrapper_rva`
  - `fencepost`
- `interface_id` e `argc` já são preenchidos automaticamente com base no schema atual do OpenSteamTool.
