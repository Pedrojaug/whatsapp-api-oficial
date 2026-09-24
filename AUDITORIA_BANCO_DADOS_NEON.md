# 🛡️ Relatório de Auditoria Profunda: Otimização de Banco de Dados, Neon Tech e Arquitetura Limpa (Send Inteligentte)

**Data:** 24 de Setembro de 2026  
**Sistema:** Send Inteligentte (WhatsApp API Oficial Platform)  
**Foco:** Redução Drástica de Custos Operacionais na Neon Tech, Eficiência de Computação (CU-hours), Otimização de Consultas SQL e Refatoração Clean Code / Clean Architecture.

---

## 1. Resumo Executivo & Matriz de Impacto Financeiro

A **Neon Tech** opera com um modelo serverless baseado em:
1. **Compute Units (CU-hours):** Cobrado pelo tempo em que o nó de computação do Postgres permanece ativo. 1 CU (~$0.16/hora) = 1 vCPU + 4 GB RAM.
2. **Auto-Suspend (Scale to Zero):** Se o banco passar **5 minutos sem queries**, a computação hiberna e o custo de computação cai a **ZERO**.
3. **Storage & Written Data (WAL):** Cobrança por GiB armazenado e volume de dados gravados no log de transações (WAL).
4. **Buffer Cache & I/O:** Consultas pesadas que não cabem na RAM forçam leitura no armazenamento de objetos da Neon, consumindo CPU extra.

### Matriz de Gravidade e Impacto na Fatura

| # | Problema Identificado | Localização no Código | Impacto na Fatura Neon | Complexidade de Ajuste |
|---|------------------------|-----------------------|------------------------|------------------------|
| **V1** | **Morte do Auto-Suspend:** Polling a cada 60s nos workers + keep-alive no `/status` a cada 13m | `dispatcher.ts:333`, `campaignWorker.ts:57`, `server.ts:194` | **Crítico (Máximo)**: O banco nunca hiberna (744h ativas/mês). | Baixa (Quick Win) |
| **V2** | **Frontend Polling Agressivo no Chat com Full Table Scans** | `ChatPage.tsx:927,938` e `chatRoutes.ts:61-80` | **Crítico**: Varredura sequencial em centenas de milhares de linhas a cada 10-15s por usuário. | Média |
| **V3** | **Bloat de Storage e WAL com Base64 de Mídias no Postgres** | `schema.prisma:176`, `mediaRoutes.ts:112`, `server.ts:96` | **Alto**: Explosão de storage, WAL inflado em uploads de 5-15MB e poluição de RAM (`shared_buffers`). | Média (Migrar R2/S3) |
| **V4** | **Agregações em Memória Node.js ao invés de SQL (`/metrics`)** | `messageRoutes.ts:358-390` | **Alto**: Baixa até 50.000 mensagens pela rede para calcular totais no JavaScript. | Baixa (Quick Win) |
| **V5** | **Ausência de Índices Críticos em Chaves Estrangeiras e Filtros** | `schema.prisma` (`Contact`, `Message`) | **Alto**: Varreduras de tabela completa em disparos e verificações de planos. | Baixa (Migration) |
| **V6** | **Falta de Configuração do Neon Connection Pooler (PgBouncer)** | `backend/src/db.ts:3` e `DATABASE_URL` | **Médio-Alto**: Esgotamento de conexões e overhead de memória por conexão ociosa. | Baixa |

---

Consulte o relatório completo com planos de ação e códigos sugeridos nos artefatos do projeto.
