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
- [x] Implementar `SalesChannel` + `ExternalOrderReference` no Prisma
- [x] Validar schema Prisma
- [x] Criar e revisar migration Prisma
- [x] Aplicar migration no banco local de desenvolvimento
- [x] Confirmar banco sincronizado com `prisma migrate status`
- [x] Gerar Prisma Client
- [x] Validar alterações com `git diff --check`
- [x] Rodar build da API
- [x] Registrar resultado da primeira implementação
- [x] Commitar e enviar a primeira implementação ao GitHub

## 18. Último ponto confirmado

### PASSO 4A — canais e referência externa — concluído

Primeira implementação estrutural da integração concluída, validada, commitada e enviada ao GitHub.

**Commit técnico confirmado:** `5bc6949` — `feat(db): adiciona canais de venda e referência de pedidos externos`

Implementado:

- `SalesChannelType`
- `SalesChannelStatus`
- `SalesChannel`
- `ExternalOrderReference`
- relação `Merchant -> SalesChannel[]`
- relação `Order -> ExternalOrderReference[]`

Garantias:

- `(merchantId, type, externalAccountId)` é único;
- `(salesChannelId, externalOrderId)` é único;
- pedidos externos permanecem vinculados ao `Order` canônico;
- nenhuma coluna específica de Mercado Livre ou Shopee foi adicionada ao `Order`;
- nenhuma tabela ou coluna existente foi removida.

Migration:

`20260905010401_add_sales_channels_external_order_reference`

A migration foi revisada, aplicada no PostgreSQL local e validada com `prisma migrate status`.

Validações realizadas:

- `prisma validate` — aprovado;
- migration SQL revisada — aprovada;
- migration aplicada — aprovada;
- Prisma Client v6.19.1 regenerado — aprovado;
- `git diff --check` — aprovado;
- build da API NestJS — aprovado.

---

### PASSO 4B — suporte estrutural a pedido externo

A base estrutural necessária para permitir pedidos externos no `Order` canônico foi implementada e validada localmente.

Esta etapa ainda não integra Mercado Livre, Shopee ou outro marketplace e ainda não implementa o motor de sincronização/importação. Ela prepara o modelo canônico para receber esses pedidos sem criar dados falsos ou duplicar entidades.

### Implementado no `Order`

Foram adicionados snapshots opcionais para representar comprador e destinatário externos sem exigir a criação de um `User` Marto:

- `buyerNameSnapshot`
- `buyerContactSnapshot`
- `recipientNameSnapshot`
- `destinationAddressSnapshot`

Regra:

- comprador externo pode existir com `Order.userId = null`;
- não criar usuário fictício apenas para importar venda externa;
- comprador e destinatário podem ser pessoas diferentes;
- dados sensíveis devem ser armazenados somente quando necessários e realmente fornecidos.

### Implementado no `OrderItem`

`OrderItem.productId` passou de obrigatório para opcional.

Também foram adicionados:

- `titleSnapshot`
- `skuSnapshot`
- `variationSnapshot`

Regra:

- venda nativa Marto continua usando `productId`;
- item externo já conciliado com catálogo Marto pode usar `productId`;
- item externo ainda não conciliado pode ter `productId = null`;
- não criar `Product` fictício apenas para conseguir importar um item externo;
- o snapshot preserva o que efetivamente foi vendido independentemente de alterações futuras no cadastro do produto.

Pedidos nativos do Marto passaram também a registrar `titleSnapshot` a partir do título atual do `Product`.

### Compatibilidade da API

O fluxo nativo atual de checkout continua exigindo `productId`.

Foram ajustadas somente as leituras afetadas pela nova nulabilidade:

- `OrdersService.getOrderById()` ignora `productId = null` ao consultar produtos e continua retornando o item normalmente;
- o resumo de serviços aceita `productId: string | null`;
- `FactoriesService.topProductsForMe()` ignora itens ainda sem `productId`, pois eles não estão vinculados a um produto Marto e não devem entrar no ranking de produtos da fábrica.

### Migration

`20260905184105_support_external_order_items_buyers`

SQL revisado antes da aplicação.

A migration contém somente:

- adição dos snapshots no `Order`;
- adição dos snapshots no `OrderItem`;
- alteração de `OrderItem.productId` para permitir `NULL`.

Nenhuma tabela ou coluna existente foi removida.

A migration foi aplicada no PostgreSQL local.

`prisma migrate status` confirmou:

`65 migrations found in prisma/migrations`

`Database schema is up to date!`

### Validações realizadas

- schema Prisma validado antes da migration;
- migration criada inicialmente com `--create-only`;
- SQL da migration revisado manualmente;
- migration aplicada com sucesso;
- Prisma Client v6.19.1 regenerado automaticamente pelo `prisma migrate dev`;
- `git diff --check` — aprovado;
- build da API NestJS — aprovado.

Durante o primeiro build após tornar `productId` opcional, o TypeScript identificou dois usos em `FactoriesService.topProductsForMe()` que ainda assumiam `productId` obrigatório.

Esses pontos foram corrigidos para excluir itens sem vínculo de produto Marto do ranking. Depois da correção, o build da API foi executado novamente e concluído sem erros.

### Estado atual do PASSO 4B

A estrutura canônica necessária para representar:

`pedido externo + item externo + comprador externo`

está implementada e validada localmente.

Ainda falta implementar o fluxo interno que receberá um pedido externo normalizado e fará a criação/atualização transacional do `Order` + `ExternalOrderReference`.

Portanto, o PASSO 4B ainda não deve ser considerado completamente encerrado.

## 19. Próxima ação exata

Implementar o primeiro motor interno genérico de entrada de pedido externo normalizado.

Esse fluxo deverá:

1. receber dados já normalizados, sem depender diretamente de Mercado Livre ou Shopee;
2. localizar `ExternalOrderReference` por `(salesChannelId, externalOrderId)`;
3. se já existir, atualizar o mesmo `Order`;
4. se não existir, criar `Order` + `ExternalOrderReference` de forma transacional;
5. permitir `Order.userId = null` para comprador externo;
6. permitir `OrderItem.productId = null` quando ainda não houver correspondência com catálogo Marto;
7. gravar os snapshots mínimos de comprador, destinatário e itens;
8. não apagar dados válidos quando a origem enviar informação incompleta;
9. não gerar duplicidade em sincronizações repetidas;
10. não adicionar ainda qualquer regra específica de Mercado Livre ou Shopee.

Antes de implementar, definir a interface/contrato interno do pedido normalizado e identificar o local correto da API onde esse motor ficará.

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
