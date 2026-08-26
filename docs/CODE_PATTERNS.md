# Code Patterns - Merlin Launcher

## Estilo Geral

- CommonJS (`require`/`module.exports`).
- Servicos criados por factory functions, por exemplo `createPremiumService`.
- Dependencias externas sao injetadas nos servicos quando possivel.
- Retornos de dominio usam objetos simples com `success`, `code`, `message` e dados.
- Erros externos sao normalizados para codigos conhecidos antes de chegar na UI.
- Renderer nao acessa Node direto; passa pelo preload.

## Factory Services

Padrao comum:

```js
function createService({ fs, path, axios, otherDependency }) {
  async function action() {
    return { success: true };
  }

  return { action };
}

module.exports = { createService };
```

Beneficios atuais:

- Testes conseguem injetar `fs`, `axios`, `path`, stores e servicos fake.
- Regras ficam isoladas por dominio.
- IPC so chama servicos; nao deveria concentrar regra complexa.

## IPC

Padrao:

- `src/main/ipc/register-*.js` registra handlers.
- `preload.js` expoe API segura para renderer.
- Renderer usa `window.electronAPI`.

Ao adicionar canal:

- Escolher nome com namespace quando for feature nova, exemplo `premium:*`.
- Evitar quebrar canais antigos sem migracao.
- Atualizar teste de contrato se a area tiver teste.
- Remover listeners no renderer quando o modulo possuir lifecycle.

## Network

- `axios` e usado para HTTP.
- `createApiAgent` customiza DNS/HTTPS agent.
- `archive-client` trata requests de arquivos e retry/unauthorized.
- `download-manager` gerencia progresso, cancelamento, temp file e resultado.

Ao adicionar endpoint:

- Preferir receber URL/config no construtor do client.
- Nao hardcodar producao em servico novo se puder derivar de uma base.
- Preservar headers atuais como `Authorization`, `Accept`, `Content-Type` e `User-Agent`.
- Tratar 401 com `authSession.handleUnauthorized()` quando a feature ja segue esse padrao.

## Stores E Cache

- Stores ficam em `src/main/*/*-store.js`.
- Catalogos usam cache persistido no `userData`.
- Quando API falha, algumas features usam fallback stale.
- Retornos de listagem costumam clonar objetos para evitar mutacao acidental.

## File Safety

Pontos importantes:

- Usar `path.resolve` e checar se destino fica dentro da raiz esperada.
- Bloquear archive path traversal.
- Validar ZIP/RAR antes de aplicar.
- Limpar temporarios em `finally`.
- Nao relaxar checks de destino em Premium/Corrections.

## Tests

`npm test` usa `node --test`.

Padroes de teste:

- Services testados com dependencias fake.
- IPC contracts garantem canais registrados.
- Tests de catalog/client validam normalizacao de payload.
- Tests de Steam/DLL validam arquivos obrigatorios.

Ao mudar comportamento:

- Adicionar teste no nivel do service quando a regra for de dominio.
- Adicionar/ajustar contract test quando mudar IPC.
- Evitar depender de Steam real ou API real nos testes.

## Build Scripts

- `npm start`: abre Electron em dev.
- `npm run doctor`: diagnostico local.
- `npm run build:opensteamtool`: compila DLLs nativas.
- `npm run build`: build nativo + package Electron.
- `npm run release:local`: doctor de build + tests + build.

`package-lock.json` e ignorado neste projeto por decisao do dono do projeto.
