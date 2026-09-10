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

### Checkpoint — contrato normalizado e motor interno somente-leitura

Foi definido o contrato interno genérico:

- `NormalizedExternalOrderInput`
- `NormalizedExternalOrderItem`

O contrato não depende de Mercado Livre, Shopee ou qualquer marketplace específico.

Também foi criado o esqueleto de `ExternalOrderIngestionService`.

Nesta fase o motor:

- valida `salesChannelId`;
- valida `externalOrderId`;
- localiza o `SalesChannel`;
- deriva o `merchantId` a partir do próprio canal;
- localiza `ExternalOrderReference` pela chave única `(salesChannelId, externalOrderId)`;
- classifica a entrada como `create`, `update` ou `ignored_stale`;
- usa `externalUpdatedAt` para impedir regressão quando uma atualização comprovadamente mais antiga chega depois de uma mais recente.

Ainda não existe qualquer escrita no banco nesse serviço.

O serviço ainda:

- não cria `Order`;
- não atualiza `Order`;
- não cria ou atualiza `ExternalOrderReference`;
- não cria ou substitui `OrderItem`;
- não cria `OrderEvent`;
- não está registrado no `OrdersModule`;
- não possui endpoint público;
- não possui regra específica de marketplace.

O build da API NestJS foi executado após essas alterações e concluído sem erros.

### Micro-checkpoint — validações de criação antes da primeira escrita

Foi adicionada ao `ExternalOrderIngestionService` a validação inicial do candidato a criação de pedido externo.

Quando ainda não existe `ExternalOrderReference` para `(salesChannelId, externalOrderId)`, o serviço agora valida:

- presença de `canonicalStatus`;
- presença de pelo menos um item;
- `title` não vazio em cada item;
- `quantity` inteira e maior que zero;
- `unitPrice` válido, finito e maior ou igual a zero.

A validação de `productId` contra o `Merchant` do `SalesChannel` ainda não foi implementada. Essa verificação deverá ocorrer no fluxo transacional, usando o `merchantId` derivado do próprio canal.

O serviço continua sem qualquer escrita no banco:

- não cria `Order`;
- não cria `OrderItem`;
- não cria `ExternalOrderReference`;
- não atualiza pedido existente;
- não cria `OrderEvent`.

O build da API NestJS foi executado após essa alteração e concluído sem erros.

Este micro-checkpoint prepara a Regra Transacional 1 sem antecipar a implementação da transação.

### Micro-checkpoint — primeira escrita transacional implementada

Foi implementado no `ExternalOrderIngestionService` o primeiro fluxo de escrita para criação de pedido externo.

A criação agora utiliza uma transação com isolamento `Serializable`.

Dentro da própria transação, o fluxo:

1. relê o `SalesChannel`;
2. deriva novamente o `merchantId` a partir do canal;
3. relê `ExternalOrderReference` por `(salesChannelId, externalOrderId)`;
4. se a referência já existir, não cria outro pedido e classifica a entrada como `update` ou `ignored_stale`;
5. se a referência continuar inexistente, executa as validações de criação;
6. valida que qualquer `productId` informado existe e pertence ao mesmo `Merchant` do `SalesChannel`;
7. cria atomicamente:
	- `Order`;
	- `OrderItem(s)`;
	- `ExternalOrderReference`.

Na criação externa:

- `Order.userId = null`;
- nenhum `User` fictício é criado;
- nenhum `Product` fictício é criado;
- `merchantId` é derivado do `SalesChannel`;
- `canonicalStatus` é utilizado diretamente;
- não são inventados timestamps de lifecycle;
- não é criado `OrderEvent` para etapas históricas que o Marto não observou.

Foi adicionado retry limitado a no máximo 3 tentativas para conflitos transacionais esperados identificados por `P2034` ou `P2002`.

A atualização transacional de um pedido externo já existente ainda não foi implementada. Quando a referência já existe, o motor ainda apenas classifica a entrada como `update` ou `ignored_stale`.

Também ainda não foram implementados:

- reconciliação automática de itens de pedido existente;
- endpoint público;
- registro do serviço no `OrdersModule`;
- conector de Mercado Livre, Shopee ou outro marketplace.

O build da API NestJS foi executado após a implementação e concluído sem erros.

A primeira escrita transacional foi validada por execução real contra um banco PostgreSQL isolado (`marto_ops_test`), criado exclusivamente para estes testes.

Foram comprovados:

1. criação válida de pedido externo com `Order + OrderItem(s) + ExternalOrderReference`;
2. `Order.userId = null` para comprador externo sem conta Marto;
3. `merchantId` derivado corretamente do `SalesChannel`;
4. item externo sem vínculo interno criado com `productId = null`, sem criação de `Product` fictício;
5. nenhuma criação de `User` fictício;
6. segunda ingestão do mesmo `(salesChannelId, externalOrderId)` mantendo somente um `Order`, um `OrderItem` e uma `ExternalOrderReference`;
7. rollback integral da transação quando uma gravação falhou dentro de `tx.order.create()`;
8. rejeição de `productId` inexistente sem criação parcial;
9. rejeição de `productId` pertencente a outro `Merchant` sem criação parcial;
10. ausência de `OrderEvent` indevido na criação inicial;
11. smoke test do fluxo nativo Marto concluído com sucesso, mantendo `Order` em `CREATED`, vínculo normal com `Product`, `userId = user_test` conforme comportamento existente e `titleSnapshot` corretamente preenchido;
12. pedido nativo não recebeu `ExternalOrderReference`.

Os testes utilizaram apenas dados controlados no banco isolado e não tocaram no banco normal de desenvolvimento.

### Regra transacional 1 — criação de novo pedido externo

Um novo `Order` externo somente poderá ser criado quando:

1. `salesChannelId` identificar um `SalesChannel` existente;
2. `externalOrderId` estiver preenchido;
3. ainda não existir `ExternalOrderReference` para `(salesChannelId, externalOrderId)`;
4. `canonicalStatus` estiver presente;
5. `items` estiver presente e possuir pelo menos um item;
6. cada item possuir:
	- `title` não vazio;
	- `quantity` inteiro maior que zero;
	- `unitPrice` válido e maior ou igual a zero;
7. quando `productId` for informado, o produto deverá existir e pertencer ao mesmo `Merchant` do `SalesChannel`.

Na criação:

- `merchantId` será sempre derivado do `SalesChannel`;
- `Order.userId` será `null` para comprador externo sem conta Marto;
- não será criado `User` fictício;
- não será criado `Product` fictício.

Não serão obrigatórios para a criação inicial:

- `buyerName`;
- `buyerContact`;
- `recipientName`;
- `destinationZipCode`;
- `city`;
- `state`;
- `destinationAddress`;
- `externalCreatedAt`;
- `externalUpdatedAt`.

Esses campos poderão chegar posteriormente e deverão ser incorporados sem apagar informações válidas já existentes.

`canonicalStatus` será obrigatório para a criação de pedido externo. O motor não deverá usar silenciosamente o default `CREATED`, pois o pedido externo poderá já chegar em outro estágio do ciclo de vida.

A criação deverá ser atômica:

`Order + OrderItem(s) + ExternalOrderReference`

Se qualquer parte da operação falhar, nenhuma das entidades deverá permanecer criada.

A semântica de atualização de `items` em pedidos externos já existentes será definida separadamente antes da implementação.

### Regra transacional 2 — atualização sem apagar dados válidos

Quando já existir `ExternalOrderReference` para `(salesChannelId, externalOrderId)`, o motor tratará a entrada como atualização do mesmo `Order` canônico.

Antes de qualquer escrita:

1. a `ExternalOrderReference` deverá apontar para um `Order` existente;
2. o `Order` deverá pertencer ao mesmo `merchantId` do `SalesChannel`;
3. qualquer divergência entre o canal e o `Order` será tratada como erro de integridade e nenhuma escrita deverá ocorrer.

#### Entrada antiga

Quando a sincronização for classificada como `ignored_stale` por possuir `externalUpdatedAt` comprovadamente anterior ao já registrado:

- não alterar o `Order`;
- não alterar `OrderItem`;
- não regredir `externalStatus`;
- não regredir `externalUpdatedAt`;
- não gerar `OrderEvent`.

`lastSyncedAt` representa o momento em que o Marto recebeu/processou uma sincronização e poderá ser tratado separadamente mesmo quando o conteúdo recebido for antigo.

#### Campos canônicos opcionais

Para:

- `buyerName`;
- `buyerContact`;
- `recipientName`;
- `destinationZipCode`;
- `city`;
- `state`;
- `destinationAddress`;

a regra inicial será:

- campo ausente (`undefined`) → preservar o valor atual;
- `null` → preservar o valor atual;
- string vazia → preservar o valor atual;
- valor válido informado → poderá preencher ou atualizar o valor canônico.

Nesta primeira versão do motor, informação ausente, nula ou vazia não terá poder para apagar informação canônica válida já existente.

#### Status canônico

Para `canonicalStatus`:

- ausente → manter o status atual;
- igual ao status atual → nenhuma mudança de status;
- diferente do status atual → somente alterar conforme as regras de sincronização de status definidas na Regra Transacional 5;
- não gerar `OrderEvent` quando o status efetivamente não mudar.

#### ExternalOrderReference

Para dados pertencentes à referência externa:

- `externalStatus` somente será atualizado quando houver valor válido informado;
- `externalCreatedAt` ausente ou nulo não apagará valor já existente;
- `externalUpdatedAt` nunca poderá regredir;
- `metadata` parcial não deverá apagar metadata válida já armazenada.

#### Itens

Nesta regra ainda não será definida a reconciliação dos itens.

Por enquanto:

- `items` ausente → preservar integralmente os itens existentes;
- `items` presente → aguardar a regra específica de reconciliação de itens antes de implementar substituição ou merge.

O motor não deverá apagar, recriar ou duplicar `OrderItem` indiscriminadamente em uma sincronização repetida.

#### Idempotência

Uma sincronização que não produza mudança relevante deverá permanecer idempotente:

- não criar outro `Order`;
- não criar outra `ExternalOrderReference`;
- não duplicar `OrderItem`;
- não gerar `OrderEvent` desnecessário.

### Regra transacional 3 — reconciliação segura dos itens externos

A reconciliação automática de `OrderItem` exige uma identidade externa estável por linha do pedido.

O `OrderItem` canônico não deverá usar como identidade externa:

- `title`;
- `sku`;
- posição no array;
- preço;
- combinação desses campos.

Esses valores podem mudar ou se repetir e, portanto, não são uma chave segura para sincronização.

#### Criação de pedido externo

Na criação de um novo `Order` externo:

- `items` será obrigatório;
- deverá existir pelo menos um item válido;
- os itens normalizados recebidos serão criados uma única vez junto com o `Order`;
- cada `OrderItem` poderá ter `productId = null` quando ainda não existir correspondência com o catálogo Marto;
- nenhum `Product` fictício será criado.

#### Pedido externo já existente

Quando o pedido já existir:

- `items` ausente → preservar integralmente os `OrderItem` existentes;
- `items` presente → não apagar, recriar ou fazer merge automático enquanto não existir uma identidade externa estável por linha.

A presença de `items` em uma sincronização não autoriza substituir indiscriminadamente os itens canônicos.

Atualizações de status, comprador, destinatário e referência externa poderão ocorrer independentemente da reconciliação dos itens.

#### Identidade externa de item

Antes de habilitar atualização automática dos itens, deverá existir uma estrutura genérica equivalente a:

`ExternalOrderItemReference`

Conceitualmente:

- `orderItemId`;
- `externalOrderReferenceId`;
- `externalItemId`.

Essa estrutura deverá permitir identificar inequivocamente qual item externo corresponde a qual `OrderItem` canônico, sem introduzir campos específicos de Mercado Livre, Shopee ou outro canal no núcleo do pedido.

Depois dessa identidade existir:

- item externo já conhecido → atualizar o mesmo `OrderItem`;
- item externo novo → criar um novo `OrderItem`;
- item ausente em uma resposta parcial → não presumir exclusão.

A remoção, cancelamento ou invalidação de um item somente deverá ocorrer quando houver sinal explícito e confiável da origem.

Não será criada ainda `ExternalOrderItemReference`. Esta regra apenas estabelece a condição arquitetural necessária antes da reconciliação automática de itens.

### Regra transacional 4 — atomicidade e concorrência

A classificação preliminar feita antes da transação:

- `create`;
- `update`;
- `ignored_stale`;

não será considerada autoridade final para qualquer escrita.

Antes de gravar dados, o motor deverá revalidar o estado dentro da própria transação.

#### Revalidação transacional

Dentro da transação, o motor deverá consultar novamente `ExternalOrderReference` por:

`(salesChannelId, externalOrderId)`

A decisão final entre criação, atualização ou descarte por evento antigo deverá ser feita com base no estado mais recente disponível nessa transação.

#### Criação atômica

A criação de um novo pedido externo deverá ocorrer em uma única operação transacional:

`Order + OrderItem(s) + ExternalOrderReference`

Fluxo conceitual:

1. consultar novamente `ExternalOrderReference`;
2. confirmar que ainda não existe referência para o pedido externo;
3. executar todas as validações da criação;
4. criar o `Order`;
5. criar os `OrderItem`;
6. criar a `ExternalOrderReference`.

Se qualquer etapa falhar, toda a transação deverá ser revertida.

Não poderá permanecer um `Order` órfão criado por uma tentativa de importação cuja `ExternalOrderReference` não tenha sido persistida.

#### Concorrência de criação

A restrição única `(salesChannelId, externalOrderId)` continuará sendo a garantia estrutural contra duplicidade.

Se duas sincronizações concorrentes tentarem criar o mesmo pedido externo:

- somente uma poderá consolidar a referência única;
- a execução perdedora não deverá criar um segundo `Order`;
- a tentativa perdedora deverá ser integralmente revertida;
- depois do conflito, uma nova leitura deverá localizar o pedido criado pela execução vencedora;
- o processamento deverá continuar de forma idempotente sobre o mesmo `Order` canônico.

#### Concorrência de atualização

Uma sincronização mais antiga não poderá terminar depois e sobrescrever informação externa mais recente.

`externalUpdatedAt` deverá ser reavaliado dentro da transação antes de aplicar alterações dependentes da ordem temporal.

Quando a entrada for comprovadamente mais antiga que o estado já persistido:

- não regredir `externalUpdatedAt`;
- não regredir `externalStatus`;
- não regredir estado canônico;
- não sobrescrever dados válidos com informação antiga;
- não gerar `OrderEvent` correspondente a uma regressão.

#### Estratégia transacional

A implementação deverá utilizar uma estratégia transacional adequada para proteger essas invariantes.

Preferencialmente:

- isolamento serializável;
- retry limitado para conflitos transacionais esperados;
- nenhum retry infinito.

Cada retry deverá executar novamente as leituras e validações relevantes.

Decisões obtidas antes da transação não deverão ser reutilizadas cegamente após um conflito.

Princípio:

`múltiplas sincronizações podem competir, mas somente um Order canônico poderá representar o mesmo pedido externo.`

### Regra transacional 5 — status canônico, histórico e atualização futura via APIs

O `canonicalStatus` representa o estado operacional normalizado do pedido dentro do Marto.

O status específico de cada marketplace permanecerá na camada externa, enquanto o `Order.status` continuará usando apenas `OrderStatus` canônico.

#### Criação de pedido externo

Na criação de um novo pedido externo:

- `canonicalStatus` será obrigatório;
- o `Order` será criado diretamente no status canônico informado;
- o motor não deverá usar silenciosamente o default `CREATED`;
- o motor não deverá inventar etapas intermediárias apenas para reproduzir o histórico do canal.

Um pedido poderá ser importado pela primeira vez já em estados como:

- `PAID`;
- `READY_FOR_PICKUP`;
- `IN_TRANSIT`;
- `DELIVERED`;
- `CANCELLED`;

desde que o normalizador do canal tenha mapeado o estado externo com segurança para um `OrderStatus` do Marto.

#### Atualização de pedido existente

Para `canonicalStatus`:

- ausente → preservar o status atual;
- igual ao status atual → nenhuma alteração;
- entrada `ignored_stale` → não alterar o status;
- diferente e proveniente de entrada válida → poderá atualizar o mesmo `Order` canônico conforme as regras de sincronização externa.

As regras nativas de transição acionadas por comprador, vendedor ou fluxos internos do Marto não deverão ser reutilizadas cegamente para reconstruir o histórico de um pedido externo já avançado.

O canal poderá informar um fato externo já ocorrido sem que o Marto precise simular artificialmente todas as etapas anteriores.

#### OrderEvent

Quando o `canonicalStatus` de um pedido existente realmente mudar por sincronização externa, deverá ser criado exatamente um `OrderEvent`.

Conceitualmente:

- `type`: `STATUS_CHANGED`;
- `actorUserId`: `null`;
- `actorRole`: `system`;
- `fromStatus`: status canônico anterior;
- `toStatus`: novo status canônico;
- mensagem indicando atualização proveniente de canal externo.

O `meta` deverá conter apenas contexto genérico e necessário, como:

- `salesChannelId`;
- `externalOrderId`;
- `externalStatus`.

Não armazenar payload bruto de marketplace no `OrderEvent`.

Não gerar `OrderEvent` quando:

- o status não tiver mudado;
- a entrada tiver sido descartada como `ignored_stale`;
- a sincronização tiver apenas complementado comprador, endereço, metadata ou outros dados sem mudança de status.

#### Datas de lifecycle

`externalUpdatedAt` não deverá ser interpretado como data de pagamento, envio, entrega, cancelamento ou qualquer outro evento de lifecycle.

Portanto:

- não usar `externalUpdatedAt` como `paidAt`;
- não usar `externalUpdatedAt` como `inTransitAt`;
- não usar `externalUpdatedAt` como `deliveredAt`;
- não usar `externalUpdatedAt` como `cancelledAt`;
- não sobrescrever timestamps de lifecycle válidos com aproximações.

Quando um canal fornecer datas específicas e confiáveis de lifecycle, o contrato normalizado poderá ser enriquecido posteriormente para transportá-las explicitamente.

Princípio:

`dado desconhecido permanece desconhecido; aproximação não será registrada como fato.`

#### Atualização futura via APIs

Quando Mercado Livre, Shopee ou outros canais estiverem conectados, mudanças externas deverão atualizar automaticamente o mesmo `Order` canônico.

As diferentes formas de entrada:

- webhook;
- sincronização periódica;
- sincronização manual;

deverão convergir para o mesmo fluxo:

`canal → conector → normalização → ExternalOrderIngestionService → Order canônico`

O conector será responsável por converter o status específico da plataforma para um `canonicalStatus` somente quando esse mapeamento for seguro.

O Marto não copiará diretamente textos ou códigos específicos de marketplace para `Order.status`.

Uma nova atualização do canal deverá localizar o pedido por:

`(salesChannelId, externalOrderId)`

e atualizar o mesmo `Order`, nunca criar duplicata.

Dados pertencentes à operação interna do Marto — como cotações, transportadora escolhida, CT-e, conferência, custos, assistência, observações e decisões operacionais — não deverão ser apagados ou substituídos pelo canal externo.

### Micro-checkpoint — escopo da primeira atualização transacional de pedido externo

Antes da implementação da escrita de atualização, foi delimitado o primeiro escopo seguro para pedidos externos já existentes.

A atualização deverá utilizar o mesmo princípio de proteção da criação:

`SalesChannel + ExternalOrderReference + Order` serão relidos dentro de uma transação `Serializable` antes de qualquer escrita.

Dentro da transação:

1. reler o `SalesChannel`;
2. reler `ExternalOrderReference` por `(salesChannelId, externalOrderId)` junto com o `Order` canônico;
3. confirmar que a referência existe;
4. confirmar que o `Order` pertence ao mesmo `Merchant` do `SalesChannel`;
5. reavaliar `externalUpdatedAt`;
6. se a entrada for comprovadamente antiga, retornar `ignored_stale` sem alterar `Order`, status externo ou histórico;
7. se a entrada for válida, aplicar somente os campos autorizados neste micro-checkpoint.

Campos canônicos autorizados:

- `buyerNameSnapshot`;
- `buyerContactSnapshot`;
- `recipientNameSnapshot`;
- `destinationZipCode`;
- `city`;
- `state`;
- `destinationAddressSnapshot`;
- `status`, somente quando `canonicalStatus` válido realmente diferir do status atual.

Para campos opcionais:

- `undefined` preserva o valor atual;
- `null` preserva o valor atual;
- string vazia preserva o valor atual;
- valor válido informado poderá preencher ou atualizar o valor existente.

Campos da `ExternalOrderReference` autorizados:

- `externalStatus`;
- `externalCreatedAt`;
- `externalUpdatedAt`;
- `metadata`;
- `lastSyncedAt`.

Para `metadata` nesta primeira implementação:

- `undefined` ou `null` preserva integralmente a metadata existente;
- metadata recebida não deverá substituir cegamente o objeto já armazenado;
- quando ambos os valores forem objetos JSON, os dados recebidos deverão ser incorporados preservando chaves válidas já existentes que não tenham sido informadas na nova sincronização;
- valores ausentes ou nulos na entrada não terão poder para apagar metadata válida já persistida;
- arrays ou valores escalares somente poderão substituir a chave correspondente quando forem explicitamente fornecidos.

Regras temporais:

- `externalUpdatedAt` nunca poderá regredir;
- `externalCreatedAt` ausente ou nulo não apagará o valor existente;
- uma entrada comprovadamente mais antiga não poderá alterar `externalStatus`, dados canônicos ou `canonicalStatus`;
- `externalUpdatedAt` nunca será utilizado como timestamp de lifecycle do `Order`.

Mesmo quando a entrada for `ignored_stale`, `lastSyncedAt` poderá ser atualizado para registrar que a sincronização foi recebida e processada. Nesse caso, nenhum outro campo da `ExternalOrderReference` ou do `Order` poderá ser alterado.

Histórico:

Quando `canonicalStatus` realmente mudar por uma sincronização externa válida, criar exatamente um `OrderEvent` com:

- `type = STATUS_CHANGED`;
- `actorUserId = null`;
- `actorRole = system`;
- `fromStatus` igual ao status anterior;
- `toStatus` igual ao novo status;
- mensagem identificando atualização proveniente de canal externo;
- `meta` contendo somente `salesChannelId`, `externalOrderId` e `externalStatus`.

Não gerar `OrderEvent` quando não houver mudança real de status.

Nesta primeira atualização transacional:

- não alterar `OrderItem`;
- não apagar nem recriar itens mesmo que `items` seja recebido;
- não criar `ExternalOrderItemReference`;
- não alterar timestamps de lifecycle;
- não alterar dados operacionais pertencentes ao Marto;
- não criar endpoint;
- não registrar o serviço no `OrdersModule`;
- não implementar conector de marketplace.

Toda decisão que resultar em escrita deverá ser baseada nas leituras realizadas dentro da própria transação.

### Micro-checkpoint — revalidação transacional e proteção contra entrada stale

Checkpoint anterior protegido:

- criação transacional validada: `9577207` — `feat(orders): valida criação transacional de pedidos externos`;
- escopo desta atualização transacional definido em: `4d63814` — `docs: define escopo da atualização transacional externa`;
- branch: `feat/marto-ops-integration`.

Foi iniciado o fluxo transacional de atualização de pedido externo já existente.

O `ExternalOrderIngestionService` agora direciona pedidos externos já existentes para um fluxo específico de atualização com transação `Serializable`.

Dentro da transação, o fluxo:

1. relê o `SalesChannel`;
2. relê a `ExternalOrderReference` por `(salesChannelId, externalOrderId)` junto com o `Order`;
3. confirma que a referência continua existente;
4. confirma que o `Order` pertence ao mesmo `Merchant` do `SalesChannel`;
5. reavalia `externalUpdatedAt` usando o estado persistido dentro da própria transação.

A classificação `ignored_stale` deixou de ser decisão definitiva feita antes da transação.

Quando a entrada é comprovadamente mais antiga que `externalUpdatedAt` já persistido:

- o `Order` não é alterado;
- `canonicalStatus` não é alterado;
- `externalStatus` não é alterado;
- `externalUpdatedAt` não regride;
- `metadata` não é alterada;
- nenhum `OrderEvent` é criado;
- somente `lastSyncedAt` é atualizado para registrar o processamento da sincronização.

Esse comportamento foi validado por execução real contra o banco PostgreSQL isolado `marto_ops_test`.

No teste controlado:

- estado persistido anterior: `externalUpdatedAt = 2026-09-05 12:05:00`;
- entrada recebida: `externalUpdatedAt = 2026-09-05 12:04:00`;
- a entrada tentou informar outro comprador, outro `externalStatus`, outro `canonicalStatus` e nova `metadata`;
- resultado: `action = ignored_stale`;
- `Order.status` permaneceu `PAID`;
- comprador permaneceu inalterado;
- `externalStatus` permaneceu `paid`;
- `externalUpdatedAt` permaneceu `2026-09-05 12:05:00`;
- `metadata` permaneceu inalterada;
- `OrderEvent` permaneceu com contagem zero;
- somente `lastSyncedAt` recebeu novo valor.

O build da API também foi executado após a alteração e concluído sem erros.

Neste ponto, a atualização válida e não stale ainda não grava comprador, destinatário, endereço, metadata, status canônico ou histórico.

Também continuam fora deste micro-checkpoint:

- reconciliação de `OrderItem`;
- `ExternalOrderItemReference`;
- timestamps de lifecycle;
- endpoint público;
- registro no `OrdersModule`;
- conectores de marketplace.

### Micro-checkpoint — atualização textual canônica não stale e avanço do watermark

A primeira escrita canônica de atualização de pedido externo existente foi implementada e validada em banco isolado.

Checkpoint anterior protegido:

- proteção transacional contra entrada stale: `0e14d1d` — `feat(orders): protege atualizações stale de pedidos externos`;
- branch: `feat/marto-ops-integration`.

No caminho não stale, o `ExternalOrderIngestionService` agora pode atualizar somente os seguintes campos canônicos textuais do `Order`:

- `buyerNameSnapshot`;
- `recipientNameSnapshot`;
- `destinationZipCode`;
- `city`;
- `state`.

Foi adicionada normalização de strings opcionais.

Regras validadas:

- strings válidas são normalizadas com `trim()`;
- `undefined` preserva o valor existente;
- `null` preserva o valor existente;
- string vazia preserva o valor existente;
- string contendo apenas espaços preserva o valor existente;
- valor válido diferente pode atualizar o campo;
- valor válido igual não gera `Order.update()` desnecessário.

Neste mesmo fluxo, `ExternalOrderReference.lastSyncedAt` é atualizado para registrar o processamento da sincronização.

O `externalUpdatedAt` também passou a funcionar como watermark persistido da sincronização externa:

- entrada não stale com `externalUpdatedAt` informado pode avançar o valor persistido;
- entrada sem `externalUpdatedAt` preserva o valor existente;
- o valor nunca regride pelo caminho stale;
- a decisão continua sendo reavaliada dentro da transação `Serializable`.

Esse comportamento foi validado contra o PostgreSQL isolado `marto_ops_test`.

Teste de atualização válida:

- estado inicial do watermark: `2026-09-05 12:05:00`;
- entrada válida utilizada posteriormente: `2026-09-05 12:08:00`;
- `buyerNameSnapshot` passou para `Marto Ops Buyer Atualizado`;
- `recipientNameSnapshot` passou para `Marto Ops Recipient Atualizado`;
- CEP passou para `20040002`;
- cidade passou para `Rio de Janeiro`;
- estado passou para `RJ`;
- `externalUpdatedAt` avançou para `2026-09-05 12:08:00`;
- `status` permaneceu `PAID`;
- `externalStatus` permaneceu `paid`;
- `metadata` permaneceu inalterada;
- `OrderEvent` permaneceu com contagem zero;
- `OrderItem` permaneceu com contagem um.

Teste de preservação:

- foram enviados `null`, string vazia e strings contendo apenas espaços;
- nenhum dos cinco campos canônicos válidos foi apagado;
- somente o processamento da sincronização foi registrado.

Teste de regressão do watermark:

- após persistir `externalUpdatedAt = 2026-09-05 12:08:00`, foi enviada uma entrada atrasada com `2026-09-05 12:07:00`;
- resultado: `action = ignored_stale`;
- os cinco campos canônicos permaneceram intactos;
- `externalUpdatedAt` permaneceu em `12:08`;
- nenhum evento foi criado;
- nenhum item foi alterado.

O build da API foi executado após a implementação e concluído sem erros.

Continuam fora deste micro-checkpoint:

- `buyerContactSnapshot`;
- `destinationAddressSnapshot`;
- `externalStatus`;
- `externalCreatedAt`;
- merge de `metadata`;
- alteração de `canonicalStatus`;
- criação de `OrderEvent` para mudança real de status;
- reconciliação de `OrderItem`;
- timestamps de lifecycle;
- endpoint público;
- registro no `OrdersModule`;
- conectores de marketplace.

### Micro-checkpoint — buyerContactSnapshot atômico

Foi implementada e validada a atualização não stale de `buyerContactSnapshot`.

Checkpoint anterior protegido:

- regra de snapshots JSON atômicos: `fd26779` — `docs: define snapshots json atomicos em pedidos externos`;
- branch: `feat/marto-ops-integration`.

O contrato `NormalizedExternalOrderInput` passou a aceitar:

- `buyerContact?: Prisma.InputJsonValue | null`.

Semântica adotada:

- `undefined` preserva o snapshot existente;
- `null` preserva o snapshot existente;
- JSON explicitamente recebido substitui integralmente `buyerContactSnapshot`;
- não existe merge parcial desse snapshot.

No fluxo de criação de pedido externo:

- JSON válido continua sendo persistido;
- `null` é tratado como ausência do valor e não é enviado diretamente ao Prisma;
- isso evita conflito com a semântica específica de `Json?` do Prisma.

O comportamento foi validado no PostgreSQL isolado `marto_ops_test`.

Teste de primeira gravação:

- watermark anterior: `2026-09-05 12:08:00`;
- entrada não stale: `2026-09-05 12:09:00`;
- foi persistido um objeto contendo `email`, `phone` e `source`;
- `destinationAddressSnapshot` permaneceu `NULL`;
- `OrderEvent` permaneceu com contagem zero;
- `OrderItem` permaneceu com contagem um.

Teste de substituição atômica:

- nova entrada não stale: `2026-09-05 12:10:00`;
- foi enviado somente `{ "phone": "32888880000" }`;
- os campos anteriores `email` e `source` não permaneceram;
- o snapshot persistido passou a conter somente o novo `phone`;
- portanto não ocorreu merge parcial.

Teste de preservação por `null`:

- nova entrada não stale: `2026-09-05 12:11:00`;
- foi enviado `buyerContact: null`;
- `buyerContactSnapshot` permaneceu `{ "phone": "32888880000" }`;
- o valor válido persistido não foi apagado;
- `destinationAddressSnapshot` permaneceu intacto;
- nenhum `OrderEvent` foi criado;
- nenhum `OrderItem` foi alterado.

O build da API foi executado após o ajuste do contrato e concluído sem erros.

Ainda não foi implementado neste micro-checkpoint:

- `destinationAddressSnapshot`;
- `externalStatus`;
- `externalCreatedAt`;
- merge de `metadata`;
- `canonicalStatus`;
- criação de `OrderEvent` por mudança real de status;
- reconciliação de `OrderItem`;
- timestamps de lifecycle;
- endpoint público;
- conectores de marketplace.

### Micro-checkpoint — destinationAddressSnapshot atômico

Foi implementada e validada a atualização não stale de `destinationAddressSnapshot`.

Checkpoint anterior protegido:

- `76e05bc` — `feat(orders): adiciona snapshot atomico de contato externo`;
- branch: `feat/marto-ops-integration`.

O contrato `NormalizedExternalOrderInput` passou a aceitar:

- `destinationAddress?: Prisma.InputJsonValue | null`.

Semântica adotada:

- `undefined` preserva o snapshot existente;
- `null` preserva o snapshot existente;
- JSON explicitamente recebido substitui integralmente `destinationAddressSnapshot`;
- não existe merge parcial desse snapshot.

No fluxo de criação de pedido externo:

- JSON válido continua sendo persistido;
- `null` é tratado como ausência do valor por meio de `undefined`;
- `null` não é enviado diretamente ao campo `Json?` do Prisma.

O build da API foi executado após os ajustes e concluído sem erros.

O comportamento foi validado no PostgreSQL isolado `marto_ops_test`.

Baseline antes dos testes:

- `destinationAddressSnapshot = NULL`;
- `externalUpdatedAt = 2026-09-05 12:11:00`;
- `OrderEvent` com contagem zero;
- `OrderItem` com contagem um.

Teste de primeira gravação:

- entrada não stale: `2026-09-05 12:12:00`;
- foi persistido endereço contendo `street`, `number`, `neighborhood`, `city`, `state` e `zipCode`;
- `externalUpdatedAt` avançou para `12:12`;
- nenhum `OrderEvent` foi criado;
- nenhum `OrderItem` foi alterado.

Teste de substituição atômica:

- entrada não stale: `2026-09-05 12:13:00`;
- foi enviado somente `street` e `number`;
- `city`, `state`, `zipCode` e `neighborhood` anteriores não permaneceram;
- o snapshot persistido passou a conter somente:
	- `street: Avenida Marto Atualizada`;
	- `number: 999`;
- portanto não ocorreu merge parcial;
- nenhum `OrderEvent` foi criado;
- nenhum `OrderItem` foi alterado.

Teste de preservação por `null`:

- entrada não stale: `2026-09-05 12:14:00`;
- foi enviado `destinationAddress: null`;
- `destinationAddressSnapshot` permaneceu com `street` e `number` anteriormente persistidos;
- o valor válido não foi apagado;
- `externalUpdatedAt` avançou para `12:14`;
- nenhum `OrderEvent` foi criado;
- nenhum `OrderItem` foi alterado.

O runner temporário utilizado nos testes foi removido e não faz parte do código oficial.

Ainda não foi implementado neste micro-checkpoint:

- `externalStatus`;
- `externalCreatedAt`;
- merge de `metadata`;
- `canonicalStatus`;
- criação de `OrderEvent` por mudança real de status;
- reconciliação de `OrderItem`;
- timestamps de lifecycle;
- endpoint público;
- conectores de marketplace.

### Micro-checkpoint — externalStatus bruto do canal

Foi implementada e validada a atualização não stale de `ExternalOrderReference.externalStatus`.

Checkpoint anterior protegido:

- `ca257ca` — `docs: define regra de externalStatus em pedidos externos`;
- branch: `feat/marto-ops-integration`.

Semântica implementada:

- `externalStatus` representa somente o status bruto recebido do canal externo;
- uma string válida é normalizada com `trim()`;
- string vazia ou somente espaços preserva o valor persistido;
- atualização stale não altera nem regride `externalStatus`;
- atualização não stale pode substituir `externalStatus`;
- `externalUpdatedAt` continua sendo o watermark de proteção contra regressão;
- `Order.status` não é alterado por este campo;
- nenhum `OrderEvent` é criado por este campo;
- `externalCreatedAt`, `metadata` e `canonicalStatus` continuam fora.

O build da API foi executado após a implementação e concluído sem erros.

O comportamento foi validado no PostgreSQL isolado `marto_ops_test`.

Baseline:

- `externalStatus = paid`;
- `externalUpdatedAt = 2026-09-05 12:14:00`;
- `Order.status = PAID`;
- `OrderEvent` com contagem zero;
- `OrderItem` com contagem um.

Teste de atualização válida e normalização:

- entrada não stale: `2026-09-05 12:15:00`;
- entrada: `externalStatus = "  ready_to_ship  "`;
- resultado: `action = update`;
- valor persistido: `ready_to_ship`;
- os espaços externos foram removidos;
- `externalUpdatedAt` avançou para `12:15`;
- `Order.status` permaneceu `PAID`;
- nenhum `OrderEvent` foi criado;
- nenhum `OrderItem` foi alterado.

Teste de proteção stale:

- entrada: `2026-09-05 12:14:30`;
- tentativa de `externalStatus = shipped`;
- resultado: `action = ignored_stale`;
- `externalStatus` permaneceu `ready_to_ship`;
- `externalUpdatedAt` permaneceu `12:15`;
- somente `lastSyncedAt` avançou;
- `Order.status` permaneceu `PAID`;
- nenhum `OrderEvent` foi criado;
- nenhum `OrderItem` foi alterado.

Teste de preservação por string contendo somente espaços:

- entrada não stale: `2026-09-05 12:16:00`;
- entrada: `externalStatus = "   "`;
- resultado: `action = update`;
- `externalStatus` permaneceu `ready_to_ship`;
- `externalUpdatedAt` avançou para `12:16`;
- `Order.status` permaneceu `PAID`;
- nenhum `OrderEvent` foi criado;
- nenhum `OrderItem` foi alterado.

`null` e `undefined` seguem o mesmo caminho de normalização que resulta em ausência de atualização, mas não foram testados separadamente no banco neste micro-checkpoint.

O runner temporário utilizado nos testes foi removido e não faz parte do código oficial.

Ainda não foi implementado neste micro-checkpoint:

- `externalCreatedAt`;
- merge de `metadata`;
- `canonicalStatus`;
- criação de `OrderEvent`;
- reconciliação de itens;
- lifecycle timestamps;
- endpoints;
- conectores de marketplace.

### Micro-checkpoint — externalCreatedAt imutável e enriquecível

Foi implementada e validada a atualização segura de `ExternalOrderReference.externalCreatedAt`.

Checkpoint anterior protegido:

- `4227b01` — `feat(orders): atualiza externalStatus de pedidos externos`;
- `937712a` — `docs: define regra de externalCreatedAt em pedidos externos`;
- branch: `feat/marto-ops-integration`.

Semântica implementada:

- `externalCreatedAt` representa a data/hora original de criação do pedido no canal externo;
- no fluxo de criação, o comportamento existente foi preservado;
- `undefined` ou `null` em atualização preservam o valor persistido;
- se o valor persistido estiver `NULL`, uma atualização não stale com `externalCreatedAt` informado poderá preenchê-lo;
- depois que existir um valor persistido, sincronizações posteriores não o substituem automaticamente;
- entrada stale nunca poderá preencher, alterar ou regredir `externalCreatedAt`;
- `externalUpdatedAt` continua sendo o watermark de proteção temporal.

A implementação adicionou somente a decisão de preenchimento de `externalCreatedAt` no fluxo transacional de atualização existente.

Não houve migration, pois o campo já existia no schema.

O comportamento foi validado por execução real contra o PostgreSQL isolado `marto_ops_test`.

Teste de imutabilidade de valor já existente:

- baseline: `externalCreatedAt = 2026-09-05 12:00:00`;
- entrada não stale com `externalUpdatedAt = 12:17`;
- foi tentado `externalCreatedAt = 11:55`;
- o valor persistido permaneceu `12:00`;
- `externalUpdatedAt` avançou para `12:17`;
- `externalStatus` permaneceu `ready_to_ship`;
- `Order.status` permaneceu `PAID`;
- `OrderEvent` permaneceu com contagem zero;
- `OrderItem` permaneceu com contagem um.

Teste de enriquecimento quando o valor estava `NULL`:

- foi criado fixture isolado com `externalCreatedAt = NULL`;
- baseline do watermark: `12:17`;
- entrada não stale: `externalUpdatedAt = 12:18`;
- entrada trouxe `externalCreatedAt = 11:50`;
- o campo foi preenchido corretamente com `11:50`;
- `externalUpdatedAt` avançou para `12:18`;
- `Order.status`, `externalStatus`, eventos e itens permaneceram intactos.

Teste de imutabilidade após o enriquecimento:

- valor persistido: `externalCreatedAt = 11:50`;
- entrada posterior não stale: `externalUpdatedAt = 12:19`;
- foi tentado substituir por `externalCreatedAt = 11:40`;
- o valor persistido permaneceu `11:50`;
- `externalUpdatedAt` avançou normalmente para `12:19`;
- nenhum evento ou item foi alterado.

Teste de proteção contra entrada stale quando o campo ainda estava `NULL`:

- fixture isolado com `externalCreatedAt = NULL`;
- watermark persistido: `externalUpdatedAt = 12:20`;
- entrada recebida: `externalUpdatedAt = 12:19`;
- a entrada tentou informar `externalCreatedAt = 11:30`;
- resultado: `action = ignored_stale`;
- `externalCreatedAt` permaneceu `NULL`;
- `externalUpdatedAt` permaneceu `12:20`;
- `externalStatus` permaneceu `ready_to_ship`;
- `Order.status` permaneceu `PAID`;
- `OrderEvent` permaneceu com contagem zero;
- `OrderItem` permaneceu com contagem um.

O build da API NestJS foi executado após a implementação e concluído sem erros.

`git diff --check` foi executado após os testes e concluído sem erros.

O runner temporário utilizado nos testes foi removido e não faz parte do código oficial.

Continuam fora deste micro-checkpoint:

- merge de `metadata`;
- `canonicalStatus`;
- criação de `OrderEvent`;
- reconciliação de itens;
- lifecycle timestamps;
- endpoints;
- registro do serviço no `OrdersModule`;
- conectores de marketplace.

### Micro-checkpoint — definição da atualização segura de metadata externa

Antes de implementar qualquer escrita de `ExternalOrderReference.metadata`, fica definida sua semântica de atualização.

`metadata` pertence à camada da referência externa e deve conter somente contexto específico do canal que seja realmente necessário.

Não armazenar indiscriminadamente o payload bruto completo de Mercado Livre, Shopee ou outro canal.

#### Regra geral

Em atualização de pedido externo:

- `metadata` ausente (`undefined`) preserva integralmente a metadata persistida;
- `metadata = null` deverá preservar integralmente a metadata persistida;
- entrada `ignored_stale` nunca altera `metadata`;
- uma atualização válida não stale poderá enriquecer ou atualizar metadata;
- a sincronização não poderá apagar silenciosamente informação válida que deixou de aparecer em uma resposta parcial do canal.

#### Estrutura de atualização

Na primeira versão, a atualização automática de `metadata` será baseada em objeto JSON.

Quando a metadata recebida e a metadata persistida forem objetos JSON:

- realizar merge recursivo por chave;
- chave ausente na entrada preserva o valor persistido;
- chave recebida com `null` preserva o valor persistido dessa chave;
- objeto recebido em uma chave será mesclado recursivamente quando o valor persistido dessa mesma chave também for objeto;
- valor escalar explicitamente recebido (`string`, `number`, `boolean`) substitui somente o valor daquela chave;
- array explicitamente recebido substitui integralmente o array daquela chave;
- arrays não serão concatenados, mesclados por posição ou deduplicados automaticamente.

Exemplo conceitual:

Persistido:

`{ shipment: { id: "123", status: "ready" }, source: "api" }`

Recebido:

`{ shipment: { status: "shipped" } }`

Resultado:

`{ shipment: { id: "123", status: "shipped" }, source: "api" }`

A atualização parcial não poderá apagar `shipment.id` nem `source`.

#### Valores nulos

Nesta primeira versão, `null` não terá semântica de exclusão.

Exemplo:

Persistido:

`{ shipmentId: "123", tracking: "ABC" }`

Recebido:

`{ tracking: null }`

Resultado:

`{ shipmentId: "123", tracking: "ABC" }`

Se futuramente for necessário permitir remoção explícita de uma chave, isso deverá possuir uma regra própria e inequívoca. Não utilizar `null` implicitamente como comando de exclusão.

#### Metadata ainda inexistente

Se a metadata persistida estiver `NULL` e uma atualização válida não stale trouxer um objeto JSON válido, esse objeto poderá ser persistido como primeira metadata da referência externa.

#### Tipos incompatíveis

Se uma chave persistida possuir um tipo e uma atualização válida trouxer explicitamente outro tipo:

- objeto recebido substitui valor escalar ou array existente naquela chave;
- escalar recebido substitui objeto ou array existente naquela chave;
- array recebido substitui objeto, escalar ou array existente naquela chave.

A substituição ocorre somente na chave explicitamente recebida e não autoriza apagar outras chaves da metadata.

#### Metadata no nível raiz

Para atualização automática nesta primeira versão, `metadata` recebida deverá ser um objeto JSON.

Array ou valor escalar no nível raiz não terá semântica automática de substituição integral da metadata persistida.

Se a metadata já persistida no nível raiz for um array ou valor escalar, uma atualização automática que receba um objeto JSON também deverá preservar o valor persistido, em vez de substituir silenciosamente o formato raiz.

Portanto, o merge automático desta primeira versão somente ocorrerá quando:

- a metadata persistida estiver `NULL` e a entrada for um objeto JSON válido; ou
- a metadata persistida e a metadata recebida forem ambas objetos JSON.

Qualquer mudança de formato da raiz já persistida deverá possuir tratamento explícito em uma etapa futura.

Isso evita que uma resposta malformada ou uma mudança de formato do canal apague todo o contexto externo já conhecido.

#### Idempotência

Receber repetidamente a mesma metadata deverá produzir o mesmo estado final.

Uma repetição não deverá:

- criar outra `ExternalOrderReference`;
- alterar `Order`;
- alterar `OrderItem`;
- alterar `Order.status`;
- criar `OrderEvent`;
- alterar timestamps de lifecycle.

`lastSyncedAt` poderá continuar registrando que uma sincronização foi processada.

#### Limites deste micro-passo

A implementação de metadata não autoriza:

- alterar `canonicalStatus`;
- criar `OrderEvent`;
- reconciliar `OrderItem`;
- alterar lifecycle timestamps;
- criar endpoint;
- registrar o serviço no `OrdersModule`;
- criar conector de Mercado Livre, Shopee ou outro marketplace.

`externalUpdatedAt` continuará sendo o watermark utilizado para impedir que uma entrada comprovadamente stale modifique metadata mais recente.

### Implementação e validação concluídas

A implementação do merge seguro de `ExternalOrderReference.metadata` foi concluída no serviço de ingestão externa, sem migration e sem ampliar o escopo para outros componentes do sistema.

O contrato normalizado passou a aceitar:
```ts
metadata?: Prisma.InputJsonValue | null;
```

Na criação de uma referência externa:

- `metadata` válida poderá ser persistida;
- `null` não será gravado como comando de remoção.

Na atualização de uma referência existente:

- entrada `undefined` preserva a metadata persistida;
- entrada `null` preserva a metadata persistida;
- entrada stale não altera metadata;
- objeto recebido com objeto persistido executa merge recursivo por chave;
- chave recebida com `null` preserva o valor persistido daquela chave;
- escalar não nulo substitui somente a chave explicitamente recebida;
- array recebido em uma chave substitui integralmente o array daquela chave;
- array no nível raiz não substitui automaticamente a metadata persistida;
- escalar no nível raiz não substitui automaticamente a metadata persistida;
- metadata persistida `NULL` pode receber o primeiro objeto JSON válido;
- metadata raiz já persistida como array ou escalar não muda automaticamente de formato ao receber um objeto;
- o merge não altera `Order`, `OrderItem`, `Order.status`, lifecycle timestamps ou `OrderEvent`.

A implementação utiliza `externalUpdatedAt` como watermark e mantém `lastSyncedAt` como registro de processamento da sincronização.

#### Validação realizada

A implementação foi validada exclusivamente no banco isolado `marto_ops_test`.

Foram verificados com sucesso:

- inclusão de nova chave sem apagar chaves existentes;
- merge recursivo de objeto aninhado;
- preservação de chave quando a entrada recebida é `null`;
- preservação integral quando `metadata` recebida é `null`;
- preservação integral quando `metadata` não é enviada;
- substituição integral de array em chave interna;
- substituição de tipo somente na chave explicitamente recebida;
- rejeição de array como substituição automática no nível raiz;
- rejeição de escalar como substituição automática no nível raiz;
- primeira gravação quando a metadata persistida era `NULL`;
- preservação de raiz persistida como array quando a entrada nova é objeto;
- preservação de raiz persistida como escalar quando a entrada nova é objeto;
- proteção contra entrada stale;
- idempotência com o mesmo `externalUpdatedAt`.

Durante todos esses testes também foi confirmado que:

- `Order.status` permaneceu `PAID`;
- nenhum `OrderEvent` foi criado;
- a quantidade de `OrderItem` permaneceu inalterada;
- `externalStatus` não sofreu alteração indevida;
- nenhum lifecycle timestamp foi utilizado ou aproximado.

### Micro-checkpoint — atualização de canonicalStatus e histórico externo

O próximo comportamento a ser implementado no motor de ingestão externa será a atualização segura de `Order.status` por meio de `canonicalStatus` em pedidos externos já existentes.

Esta etapa reutiliza a Regra transacional 5 já definida e não altera sua semântica.

#### Estado atual da criação

A criação de pedido externo já utiliza `canonicalStatus` diretamente:

- `canonicalStatus` é obrigatório para criação;
- o `Order` é criado diretamente no status informado;
- não é utilizado silenciosamente o default `CREATED`;
- não são inventadas etapas intermediárias;
- não é criado `OrderEvent` para reconstruir histórico anterior ao Marto.

Esse comportamento não será alterado neste micro-passo.

#### Atualização de pedido existente

Para uma `ExternalOrderReference` já existente:

- `canonicalStatus` ausente preserva `Order.status`;
- `canonicalStatus` igual ao `Order.status` atual não gera escrita de status;
- entrada comprovadamente stale não altera `Order.status`;
- entrada válida, não stale e com `canonicalStatus` diferente poderá atualizar o mesmo `Order` canônico.

A comparação deverá utilizar o `Order.status` obtido novamente dentro da transação.

Para isso, o `select` transacional de `existingReference.order` deverá passar a incluir `status`.

Não utilizar as regras nativas de transição de comprador, vendedor ou operação interna para reconstruir artificialmente o histórico de um pedido vindo de canal externo.

#### Atomicidade entre status e histórico

Quando uma sincronização externa válida realmente alterar `Order.status`, a mudança de status e a criação do respectivo `OrderEvent` deverão ocorrer dentro da mesma transação serializável.

Não poderá existir estado intermediário em que:

- `Order.status` tenha sido alterado sem o respectivo evento; ou
- o evento tenha sido criado sem a alteração efetiva de `Order.status`.

O retry transacional já existente continuará protegendo conflitos concorrentes.

Após eventual retry, a decisão deverá sempre considerar novamente o estado mais recente lido dentro da transação.

#### OrderEvent

Somente quando houver mudança real de status deverá ser criado exatamente um `OrderEvent`.

O evento deverá utilizar:

- `type = STATUS_CHANGED`;
- `actorUserId = null`;
- `actorRole = "system"`;
- `fromStatus` igual ao `Order.status` persistido antes da mudança;
- `toStatus` igual ao novo `canonicalStatus`;
- mensagem indicando que a alteração foi proveniente de sincronização de canal externo.

O `meta` poderá conter somente:

- `salesChannelId`;
- `externalOrderId`;
- `externalStatus`, quando houver valor externo válido.

Não armazenar payload bruto do marketplace no evento.

#### Situações que não geram OrderEvent

Não criar `OrderEvent` quando:

- `canonicalStatus` não for informado;
- `canonicalStatus` for igual ao status atual;
- a entrada for `ignored_stale`;
- a sincronização apenas enriquecer comprador, destinatário, endereço, metadata ou campos da referência externa;
- nenhuma mudança real de `Order.status` ocorrer.

A repetição idempotente da mesma sincronização não deverá produzir eventos adicionais.

#### Lifecycle timestamps

Este micro-passo não altera timestamps de lifecycle.

Em especial:

- `externalUpdatedAt` não será usado como `paidAt`;
- `externalUpdatedAt` não será usado como `inTransitAt`;
- `externalUpdatedAt` não será usado como `deliveredAt`;
- `externalUpdatedAt` não será usado como `cancelledAt`;
- nenhum timestamp será aproximado a partir do status recebido.

Datas específicas de lifecycle continuarão fora deste micro-passo.

#### Prisma e migration

A estrutura atual já suporta esta implementação.

`OrderEvent` possui:

- `type`;
- `actorUserId`;
- `actorRole`;
- `fromStatus`;
- `toStatus`;
- `message`;
- `meta`.

`OrderEventType` já possui `STATUS_CHANGED`.

Portanto:

- não alterar `schema.prisma`;
- não criar migration;
- não executar `prisma format`;
- não atualizar Prisma.

#### Limites deste micro-passo

A implementação de `canonicalStatus` e `OrderEvent` não autoriza:

- reconciliar `OrderItem`;
- alterar timestamps de lifecycle;
- criar endpoint público;
- registrar `ExternalOrderIngestionService` no `OrdersModule`;
- criar conector de Mercado Livre, Shopee ou outro marketplace;
- alterar regras nativas de status dos pedidos internos do Marto.

## 19. Próxima ação exata

O checkpoint de merge seguro de `ExternalOrderReference.metadata` foi implementado, validado, commitado e enviado ao GitHub.

A semântica da próxima etapa — atualização segura de `canonicalStatus` com criação atômica de `OrderEvent` quando houver mudança real de status — foi definida documentalmente.

O próximo micro-passo autorizado será somente proteger esta definição documental no Git antes de escrever código.

Depois desse checkpoint documental estar commitado e enviado ao GitHub, poderá ser iniciada a implementação de `canonicalStatus` e `OrderEvent` no `ExternalOrderIngestionService`.

Ainda não implementar:

- reconciliação de itens;
- lifecycle timestamps;
- endpoints;
- registro do serviço no `OrdersModule`;
- conectores de marketplace.

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
