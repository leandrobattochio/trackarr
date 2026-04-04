# PRD: Tracker Stats Backend

## Introduction

Backend em .NET 10 com arquitetura hexagonal para gerenciar múltiplas integrações com trackers de torrent. Expõe uma API REST consumida por um frontend de dashboard, exibindo resumo de cada tracker (nome, ratio, upload, download). Trackers são integrados via sistema de plugins, onde cada plugin define como autenticar e como coletar dados. Um job em memória atualiza os dados de todos os trackers a cada hora.

---

## Goals

- Permitir que o usuário cadastre e gerencie múltiplas integrações de tracker
- Expor API REST para o frontend exibir nome, ratio, upload total e download total por tracker
- Suportar extensibilidade via plugins sem alterar o core do sistema
- Cada plugin define seu próprio modo de autenticação (usuário/senha ou cookie)
- Sincronizar dados de todos os trackers automaticamente a cada 1 hora via job em memória
- Persistir dados localmente com SQLite
- Rodável localmente via Docker Compose ou direto na máquina

---

## User Stories

### US-001: Definir contrato do plugin de tracker
**Description:** As a developer, I want a well-defined plugin interface so that any tracker can be integrated without changing the core system.

**Acceptance Criteria:**
- [ ] Existe uma interface `ITrackerPlugin` com:
  - `string PluginId` — identificador único do plugin (ex: `"gazelle"`, `"qbittorrent"`)
  - `string DisplayName` — nome legível para exibição
  - `AuthMode AuthMode` — enum: `UsernamePassword` | `Cookie`
  - `Task<TrackerStats> FetchStatsAsync(TrackerCredentials credentials, CancellationToken ct)` — coleta dados do tracker
- [ ] Existe um record/DTO `TrackerStats` com: `decimal Ratio`, `long UploadedBytes`, `long DownloadedBytes`
- [ ] Existe um record `TrackerCredentials` com: `string BaseUrl`, `string? Username`, `string? Password`, `string? Cookie`
- [ ] O enum `AuthMode` está definido com os valores `UsernamePassword` e `Cookie`
- [ ] Todos os tipos acima vivem na camada de domínio (sem dependências de infraestrutura)
- [ ] Typecheck/build passa

### US-002: Registro e descoberta de plugins
**Description:** As a developer, I want plugins to be registered via dependency injection so that the system discovers them automatically at startup.

**Acceptance Criteria:**
- [ ] Plugins são registrados no container de DI como `ITrackerPlugin`
- [ ] Existe um `ITrackerPluginRegistry` com método `ITrackerPlugin? GetById(string pluginId)`
- [ ] A implementação de `ITrackerPluginRegistry` resolve todos os `ITrackerPlugin` registrados no DI
- [ ] Ao chamar `GetById` com um `pluginId` inexistente, retorna `null`
- [ ] Existe pelo menos um `FakeTrackerPlugin` (stub) registrado para permitir testes end-to-end do fluxo completo
- [ ] Typecheck/build passa

### US-003: Listar plugins disponíveis via API
**Description:** As a frontend developer, I want to list available tracker plugins so that the user can choose which tracker to add.

**Acceptance Criteria:**
- [ ] `GET /api/plugins` retorna `200 OK` com array de objetos: `{ pluginId, displayName, authMode }`
- [ ] `authMode` é retornado como string: `"UsernamePassword"` ou `"Cookie"`
- [ ] A lista reflete exatamente os plugins registrados no DI
- [ ] Typecheck/build passa

### US-004: Adicionar integração de tracker
**Description:** As a user, I want to add a new tracker integration so that the system can start collecting my stats.

**Acceptance Criteria:**
- [ ] `POST /api/integrations` aceita body:
  ```json
  {
    "pluginId": "string",
    "name": "string",
    "baseUrl": "string",
    "username": "string | null",
    "password": "string | null",
    "cookie": "string | null"
  }
  ```
- [ ] Retorna `201 Created` com o objeto da integração criada (incluindo `id` gerado)
- [ ] Retorna `400 Bad Request` se `pluginId` não existir no registry
- [ ] Retorna `400 Bad Request` se campos obrigatórios para o `authMode` do plugin estiverem ausentes (ex: plugin `UsernamePassword` sem username/password)
- [ ] A integração é persistida no SQLite
- [ ] Typecheck/build passa

### US-005: Listar integrações cadastradas
**Description:** As a frontend developer, I want to list all integrations so that the dashboard can display each tracker's info.

**Acceptance Criteria:**
- [ ] `GET /api/integrations` retorna `200 OK` com array de objetos:
  ```json
  {
    "id": "guid",
    "pluginId": "string",
    "name": "string",
    "baseUrl": "string",
    "lastSyncAt": "datetime | null",
    "stats": {
      "ratio": "decimal | null",
      "uploadedBytes": "long | null",
      "downloadedBytes": "long | null"
    }
  }
  ```
- [ ] Credenciais (username, password, cookie) **não** são retornadas na listagem
- [ ] Integrações sem stats sincronizados ainda retornam com `stats: null`
- [ ] Typecheck/build passa

### US-006: Remover integração de tracker
**Description:** As a user, I want to remove a tracker integration so that it no longer appears in my dashboard.

**Acceptance Criteria:**
- [ ] `DELETE /api/integrations/{id}` retorna `204 No Content` em caso de sucesso
- [ ] Retorna `404 Not Found` se a integração não existir
- [ ] A integração e seus dados são removidos do SQLite
- [ ] Typecheck/build passa

### US-007: Sincronização manual de uma integração
**Description:** As a user, I want to trigger a sync for a specific tracker so that I can refresh its data on demand.

**Acceptance Criteria:**
- [ ] `POST /api/integrations/{id}/sync` dispara a coleta de dados para aquela integração
- [ ] Retorna `200 OK` com os stats atualizados após o sync
- [ ] Retorna `404 Not Found` se a integração não existir
- [ ] Retorna `502 Bad Gateway` se o plugin falhar ao buscar dados (com mensagem de erro)
- [ ] `lastSyncAt` é atualizado no banco após sync bem-sucedido
- [ ] Typecheck/build passa

### US-008: Job automático de sincronização a cada 1 hora
**Description:** As a user, I want my tracker stats to be refreshed automatically every hour so that the dashboard always shows up-to-date data.

**Acceptance Criteria:**
- [ ] Existe um `BackgroundService` do .NET que executa a cada 60 minutos
- [ ] A cada execução, itera por todas as integrações cadastradas e chama `FetchStatsAsync` para cada uma
- [ ] Erros em um tracker individual não interrompem a sincronização dos demais
- [ ] Stats e `lastSyncAt` são atualizados no banco após cada sync bem-sucedido
- [ ] O intervalo de 1 hora é configurável via `appsettings.json` (em minutos)
- [ ] Typecheck/build passa

### US-009: Persistência com SQLite via EF Core
**Description:** As a developer, I want data stored in SQLite so that the system is easy to run locally without external dependencies.

**Acceptance Criteria:**
- [ ] Projeto usa EF Core com provider SQLite
- [ ] Migrations são geradas e aplicadas automaticamente no startup
- [ ] Tabela `Integrations` persiste: `Id`, `PluginId`, `Name`, `BaseUrl`, `Username`, `Password`, `Cookie`, `LastSyncAt`
- [ ] Tabela `TrackerStatsSnapshots` (ou coluna na própria tabela) persiste: `Ratio`, `UploadedBytes`, `DownloadedBytes`
- [ ] Arquivo `.db` tem path configurável via `appsettings.json`
- [ ] Typecheck/build passa

### US-010: Estrutura de projeto em arquitetura hexagonal
**Description:** As a developer, I want the codebase organized in hexagonal architecture so that domain logic is decoupled from infrastructure and delivery.

**Acceptance Criteria:**
- [ ] Solução contém pelo menos 3 projetos:
  - `TrackerStats.Domain` — entidades, interfaces de porta, DTOs de domínio (sem dependências externas)
  - `TrackerStats.Application` — casos de uso, orquestração (depende apenas de Domain)
  - `TrackerStats.Infrastructure` — EF Core, SQLite, implementações de repositório, BackgroundService (depende de Domain/Application)
  - `TrackerStats.Api` — controllers, DI composition root, middlewares (depende de todos)
- [ ] `ITrackerPlugin`, `ITrackerPluginRegistry`, `IIntegrationRepository` são interfaces definidas em `Domain`
- [ ] Nenhum projeto de Domain ou Application referencia `Microsoft.EntityFrameworkCore` ou qualquer lib de infraestrutura
- [ ] Typecheck/build passa

---

## Functional Requirements

- **FR-1:** `GET /api/plugins` — lista plugins disponíveis com `pluginId`, `displayName`, `authMode`
- **FR-2:** `POST /api/integrations` — cria nova integração; valida `pluginId` e campos de credencial conforme `authMode`
- **FR-3:** `GET /api/integrations` — lista integrações com stats atuais; omite credenciais
- **FR-4:** `DELETE /api/integrations/{id}` — remove integração do banco
- **FR-5:** `POST /api/integrations/{id}/sync` — sincroniza manualmente uma integração
- **FR-6:** `ITrackerPlugin` define `PluginId`, `DisplayName`, `AuthMode` e `FetchStatsAsync`
- **FR-7:** Plugins são registrados via DI; `ITrackerPluginRegistry` resolve por `pluginId`
- **FR-8:** `BackgroundService` executa sync de todas as integrações a cada N minutos (padrão: 60)
- **FR-9:** Falha de sync em um tracker não afeta os demais
- **FR-10:** SQLite com EF Core; migrations aplicadas no startup
- **FR-11:** Existe um `FakeTrackerPlugin` funcional para desenvolvimento/testes

---

## Non-Goals

- Nenhuma autenticação na API (uso pessoal/local)
- Nenhum plugin de tracker concreto além do `FakeTrackerPlugin` de stub
- Sem histórico de ratio ao longo do tempo (apenas valor atual)
- Sem notificações ou alertas de ratio baixo
- Sem frontend (apenas API)
- Sem suporte a múltiplos usuários
- Sem rate limiting ou throttling na API

---

## Technical Considerations

- **.NET 10** com ASP.NET Core minimal API ou controllers (preferência por controllers para maior clareza)
- **EF Core 9+** com SQLite provider
- **BackgroundService** nativo do .NET para o job de sincronização (sem libs externas de cron)
- Credenciais armazenadas em plaintext no SQLite (escopo local; sem necessidade de criptografia neste momento)
- `FakeTrackerPlugin` deve retornar dados estáticos ou aleatórios para simular resposta real
- Docker Compose deve incluir apenas o serviço da API (SQLite é file-based, não precisa de container separado)
- Volume Docker deve montar o diretório do `.db` para persistência entre reinicializações

---

## Project Structure (Reference)

```
tracker-stats/
├── src/
│   ├── TrackerStats.Domain/
│   │   ├── Entities/
│   │   │   └── Integration.cs
│   │   ├── Plugins/
│   │   │   ├── ITrackerPlugin.cs
│   │   │   ├── ITrackerPluginRegistry.cs
│   │   │   ├── TrackerCredentials.cs
│   │   │   ├── TrackerStats.cs
│   │   │   └── AuthMode.cs
│   │   └── Repositories/
│   │       └── IIntegrationRepository.cs
│   ├── TrackerStats.Application/
│   │   └── UseCases/
│   │       ├── AddIntegrationUseCase.cs
│   │       ├── ListIntegrationsUseCase.cs
│   │       ├── RemoveIntegrationUseCase.cs
│   │       └── SyncIntegrationUseCase.cs
│   ├── TrackerStats.Infrastructure/
│   │   ├── Persistence/
│   │   │   ├── AppDbContext.cs
│   │   │   ├── Migrations/
│   │   │   └── IntegrationRepository.cs
│   │   ├── Plugins/
│   │   │   ├── TrackerPluginRegistry.cs
│   │   │   └── FakeTrackerPlugin.cs
│   │   └── Jobs/
│   │       └── TrackerSyncJob.cs
│   └── TrackerStats.Api/
│       ├── Controllers/
│       │   ├── PluginsController.cs
│       │   └── IntegrationsController.cs
│       ├── Program.cs
│       └── appsettings.json
├── docker-compose.yml
└── TrackerStats.sln
```

---

## Success Metrics

- `GET /api/integrations` responde em menos de 200ms (dados já em banco, sem hit ao tracker)
- Adicionar um novo plugin requer apenas: criar classe que implementa `ITrackerPlugin` + registrar no DI
- Job de sync não bloqueia requests da API (executa em background)
- Sistema roda com `docker compose up` sem configuração adicional

---

## Open Questions

- Deve existir endpoint para atualizar credenciais de uma integração existente (`PUT /api/integrations/{id}`)? Não incluído no escopo agora, mas é candidato natural para próxima iteração.
- O `FakeTrackerPlugin` deve usar `AuthMode.UsernamePassword` ou `AuthMode.Cookie`? Recomendado: implementar um de cada para cobrir ambos os fluxos de validação.
