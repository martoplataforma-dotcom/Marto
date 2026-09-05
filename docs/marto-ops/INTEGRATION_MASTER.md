# Marto Ops → Marto — Integration Master

> Fonte oficial de controle da incorporação progressiva do Marto Ops ao Marto. A migração não deve depender da memória de uma conversa.

## 1. Estado seguro inicial

- Repositório: `martoplataforma-dotcom/Marto`
- Branch principal protegida: `main`
- Commit-base confirmado no PC e no GitHub: `2dffa2e5fd31f760ca45d43b316479d4e64dfe14`
- Commit-base: `Ajusta navegação e limpeza da gestão de produtos`
- Branch de trabalho: `feat/marto-ops-integration`
- A branch foi criada e publicada no GitHub a partir do mesmo commit-base.
- Regra: não desenvolver a incorporação diretamente na `main`.

## 2. Fonte funcional do Ops

Versão-base inicialmente inventariada:

`Marto-Ops-Store5-ABRIR-ESTE-v230-candidata-paulineris-rj-suspenso(1).html`

A v230 é um marco de referência, não um congelamento do Ops.

O HTML continua sendo usado no trabalho e pode evoluir para v231, v232, v233 etc.
Cada nova versão relevante deverá ser comparada e registrada no `OPS_CHANGELOG.md`.

## 3. Direção arquitetural

O HTML não será incorporado como uma ilha permanente.

Direção:

`Next.js → API/backend → regras de negócio → PostgreSQL`

Princípio:

> Não criar um segundo sistema dentro do Marto. Expandir a arquitetura existente com os domínios e regras maduras validadas no Ops.

## 4. Estratégia de migração

Migração progressiva no estilo Strangler Pattern:

- o HTML continua vivo enquanto módulos equivalentes ainda não estiverem validados no Marto;
- módulos são migrados um por vez;
- cada módulo é testado no trabalho real;
- depois de validado no Marto, novas melhorias desse módulo passam a ser feitas diretamente no Marto;
- o HTML completo só é aposentado no final.

Fluxo:

`Ops atual → comportamento válido → separar dados/regras/interface → incorporar → testar → validar → retirar somente a parte substituída`

## 5. Princípios aprovados

### 5.1 Pedido canônico

Existe um único `Order` do Marto independentemente da origem da venda.

Não criar `PedidoML`, `PedidoShopee` ou `PedidoOps` como cópias paralelas do mesmo pedido.

### 5.2 Canais

Mercado Livre, Shopee, site próprio, Marto e outros são canais de venda.

Modelo conceitual:

`Merchant → SalesChannel → ExternalOrderReference → Order → Operação`

### 5.3 Store5

A Store5 continua sendo o `Merchant` existente do Marto.

Não criar uma Store5 separada para o Ops e não hard-code Store5 na arquitetura.

### 5.4 Equipe e permissões

Funcionários não devem compartilhar o login da Store5.

Direção:

`User → MerchantMember/Membership → Merchant → Role/Permissions`

Permissões devem ser validadas no backend.

### 5.5 Visões derivadas

`Dossiê`, `Hoje`, `Central Operacional`, `Pós-venda/SLA` e dashboards devem ler fatos canônicos, não criar cópias paralelas quando isso não for necessário.

Exemplo:

`Order + OrderEvent + Shipment + Cotação + Assistência + Devolução + Conferência → Dossiê`

## 6. Fundação existente que deve ser reutilizada

- `Merchant`
- `Product`
- `Order`
- `OrderItem`
- `OrderEvent`
- `Shipment`
- `ShipmentEvent`
- `ShipmentIncident`
- `Transporter`
- `TransporterRateTable`
- `DeliveryProof`
- autenticação existente
- base atual de roles
- estruturas existentes de pagamento/financeiro

Regra: evoluir quando adequado, em vez de duplicar.

## 7. Blocos previstos

- `SalesChannel`
- `ExternalOrderReference`
- `MerchantMember` / permissões
- `FreightQuote`
- `FreightProposal`
- CT-e / conferência / reconciliação de frete
- `AssistanceCase`
- `ReturnCase` mais rico que o MVP atual
- estruturas de tarefa/SLA somente se houver fato persistente real

Os nomes finais podem ser ajustados antes de cada implementação.
Não criar model apenas porque existe uma tela com esse nome no HTML.

## 8. SalesChannel — desenho conceitual

Campos previstos:

- `id`
- `merchantId`
- `type`
- `name`
- `externalAccountId`
- `status`
- `lastSyncedAt`
- `createdAt`
- `updatedAt`

Tipos iniciais previstos:

- `MARTO`
- `MERCADO_LIVRE`
- `SHOPEE`
- `SITE`
- `AMAZON`
- `MAGALU`
- `OTHER`

Um Merchant pode possuir mais de uma conta no mesmo marketplace.

Credenciais, tokens, secrets e senhas não ficam diretamente em `SalesChannel`.

## 9. ExternalOrderReference — desenho conceitual

Campos previstos:

- `id`
- `orderId`
- `salesChannelId`
- `externalOrderId`
- `externalStatus`
- `externalCreatedAt`
- `externalUpdatedAt`
- `lastSyncedAt`
- `metadata` mínima específica do canal
- `createdAt`
- `updatedAt`

Regra obrigatória:

`(salesChannelId, externalOrderId) = UNIQUE`

O mesmo pedido externo sincronizado novamente atualiza o mesmo `Order` e nunca cria duplicata.

## 10. Dados canônicos x dados do canal

> Informação universal da operação pertence ao Marto; informação específica de uma plataforma fica na camada do canal/conector.

Evitar campos específicos de marketplace diretamente no `Order`, como `mlOrderId`, `mlShippingId`, `shopeeOrderId` etc.

`metadata` externa deve conter apenas o necessário, não a resposta completa da API sem critério.

## 11. Regras de sincronização

Fluxo:

`Canal → Conector → Normalização → localizar referência externa → criar/atualizar Order → registrar mudanças relevantes`

Garantias:

1. mesmo pedido externo → mesmo `Order`;
2. sincronização repetida → atualiza, não duplica;
3. evento antigo não deve regredir estado novo;
4. marketplace não deve apagar fatos operacionais internos do Marto;
5. resposta incompleta ou erro de sincronização não deve apagar dados válidos existentes;
6. webhook, sincronização manual e periódica devem usar o mesmo motor interno;
7. não gerar `OrderEvent` sem mudança relevante;
8. criação de `Order` + `ExternalOrderReference` deve ser atômica/transacional.

O canal controla identidade/status/datas/fatos externos.

O Marto controla cotação, decisão logística, coleta, CT-e, conferência, custos, assistência, devolução, notas, SLA e decisões operacionais.

## 12. Regra crítica de cotações

`estimativa/referência ≠ proposta oficial`

Estimativa não é confirmação oficial e não deve liberar uso/coleta.

Proposta oficial deve conter pelo menos:

- valor;
- número da cotação;
- prazo.

A proposta escolhida pode alimentar `Shipment`, mas `Shipment` não substitui o histórico de cotação.

## 13. Regra crítica de frete e conferência

Manter separados:

- valor estimado;
- valor oficialmente cotado/contratado;
- valor cobrado;
- custo efetivo;
- CT-e/documento;
- divergência;
- estorno/reembolso quando aplicável.

Nunca sobrescrever o valor contratado com o valor posteriormente cobrado.

## 14. Ordem segura de implantação

1. proteção do estado atual;
2. canais de venda;
3. pedido canônico para pedidos externos;
4. equipe e permissões;
5. cotações;
6. expedição, coleta e rastreamento;
7. assistência, devolução e pós-venda;
8. CT-e, Conferência e Financeiro operacional;
9. Dossiê, Hoje, Central e dashboards derivados.

Cada etapa deve ser aditiva, testada e registrada antes da próxima.

## 15. Evolução do HTML durante a migração

- continuar versionando o Ops (`v230`, `v231`, `v232`...);
- não substituir versões antigas pelo mesmo nome;
- comparar novas versões com a última base considerada;
- registrar deltas relevantes no `OPS_CHANGELOG.md`;
- classificar mudanças como bug, regra operacional, melhoria visual ou função nova;
- verificar se afetam módulo não migrado, em migração ou já migrado;
- não alterar o Marto automaticamente só porque o HTML mudou.

Quando um módulo estiver validado no Marto e em uso real, melhorias novas desse módulo passam a ser feitas diretamente no Marto.

## 16. Protocolo por micro-etapa

1. definir escopo;
2. confirmar arquivos/models afetados;
3. alterar somente na branch de integração;
4. rodar testes relevantes;
5. verificar regressões;
6. registrar resultado neste documento;
7. criar commit identificável;
8. só então avançar.

> Nunca avançar para a etapa seguinte sem registrar o estado da etapa anterior.

## 17. Status

- [x] Inventário macro do Ops v230
- [x] Comparação DB/API atual do Marto x Ops
- [x] Núcleo Merchant/Store5 + canal + Order canônico
- [x] Blocos de domínio faltantes definidos conceitualmente
- [x] Ordem segura de implantação
- [x] PC e GitHub confirmados no mesmo commit-base
- [x] Branch `feat/marto-ops-integration` criada e publicada
- [x] Desenho de `SalesChannel`
- [x] Desenho de `ExternalOrderReference`
- [x] Separação canônico x específico do canal
- [x] Regras mínimas de sincronização/idempotência
- [x] `INTEGRATION_MASTER.md` salvo no repositório
- [x] `OPS_CHANGELOG.md` salvo no repositório
- [x] Marco de documentação commitado e enviado ao GitHub
- [ ] Implementar `SalesChannel` + `ExternalOrderReference` no Prisma
- [ ] Validar migration Prisma
- [ ] Rodar testes/build relevantes
- [ ] Registrar resultado da primeira implementação

## 18. Último ponto confirmado

Documentação-base da integração criada, commitada e sincronizada com o GitHub.

**Commit do marco:** `848c71d` — `docs: registra plano mestre da integração Marto Ops`

A branch de trabalho permanece:

`feat/marto-ops-integration`

## 19. Próxima ação exata

Iniciar a primeira implementação de código, limitada a:

`SalesChannel + ExternalOrderReference` no Prisma.

Primeiro arquivo a ser analisado/alterado:

`packages/db/prisma/schema.prisma`

Antes de gerar qualquer migration, validar os models e relações no schema.

Ainda não integrar Mercado Livre, Shopee ou criar telas.

## 20. NÃO FAZER AINDA

- não integrar Mercado Livre;
- não integrar Shopee;
- não criar telas de Operação;
- não migrar Cotações;
- não mexer em Pós-venda;
- não alterar a `main`;
- não desativar o HTML;
- não criar segundo `Order` para o Ops;
- não absorver automaticamente novas versões do HTML sem análise do delta.

## Regra de retomada

Ao retomar este trabalho:

1. abrir este arquivo;
2. conferir `Último ponto confirmado`;
3. conferir `Próxima ação exata`;
4. conferir o último commit da branch;
5. continuar somente daí.
