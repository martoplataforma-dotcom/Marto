# Marto Ops — OPS Changelog

> Registro oficial das mudanças do HTML Marto Ops durante a incorporação progressiva ao Marto.
>
> Este arquivo acompanha somente a evolução do Ops HTML e o impacto dessas mudanças na migração.
> O planejamento geral e o estado da incorporação ficam em `INTEGRATION_MASTER.md`.

## Regras de uso

1. Não sobrescrever versões antigas do HTML usando o mesmo nome.
2. Continuar versionando o Ops: `v230`, `v231`, `v232`, etc.
3. Quando houver nova versão relevante, comparar com a última versão já analisada.
4. Registrar somente o delta relevante.
5. Classificar a mudança.
6. Informar qual módulo foi afetado.
7. Informar o impacto na migração para o Marto.
8. Não alterar automaticamente o Marto apenas porque o HTML mudou.
9. Se o módulo já estiver validado no Marto e em uso real, a melhoria deve ser feita diretamente no Marto, salvo decisão excepcional documentada.

---

## Classificações

Use uma ou mais:

- `BUG_FIX` — correção de erro
- `BUSINESS_RULE` — regra operacional/de negócio
- `NEW_FEATURE` — nova funcionalidade
- `UX_UI` — melhoria visual/usabilidade
- `INTEGRATION` — integração/API
- `DATA_MODEL` — mudança de estrutura de dados
- `SECURITY` — segurança/proteção
- `PERFORMANCE` — desempenho
- `LOGISTICS` — logística/transportadoras/rastreio
- `FINANCE` — financeiro/conferência/custos
- `POST_SALE` — assistência/devolução/pós-venda
- `OTHER` — outro

## Estado do módulo no momento da mudança

- `HTML_ONLY` — ainda funciona somente no HTML
- `PLANNED` — mapeado para o Marto, mas não implementado
- `IN_MIGRATION` — implementação no Marto em andamento
- `MARTO_VALIDATION` — já existe no Marto e está em teste real
- `MARTO_OFFICIAL` — Marto já é a fonte oficial do módulo
- `LEGACY` — HTML apenas como referência histórica

## Impacto da mudança

- `NO_IMPACT` — não afeta a migração
- `INCORPORATE_LATER` — registrar para incorporar quando chegar ao módulo
- `UPDATE_DESIGN` — exige ajustar desenho ainda não implementado
- `UPDATE_IMPLEMENTATION` — afeta código do Marto já em desenvolvimento
- `REVIEW_MARTO` — Marto já possui o módulo; revisar se a mudança deve ser aplicada
- `DIRECT_TO_MARTO` — módulo já oficial no Marto; mudança deve ser feita diretamente lá

---

# Histórico

## v230 — Base inicial da migração

**Data de referência:** 03/09/2026  
**Arquivo-base:** `Marto-Ops-Store5-ABRIR-ESTE-v230-candidata-paulineris-rj-suspenso(1).html`  
**Estado:** `BASELINE`

### Papel desta versão

A v230 foi usada como versão-base para o primeiro inventário da incorporação do Marto Ops ao Marto.

Ela não representa o fim do desenvolvimento do HTML.

### Áreas principais identificadas

- Atendimento
- SAC
- Pedidos
- Hoje
- Visão
- Assistências
- Devoluções
- Pós-venda / SLA
- Reclamações / prevenção
- Estoque e planejamento
- Central operacional
- Cotações
- Transportadoras
- Conferência
- Financeiro operacional
- Comunicação

### Regras e comportamentos importantes presentes na base

- pedido deve ser fonte canônica;
- telas derivadas não devem criar cópia paralela desnecessária;
- estimativa de frete não é proposta oficial;
- proposta oficial exige valor + número da cotação + prazo;
- cotado, cobrado e custo efetivo permanecem separados;
- CT-e/conferência possuem papel próprio;
- pós-venda/SLA consulta fatos existentes em vez de duplicá-los;
- Hoje funciona como cockpit de leitura/navegação;
- assistência e devolução permanecem vinculadas ao pedido original;
- financeiro não deve fechar silenciosamente quando há pendência relevante;
- Paulineris possui suspensão temporária para envios ao RJ na v230;
- v230 possui cofre local criptografado e proteções locais próprias do HTML.

### Impacto na migração

`UPDATE_DESIGN`

Esta versão originou o inventário inicial e as decisões arquiteturais registradas em `INTEGRATION_MASTER.md`.

---

# Template para próxima versão

Copiar este bloco para cada nova versão do Ops:

```md
## vXXX — Título curto

**Data:** DD/MM/AAAA  
**Arquivo:** `nome-do-arquivo.html`  
**Comparado com:** vXXX

### Módulo afetado

Ex.: Cotações / Devoluções / Financeiro / Pedidos

### Classificação

`BUG_FIX`
`BUSINESS_RULE`
`NEW_FEATURE`
etc.

### O que mudou

- mudança 1
- mudança 2
- mudança 3

### Motivo

Problema observado no uso real / melhoria operacional / erro encontrado.

### Estado do módulo

`HTML_ONLY` / `PLANNED` / `IN_MIGRATION` / `MARTO_VALIDATION` / `MARTO_OFFICIAL`

### Impacto na migração

`NO_IMPACT` / `INCORPORATE_LATER` / `UPDATE_DESIGN` / `UPDATE_IMPLEMENTATION` / `REVIEW_MARTO` / `DIRECT_TO_MARTO`

### Ação necessária no Marto

- nenhuma;
- incorporar quando chegar ao módulo;
- atualizar model/regra;
- revisar código já migrado;
- fazer diretamente no Marto.

### Observações

Detalhes adicionais, dependências e riscos.
```

---

## Regra de retomada

Quando uma nova versão do HTML for enviada:

1. identificar a versão anterior já registrada;
2. comparar as duas versões;
3. extrair somente mudanças relevantes;
4. atualizar este changelog;
5. verificar o impacto no `INTEGRATION_MASTER.md`;
6. só depois decidir se alguma alteração entra no Marto.
