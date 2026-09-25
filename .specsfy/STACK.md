# Stack do sistema

Documente tecnologias estruturais e a evidência executável que confirma cada
uma. Preserve decisões humanas nas seções livres deste arquivo.

## Inventário detectado

<!-- specsfy:stack:start -->
| Camada | Tecnologia | Evidência |
| --- | --- | --- |
| Runtime | Node.js | `package.json` |
| Infraestrutura | Containers | arquivo Compose |
| API | Express + Socket.IO | `package.json` |
| WhatsApp | Baileys `7.0.0-rc14` (pin exato) | `package.json` |
| Persistência | SQLite via better-sqlite3 | `package.json`, `db/` |
| Agendamento | node-cron | `package.json` |
| Testes e qualidade | Jest + ESLint (devDependencies) | `package.json` |
| Deploy | Docker Swarm | `Dockerfile`, `.github/workflows/deploy.yml` |
<!-- specsfy:stack:end -->

## Decisões e observações do projeto

- Pin exato do Baileys em `7.0.0-rc14` (sem `^`): migração para o protocolo LID
  do WhatsApp exigiu a linha 7.x (6.x não resolve PN→LID e não suporta retry
  via `getMessage`); `rc` é canal pré-release, manter pin até estabilizar.
