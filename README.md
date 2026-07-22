# Client Manager

Sistema de gestão de clientes com integração a mensageria para notificações automáticas de vencimento.

## Funcionalidades

- **Clientes**: cadastro completo (nome, telefone, servidor, plano, valor, vencimento, status)
- **Servidores**: cadastro dos servidores utilizados pelos clientes
- **Planos**: gerenciamento de planos com preços e duração
- **Dashboard**: clientes ativos, receita mensal recorrente, ranking de servidores, próximos vencimentos, projeções
- **WhatsApp**: conexão via QR code (biblioteca Baileys — gratuita)
- **Avisos automáticos**: verificação diária de vencimentos e envio de mensagens personalizadas
- **Fila de mensagens**: processamento assíncrono com prioridade
- **Relatórios**: vendas do mês, balanço líquido, ticket médio

## Como rodar

```bash
npm install
npm start
```

Depois abra **http://localhost:3400** no navegador.

## Configuração

Copie `.env.example` para `.env` e configure:

```bash
cp .env.example .env
```

Variáveis disponíveis:
- `PORT` — porta do servidor (padrão: 3400)
- `HOST` — endereço de escuta (padrão: 0.0.0.0)
- `JWT_SECRET` — chave secreta para tokens JWT
- `ADMIN_USER` — usuário administrador (padrão: admin)
- `ADMIN_PASS` — senha do administrador (padrão: admin123)
- `CORS_ORIGIN` — origem permitida para CORS

## Conectar o WhatsApp

1. Vá na aba **WhatsApp**
2. Clique em **Conectar**
3. Escaneie o QR code com o WhatsApp do celular
4. O status muda para "Conectado" e fica salvo

## Configurar os avisos

Na aba WhatsApp, em "Configuração de aviso":
- Defina quantos dias antes do vencimento o aviso deve ser enviado
- Edite o modelo da mensagem usando as variáveis: `{nome}`, `{servidor}`, `{dias}`, `{vencimento}`

## Estrutura do projeto

```
├── server.js              → Entrypoint do servidor Express + Socket.io
├── db/
│   ├── connection.js      → Conexão SQLite
│   ├── migrations.js      → Migrações do banco
│   ├── seed.js            → Dados iniciais
│   └── schema.sql         → Schema do banco
├── lib/
│   ├── dateHelpers.js     → Utilitários de data
│   ├── errors.js          → Classes de erro padronizadas
│   └── validators.js      → Validações de entrada
├── routes/                → Endpoints da API
├── services/              → Serviços (WhatsApp, fila de mensagens, agendador)
├── middleware/             → Middleware de autenticação
├── public/                → Frontend (HTML/CSS/JS puro)
└── data/                  → Banco SQLite + sessão WhatsApp (não versionar)
```

## Banco de dados

SQLite local em `data/iptv-crm.db` — sem necessidade de servidor externo.

> **Nota:** O nome do arquivo do banco de dados foi mantido por compatibilidade.

## Licença

MIT
