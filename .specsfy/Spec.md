# Contrato central do framework Specsfy

Este arquivo contém as regras gerais carregadas por `AGENTS.md` e `CLAUDE.md`
nos projetos consumidores. Ele não é uma especificação de feature e não
substitui `specs/<estado>/<NNNN>-<slug>/spec.md`.

## Estrutura canônica

```text
specs/
├── inbox/
│   └── <AAAA-MM-DD-HHMMSS>-<slug>.md
├── backlog/
│   └── <NNNN>-<slug>.md
├── draft/
├── defined/
├── planned/
├── in-progress/
├── review/
└── completed/
    └── <NNNN>-<slug>/
        ├── spec.md
        └── research/
```

- `specs/inbox/` preserva inputs imediatamente, sem perguntas nem promoção.
- `specs/backlog/` organiza ideias escolhidas para refinamento.
- `specs/<estado>/<NNNN>-<slug>/spec.md` é a única fonte normativa de uma
  fatia. Ela existe em uma única pasta de estado.
- `research/` armazena apenas evidência consultada e indexada pela spec.
- O cabeçalho de `spec.md` é uma tabela Markdown de duas colunas, `Campo` e
  `Valor`; cada metadado ocupa uma linha da tabela.
- Não criar `plan.md`, `tasks.md`, `research.md`, `data-model.md` ou uma fonte
  normativa paralela.

## Estado, Effort e transição

O ciclo físico e o campo `Status` seguem a mesma ordem:

```text
draft → defined → planned → in-progress → review → completed
Draft → Defined → Planned → Implementing → Reviewing → Complete
```

Use `specsfy transition <id> <pasta>` para transições adjacentes. O comando
move todo o pacote e atualiza `Status`. Use `specsfy migrate` uma única vez
para mover o layout anterior `specs/specs/` para as pastas atuais.

Toda spec tem `Effort` de 1 a 10, `Effort updated at` e `Effort rationale` no
metadado. A pontuação estima a capacidade de raciocínio e execução necessária,
não prazo: 1–2 usa perfil `light`, 3–6 `standard`, 7–8 `high` e 9–10
`maximum`. Atualize-a com `specsfy effort <id> <1-10> --reason "<motivo>"`
sempre que a descoberta, o plano ou a execução trouxer informação material.

`ClickUp Task` pode vincular a spec a uma tarefa externa. Quando houver skills
`clickupfy-*` instaladas, a skill responsável delega a sincronização da pasta e
do Effort. O estado local continua canônico quando a integração estiver ausente
ou pendente.

## Contexto persistente do projeto

- `PROJECT.md`, na raiz, mantém a história, a finalidade, as capacidades e os
  limites gerais do projeto.
- `.specsfy/STACK.md` mantém tecnologias estruturais e suas evidências.
- `.specsfy/RULES.md` mantém regras explícitas confirmadas pela pessoa
  responsável.
- `.specsfy/DATABASE.md` mantém o quadro tabular completo de persistência.
- `.specsfy/PACKAGES.md` mantém o inventário npm e Composer derivado dos
  manifests, lockfiles e metadados locais, com uma finalidade curta por pacote.
- Executar `$specsfy-setup` no início e sempre que for necessário reconciliar
  os quatro contextos iniciais ou os blocos reservados em `AGENTS.md` e
  `CLAUDE.md`. Executar `$specsfy-documentator` quando `PACKAGES.md` estiver
  ausente ou desatualizado.
- Executar `$specsfy-aux-stack` após mudanças estruturais de tecnologia,
  `$specsfy-aux-rules` para regras confirmadas e `$specsfy-aux-database` sempre
  que banco, schema, tabela, campo, relação ou migration mudar.
- Executar
  `.agents/skills/specsfy-setup/scripts/monitor_context.mjs --project . --check`
  no início, após cada tarefa de implementação e antes do Delivery Gate.
- Executar `$specsfy-documentator` depois de cada tarefa de implementação e
  sempre que o usuário pedir uma reconstrução técnica. A skill lê todo o
  projeto e mantém a projeção completa em `docs/` e `.specsfy/PACKAGES.md`,
  sem depender de uma spec.
- Não concluir uma tarefa enquanto o monitor exigir `STACK.md` ou `DATABASE.md`.
  Toda mudança de aplicação revisa `PROJECT.md`; quando não houver impacto
  material, registrar a justificativa na evidência da tarefa antes do
  reconhecimento explícito.
- Preservar conteúdo humano existente. Os blocos delimitados por
  `specsfy:*:start` e `specsfy:*:end` pertencem ao framework; conteúdo fora
  deles pertence ao projeto.

## Fluxo

```text
input → inbox → backlog → spec → validate → tasks → TDD/BDD → implement → documentator → progress
                                      ↑ update-spec ← mudança tardia
```

1. Use `specsfy-01-inbox` para preservar e pré-processar o texto em
   `specs/inbox/`, sem fazer perguntas.
2. Use `specsfy-02-backlog` para buscar material relacionado, registrar o item
   e aprofundar decisões por perguntas adaptativas. O refinamento reavalia cada
   resposta enquanto houver lacuna aplicável.
3. Use `specsfy-03-specify` para criar e consolidar a spec normativa inicial.
4. Use `specsfy-04-validate` para comprovar a definição.
5. Use `specsfy-05-tasks` e `specsfy-06-tdd-bdd` para planejar, derivar
   testes TDD do BDD de referência e observar RED válido.
6. Use `specsfy-07-implement` para entregar em RED → GREEN → REFACTOR.
7. Use `specsfy-update-spec` quando a pessoa quiser adicionar, remover,
   corrigir ou mudar algo depois de a spec já ter sido definida. A skill
   incorpora o pedido na fonte normativa e reabre somente os atos afetados.
8. Use `specsfy-documentator` para reconstruir `docs/` e
   `.specsfy/PACKAGES.md` a partir do sistema existente após cada implementação
   ou por acionamento livre.
9. Use `specsfy-progress` somente para projetar o estado existente.
10. Use `specsfy-interviewer` para conversar com a spec nas fases `draft`,
    `defined`, `planned`, `in-progress` e `review`, antes da próxima skill.
11. Use `specsfy-mvp-milestone-interviewer` para definir o MVP por estados
    demonstráveis e `specsfy-roadmap-milestone-interviewer` para evolução após
    o MVP aceito. Use `specsfy-milestone-governor` para manter relações e a
    projeção `specs.md` sem substituir conteúdo humano.

Um backlog não autoriza implementação nem cria uma segunda fonte normativa. A
promoção para spec exige intenção explícita do usuário.

## Contrato de perguntas numeradas

Toda skill que formular perguntas usa este contrato desde a primeira rodada,
inclusive para escolher arquivo, runner, autorização, confirmação ou próximo
passo.

1. Apresente pelo menos três perguntas numeradas por rodada, com os rótulos
   `Pergunta 1`, `Pergunta 2`, `Pergunta 3` e assim por diante.
2. Abaixo de cada pergunta, ofereça pelo menos três opções numeradas e
   específicas para o assunto apresentado.
3. Depois das opções sugeridas, acrescente como itens numerados
   `Escrever outra resposta` e `Avançar`.
4. Mantenha `Avançar` disponível desde a primeira rodada. Na rodada seguinte,
   pergunte se a pessoa quer encerrar definitivamente as perguntas daquela
   área, responder depois ou voltar a responder agora. Inclua essa confirmação
   entre as três perguntas numeradas da rodada.
5. Aceite respostas no formato `1.2`, `2. Escrever: <texto>` ou equivalente e
   releia todas as respostas antes da rodada seguinte.
6. Se a pessoa encerrar a área, registre
   `Área encerrada pelo usuário: <área>` no artefato aplicável e não volte ao
   assunto, salvo se ela o reabrir explicitamente. Se escolher responder
   depois, registre `Área adiada pelo usuário: <área>` e preserve os pontos
   abertos para retomada.
7. Encerrar ou adiar não autoriza preencher conteúdo por inferência nem aprovar
   um gate incompleto.
8. Se restarem menos de três lacunas, complete a rodada com perguntas de
   confirmação da síntese, do registro e do próximo passo. Não invente outro
   assunto apenas para aumentar a quantidade.
9. Não use opções sem número, letras, bullets soltos ou uma pergunta isolada.

Use este formato mínimo:

```text
Pergunta 1. <pergunta>
1. <opção sugerida>
2. <opção sugerida>
3. <opção sugerida>
4. Escrever outra resposta
5. Avançar

Pergunta 2. <pergunta>
1. <opção sugerida>
2. <opção sugerida>
3. <opção sugerida>
4. Escrever outra resposta
5. Avançar

Pergunta 3. <pergunta>
1. <opção sugerida>
2. <opção sugerida>
3. <opção sugerida>
4. Escrever outra resposta
5. Avançar
```

## Orquestração conversacional

Trate o fluxo como uma conversa contínua, não como uma lista de comandos que a
pessoa precisa copiar. Ao concluir uma responsabilidade ou encontrar uma
pendência pertencente a outra etapa:

1. releia backlog, spec, gates, tarefas e evidências aplicáveis para escolher a
   skill responsável pelo estado observado;
2. se a pendência couber na skill atual, avise
   `Pendência detectada: <descrição> — ação: resolvendo nesta etapa` e
   resolva-a imediatamente no próprio escopo;
3. se exigir outra skill, avise
   `Transição automática: $<origem> → $<destino> — motivo: <motivo> —
   resultado esperado: <resultado>`;
4. carregue imediatamente a skill de destino, sem pedir confirmação; não peça
   que a pessoa repita o comando;
5. continue na mesma conversa, preservando contexto, artefatos e decisões;
6. quando a skill de destino resolver uma pendência necessária à etapa de
   origem, avise
   `Retomada automática: $<destino> → $<origem> — pendência resolvida: <resultado>`
   e carregue imediatamente a skill de origem.

Aplique o mesmo protocolo a avanço ou retorno. Mudança surgida depois da
definição retorna para `$specsfy-update-spec`, que chama
`$specsfy-02-backlog` quando faltar decisão, `$specsfy-04-validate` após
mudança de comportamento e `$specsfy-05-tasks` após mudança somente de plano.
Teste ou RED ausente chama
`$specsfy-06-tdd-bdd` quando `Plan Gate` estiver `Pending`; se o Plan Gate já
estiver `Passed`, retorne primeiro para `$specsfy-05-tasks`, que reabre o Ato
II e chama TDD/BDD automaticamente. Depois de uma correção, retome
automaticamente a etapa que a detectou.

Não peça confirmação para o handoff. Se faltar uma decisão material que somente
a pessoa pode fornecer, carregue `$specsfy-02-backlog`. O refinamento do backlog
reanalisa o contexto acumulado e as novas respostas antes de cada rodada e
continua sem limite máximo de rodadas enquanto existir lacuna aplicável.
`Avançar` permanece disponível em cada pergunta desde a primeira rodada. Antes
de encerrar o ciclo atual, a rodada seguinte confirma se a pessoa encerra
definitivamente aquela área, responde depois ou volta a responder agora. A
primeira escolha fica registrada e impede novas perguntas sobre a área até uma
reabertura explícita. A segunda preserva as lacunas para retomada. Ambas mantêm
`Status: Draft` e `Definition Gate: Pending` quando houver pontos aplicáveis
em aberto. A etapa
chamadora não reabre o mesmo ciclo durante essa retomada. Isso não
transforma a escolha da próxima skill em decisão do usuário.
O handoff não autoriza ações destrutivas, publicação, deploy, instalação de
especialista ou outras mudanças externas: cada ação sensível continua exigindo
autorização específica. Carregue automaticamente um especialista já instalado;
se estiver ausente, anuncie a dependência antes de solicitar autorização para
instalá-lo. Nunca altere gates para contornar a etapa responsável. Após cada
handoff, reavalie o estado canônico; se origem, destino e pendência se repetirem
sem mudança observável, pare o ciclo e relate o impasse.

## Três atos e estado

- **Ato I — Definir:** intenção, requisitos e Gherkin; termina em
  `Definition Gate: Passed`.
- **Ato II — Projetar e provar:** tarefas, testes TDD informados pelo BDD e RED; termina em
  `Plan Gate: Passed`.
- **Ato III — Entregar e validar:** GREEN, regressão e evidência; termina em
  `Delivery Gate: Passed`.

Estado canônico:

```text
Draft → Defined → Planned → Implementing → Complete
```

Mudança de comportamento reabre os Atos I–III. Mudança apenas de plano reabre
os Atos II–III. Gate posterior não permanece aprovado sobre entrada invalidada.

## Disciplina de execução

- Preserve a formulação do usuário e diferencie declaração, inferência,
  hipótese, decisão, conflito e questão aberta.
- Centralize no refinamento do backlog as perguntas sobre decisões materiais e
  aplique o Contrato de perguntas numeradas em cada rodada.
- Não invente requisitos, stakeholders, restrições ou evidência.
- Mantenha o Gherkin BDD somente na `spec.md` como contrato de referência; não
  crie nem execute arquivos `.feature`.
- Defina no mínimo três `AC` distintos para a feature inteira e para cada
  `US`, `FR` e `NFR`; conte somente IDs declarados em `**Cobre**`.
- Use o BDD como contexto para criar os testes TDD executáveis e observe RED
  válido antes da implementação.
- Materialize no mínimo três casos TDD executáveis para a feature inteira e
  para cada `US`, `FR` e `NFR`. Cada caso declara seu próprio marcador
`SPECSFY:`; um marcador compartilhado é considerado como um caso.
- Em projeto PHP, execute os testes derivados com Pest. Em projeto Node sem PHP,
  pergunte qual runner de testes adotar e recomende Vitest; não instale nem
  escolha silenciosamente. Em projeto misto PHP + Node, prevalece Pest.
- Mantenha tarefas, checklists, gates e evidência na própria `spec.md`.
- Preserve alterações preexistentes e instruções locais do projeto.
- Instale especialistas somente sob demanda; eles orientam padrões técnicos e
  não substituem a fonte normativa.

## Arquivos gerenciados

O CLI instala skills em `.agents/skills/`, publica este contrato em
`.specsfy/Spec.md`, os templates gerenciados em `.specsfy/templates/` e o
exemplo não normativo em `.specsfy/examples/Spec.md`. A criação de um artefato
resolve seu template nesta ordem:

1. `.specsfy/templates/custom/<Nome>.md`, customização do usuário.
2. `.specsfy/templates/<Nome>.md`, cópia gerenciada pelo CLI.
3. `skills/templates/<Nome>.md`, fallback exclusivo do desenvolvimento deste
   repositório.

O CLI cria `.specsfy/templates/custom/`, mas não gerencia, atualiza nem remove
seu conteúdo, inclusive com `--force`. A criação de uma spec copia e renderiza
o template resolvido em `specs/<estado>/<NNNN>-<slug>/spec.md`; o exemplo existe
para inspeção, testes e compreensão da arquitetura, nunca como fonte de uma
feature.

O CLI também mantém blocos delimitados em `AGENTS.md` e `CLAUDE.md`. Conteúdo
fora desses blocos pertence ao usuário. Alterações locais em arquivos ou blocos
gerenciados não podem ser descartadas sem `--force`.
