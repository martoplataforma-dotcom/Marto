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

### 5.3 Merchant e contas de canal

O `Merchant` representa o lojista/empresa dentro do Marto.

Uma conta conectada de marketplace é um `SalesChannel` pertencente ao `Merchant`, e não um `Merchant` separado.

Cada `SalesChannel` possui identidade própria e pode ter um nome livre definido pelo usuário.

No modelo atual:

- `SalesChannel.id` identifica internamente o canal conectado;
- `SalesChannel.type` identifica a plataforma, como `MERCADO_LIVRE`;
- `SalesChannel.name` é apenas o nome de exibição escolhido pelo usuário;
- `SalesChannel.externalAccountId` identifica a conta correspondente na plataforma externa.

A lógica de integração nunca deve depender de `SalesChannel.name`.

Nomes de lojas, contas-piloto, ambientes de teste ou nomes escolhidos pelos usuários não podem ser hard-coded na arquitetura.

A mesma integração Mercado Livre deve funcionar para qualquer `SalesChannel` cujo tipo seja `MERCADO_LIVRE`, independentemente do nome escolhido para a conta.

### 5.4 Equipe e permissões

Funcionários não devem compartilhar o login principal do Merchant nem credenciais de contas externas conectadas.

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
- [x] Núcleo Merchant + SalesChannel + Order canônico
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
- no fluxo de criação, uma `Date` válida continua sendo preservada;
- no fluxo de criação, `Invalid Date` é neutralizado antes da persistência e resulta em `externalCreatedAt = NULL`;
- `undefined` ou `null` em atualização preservam o valor persistido;
- se o valor persistido estiver `NULL`, uma atualização não stale com `externalCreatedAt` informado poderá preenchê-lo;
- depois que existir um valor persistido, sincronizações posteriores não o substituem automaticamente;
- entrada stale nunca poderá preencher, alterar ou regredir `externalCreatedAt`;
- `externalUpdatedAt` continua sendo o watermark de proteção temporal.

A implementação mantém a decisão segura de preenchimento de `externalCreatedAt` no fluxo transacional de atualização e acrescenta normalização defensiva de datas opcionais tanto na criação quanto na atualização.

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

Validação automatizada complementar realizada após a lapidação da regra:

- foi criado `apps/api/src/modules/orders/external-order-ingestion.service.spec.ts`;
- 10 testes específicos do `ExternalOrderIngestionService` foram executados e aprovados;
- criação com `externalCreatedAt` válido preserva a data;
- criação com `Invalid Date` neutraliza o valor antes da persistência;
- atualização não stale pode preencher `externalCreatedAt` quando o valor persistido está `NULL`;
- `undefined`, `null` e `Invalid Date` em atualização não preenchem nem apagam o campo;
- valor já persistido permanece imutável diante de uma data posterior diferente;
- entrada stale não toca em `externalCreatedAt` nem em `externalUpdatedAt`;
- `externalUpdatedAt` continua avançando normalmente em atualização não stale;
- atualização real de `canonicalStatus` continua alterando o `Order` e criando o respectivo `OrderEvent`;
- suíte completa da API executada com 8 suítes e 17 testes aprovados;
- build da API NestJS concluído sem erros;
- `git diff --check` concluído sem erros.

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

### Implementação e validação concluídas — canonicalStatus e histórico externo

A atualização segura de `Order.status` por meio de `canonicalStatus` foi implementada no `ExternalOrderIngestionService`.

A implementação permanece dentro da transação serializável já existente e não exigiu alteração de `schema.prisma` nem migration.

Na atualização de pedido externo existente:

- o `Order.status` é relido dentro da própria transação;
- `canonicalStatus` ausente preserva o status atual;
- `canonicalStatus` igual ao status atual não gera escrita de status nem novo evento;
- entrada comprovadamente stale não altera `Order.status`;
- `canonicalStatus` diferente, válido e não stale atualiza o mesmo `Order` canônico;
- uma mudança real de status cria exatamente um `OrderEvent` na mesma transação.

O evento de mudança externa utiliza:

- `type = STATUS_CHANGED`;
- `actorUserId = null`;
- `actorRole = "system"`;
- `fromStatus` igual ao status persistido imediatamente antes da mudança;
- `toStatus` igual ao novo `canonicalStatus`;
- mensagem identificando atualização por sincronização de canal externo;
- `meta` limitado a `salesChannelId`, `externalOrderId` e, somente quando recebido, `externalStatus`.

Nenhum payload bruto do marketplace é armazenado no `OrderEvent`.

#### Validação realizada

A implementação foi validada exclusivamente no PostgreSQL isolado `marto_ops_test`.

Baseline utilizado:

- `Order.status = PAID`;
- `externalStatus = ready_to_ship`;
- `externalUpdatedAt = 2026-09-05 12:28:00`;
- `OrderEvent` com contagem zero;
- `OrderItem` com contagem um.

Foram verificados com sucesso:

- mudança real `PAID -> READY_FOR_PICKUP`;
- criação de exatamente um `OrderEvent` para essa mudança;
- `fromStatus = PAID`;
- `toStatus = READY_FOR_PICKUP`;
- `actorUserId = null`;
- `actorRole = system`;
- `meta` com `salesChannelId`, `externalOrderId` e `externalStatus`;
- repetição de `READY_FOR_PICKUP` sem criação de segundo evento;
- ausência de `canonicalStatus` preservando `READY_FOR_PICKUP` sem novo evento;
- entrada stale tentando alterar para `IN_TRANSIT` sendo retornada como `ignored_stale`;
- entrada stale sem alterar `Order.status`, `externalStatus` ou `externalUpdatedAt`;
- segunda mudança real `READY_FOR_PICKUP -> IN_TRANSIT`;
- criação de exatamente um segundo `OrderEvent`;
- evento sem `externalStatus` recebido gerando `meta` somente com `salesChannelId` e `externalOrderId`;
- repetição idempotente da sincronização de `IN_TRANSIT` sem criação de terceiro evento;
- quantidade de `OrderItem` permanecendo inalterada.

Após as mudanças canônicas, também foi conferido que permaneceram `NULL`:

- `paidAt`;
- `confirmedAt`;
- `readyForPickupAt`;
- `inTransitAt`;
- `deliveredAt`;
- `completedAt`;
- `cancelledAt`;
- `returnRequestedAt`;
- `returnInTransitAt`;
- `returnedAt`;
- `disputeAt`.

Portanto, a sincronização externa não inventou nem aproximou timestamps de lifecycle a partir de `externalUpdatedAt` ou do status recebido.

O build da API foi executado após a implementação e concluído sem erros.

Nenhum runner temporário `.tmp-*` permanece no diretório `apps/api`.

### Micro-checkpoint — definição estrutural da identidade externa dos itens

Antes de implementar reconciliação automática de `OrderItem`, fica definida a estrutura mínima necessária para identificar de forma estável cada linha de um pedido externo.

Nenhuma implementação de schema ou código será realizada neste micro-checkpoint.

#### externalItemId no contrato normalizado

`NormalizedExternalOrderItem` deverá futuramente receber:

`externalItemId: string`

Para pedidos externos novos, `externalItemId` deverá ser obrigatório.

O valor deverá:

- identificar de forma estável uma linha dentro daquele pedido externo;
- ser fornecido pelo adaptador/conector do canal;
- ser normalizado com `trim`;
- não ser vazio;
- não depender de `title`, `sku`, posição no array ou preço;
- não ser confundido obrigatoriamente com ID de produto ou anúncio do marketplace.

Quando um canal não possuir um identificador de linha pronto, caberá ao adaptador produzir uma identidade estável baseada somente em identificadores imutáveis e confiáveis fornecidos pela própria origem.

Dentro de uma mesma `ExternalOrderReference`, dois itens recebidos não poderão possuir o mesmo `externalItemId`.

#### ExternalOrderItemReference

Será criada futuramente uma entidade genérica:

`ExternalOrderItemReference`

Estrutura mínima prevista:

- `id`;
- `orderItemId`;
- `externalOrderReferenceId`;
- `externalItemId`;
- `createdAt`;
- `updatedAt`.

Ela será responsável somente pelo vínculo entre a linha externa e o `OrderItem` canônico.

Não adicionar campos específicos de Mercado Livre, Shopee ou outro marketplace ao `OrderItem`.

#### Relações

A estrutura deverá relacionar:

`ExternalOrderReference -> ExternalOrderItemReference -> OrderItem`

A exclusão de um `ExternalOrderReference` deverá remover suas referências de itens dependentes.

A exclusão de um `OrderItem` deverá remover suas referências externas dependentes.

A exclusão da referência não deverá apagar automaticamente o `OrderItem` por efeito inverso da relação.

#### Unicidade

Deverão ser protegidas pelo menos as seguintes garantias:

- `(externalOrderReferenceId, externalItemId)` único;
- um mesmo `OrderItem` não poderá ser vinculado duas vezes à mesma `ExternalOrderReference`.

Não tornar `externalItemId` globalmente único, pois canais e pedidos distintos podem reutilizar o mesmo identificador.

Também não tornar `orderItemId` globalmente único na tabela de referência, pois o desenho deve continuar permitindo que um mesmo pedido canônico possua referências externas distintas quando arquiteturalmente necessário.

#### Integridade do pedido

Uma `ExternalOrderItemReference` somente poderá relacionar:

- um `OrderItem` pertencente ao mesmo `Order`;
- uma `ExternalOrderReference` pertencente a esse mesmo `Order`.

Essa integridade deverá ser validada dentro da transação de ingestão antes de qualquer escrita.

Não será permitido relacionar item de um pedido canônico com referência externa pertencente a outro pedido.

#### Criação de novo pedido externo

Depois da estrutura estar implementada, a criação de um novo pedido externo deverá produzir atomicamente:

`Order + OrderItem(s) + ExternalOrderReference + ExternalOrderItemReference(s)`

Se qualquer vínculo de item falhar, toda a criação deverá sofrer rollback.

Não poderá existir novo `OrderItem` externo sem sua identidade de linha quando o fluxo já estiver utilizando esta nova estrutura.

#### Pedido externo existente

A existência de `ExternalOrderItemReference` permitirá futuramente a reconciliação segura:

- `externalItemId` já conhecido -> localizar e atualizar o mesmo `OrderItem`;
- `externalItemId` novo -> criar novo `OrderItem` e sua referência;
- item omitido de resposta parcial -> preservar;
- remoção/cancelamento -> somente mediante sinal explícito e confiável da origem.

A lógica efetiva de atualização, criação ou remoção de itens ainda não será implementada neste micro-checkpoint.

#### Pedidos existentes sem referência de item

Pedidos externos criados antes da ativação de `ExternalOrderItemReference` poderão possuir `OrderItem` canônicos sem identidade externa de linha vinculada.

Esses itens não poderão ser associados automaticamente a um `externalItemId` posterior usando:

- `title`;
- `sku`;
- posição no array;
- preço;
- quantidade;
- combinação desses campos.

Enquanto não existir um vínculo confiável, a ausência de `ExternalOrderItemReference` em um pedido já existente deverá ser tratada como estado legado não reconciliável automaticamente.

Nesse cenário:

- não presumir que um `externalItemId` recebido representa necessariamente um item novo;
- não criar automaticamente um novo `OrderItem` apenas porque a referência externa ainda não existe;
- não substituir nem apagar `OrderItem` existente;
- preservar os itens canônicos atuais;
- permitir que status, comprador, destinatário e demais campos independentes continuem sendo sincronizados normalmente;
- exigir uma estratégia explícita e segura de bootstrap/backfill antes de habilitar reconciliação automática desses itens.

O bootstrap de referências históricas será uma etapa separada e não poderá usar heurísticas frágeis para inventar correspondências.

Depois que um pedido possuir cobertura confiável de identidade externa para seus itens, ele poderá entrar no fluxo normal de reconciliação por `externalItemId`.

Pedidos externos criados após a ativação completa desta estrutura deverão nascer já com `ExternalOrderItemReference` para todos os seus itens, evitando a criação de novos casos legados.

#### Compatibilidade atual

Foi confirmado que atualmente:

- `NormalizedExternalOrderItem` ainda não possui `externalItemId`;
- não existe `ExternalOrderItemReference` no código ou no Prisma;
- `ExternalOrderIngestionService` ainda não está registrado no `OrdersModule`;
- não existe endpoint ou conector ativo utilizando esse contrato;
- a criação atual gera `OrderItem(s)` e `ExternalOrderReference` dentro da mesma transação serializável.

Portanto, a introdução futura da identidade de item poderá ser feita de forma controlada antes da exposição pública do motor.

#### Limites deste micro-checkpoint

Ainda não:

- alterar `NormalizedExternalOrderItem`;
- alterar `schema.prisma`;
- criar migration;
- reconciliar `OrderItem`;
- modificar o fluxo de criação;
- criar endpoint;
- registrar `ExternalOrderIngestionService` no `OrdersModule`;
- criar conector de marketplace;
- executar `prisma format`;
- atualizar Prisma.

### Micro-checkpoint — externalItemId incorporado ao contrato normalizado

A primeira parte estrutural da identidade externa dos itens foi implementada no contrato normalizado.

`NormalizedExternalOrderItem` agora possui obrigatoriamente:

`externalItemId: string`

Neste micro-passo foi alterado somente:

`apps/api/src/modules/orders/types/normalized-external-order.ts`

Nenhuma validação de runtime de `externalItemId` foi adicionada ainda.

Também não foram alterados:

- `ExternalOrderIngestionService`;
- `schema.prisma`;
- migrations;
- `OrderItem`;
- `ExternalOrderReference`;
- fluxo de criação de pedido externo;
- fluxo de atualização de pedido externo.

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter ./apps/api build` — aprovado.

A introdução do campo no contrato não apresentou erro de compilação.

Este checkpoint ainda não cria `ExternalOrderItemReference` e não habilita reconciliação de itens.

O próximo passo estrutural deverá ser preparado somente depois deste contrato estar protegido no Git.

### Micro-checkpoint — estrutura Prisma de ExternalOrderItemReference

A estrutura Prisma para a identidade externa estável dos itens foi preparada.

Foi criado o model:

`ExternalOrderItemReference`

com os campos:

- `id`;
- `orderItemId`;
- `externalOrderReferenceId`;
- `externalItemId`;
- `createdAt`;
- `updatedAt`.

Foram adicionadas as relações:

`ExternalOrderReference -> ExternalOrderItemReference -> OrderItem`

com `onDelete: Cascade` nas referências dependentes.

Foram definidas as seguintes garantias estruturais:

- `(externalOrderReferenceId, externalItemId)` é único;
- `(externalOrderReferenceId, orderItemId)` é único;
- `orderItemId` possui índice próprio.

Também foram adicionadas as relações reversas em:

- `OrderItem`;
- `ExternalOrderReference`.

Este micro-passo alterou somente:

`packages/db/prisma/schema.prisma`

Ainda não existe migration para esta estrutura.

Também não foram alterados:

- `ExternalOrderIngestionService`;
- fluxo de criação de pedido externo;
- fluxo de atualização de pedido externo;
- reconciliação de `OrderItem`;
- validação de runtime de `externalItemId`;
- endpoints;
- `OrdersModule`.

A integridade que exige que o `OrderItem` pertença ao mesmo `Order` da `ExternalOrderReference` não é garantida somente por estas FKs e deverá ser validada transacionalmente no serviço em etapa posterior.

Validações realizadas:

- `git diff --check` — aprovado;
- `prisma validate` — aprovado;
- `prisma generate` com Prisma `6.19.1` — aprovado.

O aviso de versão mais nova do Prisma foi ignorado intencionalmente. Nenhuma atualização de Prisma foi realizada.

Nenhum `prisma format` foi executado.

Este checkpoint ainda não altera o banco de dados.

### Micro-checkpoint — migration de ExternalOrderItemReference

A migration correspondente à estrutura de identidade externa dos itens foi criada e validada no banco de teste.

Migration:

`20260912185200_add_external_order_item_reference`

A migration cria somente a tabela:

`ExternalOrderItemReference`

com:

- chave primária em `id`;
- índice em `orderItemId`;
- unicidade de `(externalOrderReferenceId, externalItemId)`;
- unicidade de `(externalOrderReferenceId, orderItemId)`;
- FK de `orderItemId` para `OrderItem(id)` com `ON DELETE CASCADE`;
- FK de `externalOrderReferenceId` para `ExternalOrderReference(id)` com `ON DELETE CASCADE`.

O SQL gerado foi revisado antes da aplicação e não contém operações destrutivas sobre tabelas existentes.

A migration foi aplicada somente no banco de teste:

`marto_ops_test`

Resultado:

- antes: 65 migrations;
- depois: 66 migrations;
- `prisma migrate status` confirmou `Database schema is up to date!`.

A estrutura física também foi conferida diretamente no PostgreSQL com `\d "ExternalOrderItemReference"` e corresponde ao schema planejado.

O banco normal `marto` não foi alterado.

Ainda não foram implementados:

- validação de runtime de `externalItemId`;
- criação automática de `ExternalOrderItemReference` no fluxo de pedido externo;
- reconciliação de `OrderItem`;
- bootstrap/backfill de pedidos legados;
- alterações no `ExternalOrderIngestionService`;
- endpoints;
- registro do serviço no `OrdersModule`.

Nenhum `prisma format` foi executado e nenhuma atualização do Prisma foi realizada.

### Micro-checkpoint — validação de runtime de externalItemId

A validação de runtime de `externalItemId` foi adicionada ao fluxo de criação de pedidos externos.

A alteração foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Dentro de `validateCreateInput()`, cada item agora exige um `externalItemId` válido.

Regras implementadas:

- `externalItemId` deve ser uma string não vazia após `trim()`;
- valor ausente ou inválido é rejeitado;
- string vazia ou contendo somente espaços é rejeitada;
- `externalItemId` deve ser único dentro do mesmo pedido externo;
- a verificação de duplicidade considera o valor normalizado com `trim()`.

Exemplo:

`item-1`

e

` item-1 `

são considerados a mesma identidade e a criação é rejeitada.

Nenhuma referência de item é criada ainda neste micro-passo.

Também não foram alterados:

- `schema.prisma`;
- migrations;
- fluxo de atualização de itens;
- reconciliação de `OrderItem`;
- bootstrap/backfill de pedidos legados;
- endpoints;
- `OrdersModule`.

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter ./apps/api build` — aprovado;
- teste pelo método público `ingest()` no banco `marto_ops_test`.

Casos testados:

- `externalItemId` ausente — rejeitado;
- `externalItemId` contendo somente espaços — rejeitado;
- dois itens com o mesmo `externalItemId` após `trim()` — rejeitados.

Nos três casos o resultado foi o erro esperado.

Também foi confirmado:

`REFERENCIAS_CRIADAS=0`

Nenhuma `ExternalOrderReference` foi criada pelos casos inválidos.

O runner utilizado para o teste foi temporário e foi removido após a validação.

Este checkpoint ainda não cria `ExternalOrderItemReference` automaticamente junto com novos pedidos externos.

### Micro-checkpoint — criação atômica das referências externas de item

O fluxo de criação de novos pedidos externos passou a criar também as referências externas de cada item.

A alteração foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

A criação permanece dentro da mesma transação `Serializable`.

A sequência transacional agora é:

`Order -> ExternalOrderReference -> OrderItem(s) -> ExternalOrderItemReference(s)`

Para cada item normalizado:

- `externalItemId` é normalizado com `trim()`;
- `externalItemId` não é armazenado em `OrderItem`;
- o `OrderItem` canônico é criado normalmente;
- uma `ExternalOrderItemReference` é criada ligando esse `OrderItem` à `ExternalOrderReference`;
- a identidade externa persistida é o `externalItemId` normalizado.

Depois das gravações, o `Order` é relido com os mesmos dados retornados anteriormente:

- `items`;
- `externalOrderReferences`.

Assim, o formato atual do retorno de criação foi preservado.

Atomicidade:

Se qualquer etapa falhar, toda a transação é revertida.

Foram realizados testes controlados no banco:

`marto_ops_test`

Teste de criação válida com dois itens:

- `SUCCESS_ACTION=create`;
- `SUCCESS_ITEMS=2`;
- `SUCCESS_ORDER_REFS=1`;
- `SUCCESS_ITEM_REFS=2`;
- `SUCCESS_EXTERNAL_ITEM_IDS=line-1,line-2`;
- `SUCCESS_SAME_ORDER=true`.

Isso confirmou que:

- os dois `OrderItem` foram criados;
- cada item recebeu uma `ExternalOrderItemReference`;
- o `externalItemId` foi persistido já normalizado;
- todas as referências de item pertencem ao mesmo `Order` da `ExternalOrderReference`.

Também foi executado um teste de rollback provocando falha durante `tx.orderItem.create()` depois do início da transação.

Resultado:

- `ROLLBACK_REFERENCES=0`;
- `ROLLBACK_ORDERS=0`.

Portanto, nenhuma criação parcial permaneceu no banco após a falha.

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter ./apps/api build` — aprovado;
- criação atômica com dois itens — aprovada;
- rollback total após falha durante criação — aprovado.

O runner utilizado nos testes foi temporário e foi removido.

Ainda não foram implementados:

- reconciliação de itens em pedidos externos já existentes;
- criação automática de novos itens durante atualização;
- remoção/cancelamento de itens;
- bootstrap/backfill de pedidos legados sem `ExternalOrderItemReference`;
- endpoints;
- registro do serviço no `OrdersModule`.

Nenhuma alteração adicional de Prisma ou migration foi necessária neste micro-passo.

### Micro-checkpoint — leitura transacional da identidade dos itens no update

O fluxo de atualização de pedidos externos passou a carregar, dentro da mesma transação `Serializable`, os dados mínimos necessários para classificar o estado de identidade dos itens.

No `existingReference` agora também são lidos:

- os `OrderItem` pertencentes ao `Order`, somente com `id`;
- as `ExternalOrderItemReference` pertencentes à referência externa, com:
  - `id`;
  - `orderItemId`;
  - `externalItemId`.

A alteração foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Este micro-passo é somente de leitura.

Não foram adicionadas ainda:

- classificação de pedido legado;
- reconciliação de itens;
- criação de `OrderItem` durante atualização;
- criação de `ExternalOrderItemReference` durante atualização;
- atualização ou remoção de itens existentes;
- associação automática por SKU, título, posição, quantidade ou preço.

O comportamento atual de atualização permanece preservado.

A fixture legada `ops-test-order-001` foi inspecionada no banco `marto_ops_test` e possui:

- 1 `OrderItem` canônico;
- 0 `ExternalOrderItemReference`.

Também foi confirmado que as três referências externas legadas atualmente presentes no banco de teste possuem itens canônicos, mas nenhuma referência externa de item.

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter ./apps/api build` — aprovado.

Este checkpoint apenas prepara os dados necessários para que a próxima etapa consiga distinguir com segurança pedido legado de pedido com identidade externa de item já estabelecida.

### Micro-checkpoint — classificação segura do estado de identidade dos itens

Após a leitura transacional dos `OrderItem` e das `ExternalOrderItemReference`, o fluxo de atualização passou a classificar internamente o estado de identidade dos itens.

A classificação ocorre somente depois da proteção contra sincronização stale e ainda não executa nenhuma reconciliação ou escrita de item.

Estados definidos:

- `items_omitted`
  - o payload de atualização não trouxe `items`;
  - os itens existentes devem permanecer preservados.

- `legacy_unlinked`
  - existem `OrderItem` canônicos;
  - não existe nenhuma `ExternalOrderItemReference` para aquela referência externa;
  - representa o estado legado que não pode ter vínculos inferidos automaticamente.

- `identified_complete`
  - existem `OrderItem` canônicos;
  - a quantidade de `ExternalOrderItemReference` é igual à quantidade de itens canônicos;
  - todas as referências externas apontam para `OrderItem` pertencentes ao mesmo `Order`;
  - somente este estado representa cobertura completa de identidade para futura reconciliação.

- `empty_unidentified`
  - não existem `OrderItem`;
  - não existem `ExternalOrderItemReference`;
  - o estado fica separado do legado para não assumir comportamento automaticamente.

- `inconsistent`
  - existe identidade parcial ou estruturalmente incoerente;
  - não deve ser tratada como identidade completa.

Para validar a integridade estrutural, os IDs dos `OrderItem` do pedido são carregados em um `Set` e cada `ExternalOrderItemReference.orderItemId` precisa pertencer a esse conjunto.

A classificação foi adicionada em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Este micro-passo ainda não:

- cria `OrderItem`;
- altera `OrderItem`;
- remove `OrderItem`;
- cria `ExternalOrderItemReference`;
- altera `ExternalOrderItemReference`;
- associa item legado por SKU, título, posição, quantidade ou preço;
- executa reconciliação;
- executa bootstrap/backfill;
- altera o resultado atual da sincronização com base em `itemIdentityState`.

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter ./apps/api build` — aprovado.

A variável `itemIdentityState` permanece apenas como classificação interna preparatória. Nenhuma decisão operacional de reconciliação utiliza essa classificação neste checkpoint.

### Micro-checkpoint — extração da validação comum de itens externos

As validações estruturais dos itens externos foram extraídas de `validateCreateInput()` para um método reutilizável:

`validateExternalItems()`.

O método concentra as seguintes regras já existentes:

- `externalItemId` obrigatório após `trim`;
- `externalItemId` único dentro do pedido externo;
- título obrigatório;
- quantidade inteira maior que zero;
- `unitPrice` válido, finito e maior ou igual a zero.

As regras exclusivas da criação permanecem em `validateCreateInput()`:

- `canonicalStatus` obrigatório;
- pelo menos um item obrigatório.

`validateCreateInput()` continua chamando a validação comum dos itens, preservando o comportamento anterior da criação.

Neste checkpoint, `validateExternalItems()` ainda não é chamado pelo fluxo de atualização.

Não foram alterados:

- `itemIdentityState`;
- regras de `productId`;
- criação de `OrderItem`;
- atualização de `OrderItem`;
- criação ou alteração de `ExternalOrderItemReference`;
- reconciliação de itens;
- comportamento de pedidos legados.

A alteração foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter ./apps/api build` — aprovado.

Este micro-passo é somente uma refatoração preparatória para evitar critérios diferentes entre criação e futura atualização de itens externos.

### Micro-checkpoint — validação condicional de itens no update com identidade completa

O fluxo de atualização de pedidos externos passou a aplicar `validateExternalItems()` somente quando os itens possuem identidade externa completa e o payload de atualização realmente contém `items`.

A validação ocorre somente quando:

- `itemIdentityState === 'identified_complete'`;
- `normalized.items !== undefined`.

A chamada é executada depois da proteção contra sincronização stale e antes das demais atualizações do pedido.

Com isso:

- payload stale continua sendo ignorado antes de qualquer validação de item;
- `items_omitted` não executa validação de itens;
- `legacy_unlinked` não executa validação de itens;
- `empty_unidentified` não executa validação de itens;
- `inconsistent` não executa validação de itens;
- somente `identified_complete` permite que o conteúdo de `items` seja tratado como validável nesta etapa.

Pedidos legados continuam protegidos: mesmo que o payload traga `items`, nenhum vínculo é inferido e os itens não impedem, por si só, a sincronização dos demais campos do pedido.

Para pedidos com identidade completa, um payload de itens inválido pode interromper a atualização transacional antes das escritas, utilizando as mesmas regras estruturais já aplicadas à criação.

As regras validadas são:

- `externalItemId` obrigatório;
- `externalItemId` único dentro do pedido externo;
- título obrigatório;
- quantidade inteira maior que zero;
- `unitPrice` válido, finito e maior ou igual a zero.

Este checkpoint ainda não:

- cria `OrderItem`;
- atualiza `OrderItem`;
- remove `OrderItem`;
- cria ou altera `ExternalOrderItemReference`;
- compara conteúdo do item recebido com o item canônico;
- executa reconciliação;
- associa item legado;
- executa bootstrap/backfill.

A alteração foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter ./apps/api build` — aprovado.

Este micro-passo apenas estabelece quando um payload de itens já pode ser considerado estruturalmente validável. Nenhuma escrita de item foi adicionada.

### Micro-checkpoint — correspondência somente-leitura por externalItemId

Para pedidos em estado `identified_complete` com `items` presentes e estruturalmente válidos, o fluxo de atualização passou a preparar uma correspondência interna entre os itens recebidos e as referências externas já existentes.

A correspondência utiliza exclusivamente:

`externalItemId recebido -> ExternalOrderItemReference -> OrderItem`

Foi criado um `Map` indexado pelo `externalItemId` persistido em `existingReference.externalItems`.

Para cada item recebido é produzido internamente:

- `externalItemId`;
- `externalOrderItemReferenceId`, quando houver correspondência;
- `orderItemId`, quando houver correspondência.

Quando o `externalItemId` recebido não possui referência externa correspondente:

- `externalOrderItemReferenceId` fica `null`;
- `orderItemId` fica `null`.

Neste checkpoint, ausência de correspondência não significa automaticamente item novo e não gera nenhuma escrita.

Não existe fallback de correspondência por:

- SKU;
- título;
- posição no array;
- quantidade;
- preço;
- combinação desses campos.

A correspondência é preparada somente dentro do estado `identified_complete`, após `validateExternalItems()`.

A variável `incomingItemMatches` ainda não controla nenhuma decisão operacional.

Este checkpoint ainda não:

- cria `OrderItem`;
- atualiza `OrderItem`;
- remove `OrderItem`;
- cria ou altera `ExternalOrderItemReference`;
- rejeita `externalItemId` desconhecido;
- interpreta ausência no payload como remoção;
- executa reconciliação;
- associa itens legados;
- executa bootstrap/backfill.

A alteração foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter ./apps/api build` — aprovado.

Este micro-passo apenas prepara uma correspondência determinística por identidade externa já estabelecida, sem alterar dados.

### Micro-checkpoint — classificação do resultado da correspondência dos itens

Após a correspondência somente-leitura por `externalItemId`, o fluxo de atualização passou a classificar internamente o resultado do conjunto recebido.

A classificação ocorre somente para pedidos em estado `identified_complete`, com `items` presentes e estruturalmente válidos.

Estados definidos:

- `items_empty`
  - o payload trouxe `items: []`;
  - não significa remoção dos itens existentes.

- `contains_unmatched`
  - pelo menos um `externalItemId` recebido não possui `ExternalOrderItemReference` correspondente;
  - neste checkpoint, isso não significa automaticamente item novo e não gera rejeição.

- `matched_complete_set`
  - todos os itens recebidos possuem correspondência;
  - a quantidade recebida é igual à quantidade de referências externas existentes;
  - representa cobertura completa do conjunto identificado.

- `matched_subset`
  - todos os itens recebidos possuem correspondência;
  - o payload contém somente parte das referências externas existentes;
  - itens ausentes no payload permanecem preservados.

A classificação utiliza `incomingItemMatches`, que já foi construído exclusivamente a partir de `externalItemId`.

A variável `incomingItemMatchState` ainda não controla nenhuma decisão operacional.

Neste checkpoint:

- `items: []` não remove itens;
- item ausente do payload não é considerado removido;
- `externalItemId` desconhecido não é rejeitado;
- `externalItemId` desconhecido não é criado automaticamente;
- nenhuma atualização de `OrderItem` ocorre;
- nenhuma alteração de `ExternalOrderItemReference` ocorre;
- nenhuma reconciliação é executada.

Não existe correspondência alternativa por SKU, título, posição, quantidade ou preço.

A alteração foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter ./apps/api build` — aprovado.

Este micro-passo apenas distingue os possíveis resultados da correspondência antes que qualquer política de reconciliação seja autorizada.

### Micro-checkpoint — elegibilidade preparatória para futura atualização de itens

Após a classificação do resultado da correspondência por `externalItemId`, o fluxo passou a classificar internamente se o conjunto recebido pode ser considerado elegível para uma futura atualização de itens.

Foi adicionada a variável:

`itemUpdateEligibility`

Estados definidos:

- `matched_items_only`
  - aplicado quando `incomingItemMatchState` é `matched_complete_set` ou `matched_subset`;
  - somente itens já correspondidos por identidade externa conhecida poderão ser considerados em uma futura etapa;
  - no caso de subset, itens ausentes continuam preservados.

- `blocked_unmatched`
  - aplicado quando `incomingItemMatchState` é `contains_unmatched`;
  - existe pelo menos um `externalItemId` recebido sem referência conhecida;
  - nenhuma escrita de item é autorizada neste checkpoint.

- `preserve_items`
  - aplicado aos demais estados, atualmente incluindo `items_empty`;
  - os itens canônicos existentes permanecem preservados.

Esta classificação ainda não possui efeito operacional.

Neste checkpoint:

- nenhum `OrderItem` é atualizado;
- nenhum `OrderItem` é criado;
- nenhum `OrderItem` é removido;
- nenhuma `ExternalOrderItemReference` é criada ou alterada;
- `blocked_unmatched` ainda não gera erro;
- `matched_items_only` ainda não executa update;
- `preserve_items` apenas expressa a política preparatória de preservação;
- não existe inferência por SKU, título, posição, quantidade ou preço;
- não existe interpretação de ausência no payload como remoção.

A alteração foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter ./apps/api build` — aprovado.

Este micro-passo apenas define a elegibilidade interna para uma futura reconciliação, sem executar qualquer escrita de item.

### Micro-checkpoint — leitura canônica ampliada para futura comparação de itens

Após a proteção da classificação de elegibilidade dos itens, a leitura transacional do pedido foi ampliada para disponibilizar os campos canônicos necessários a uma futura comparação segura dos itens correspondidos.

Antes deste micro-passo, `order.items` selecionava somente:

- `id`.

A leitura passou a incluir também:

- `productId`;
- `titleSnapshot`;
- `skuSnapshot`;
- `variationSnapshot`;
- `quantity`;
- `unitPrice`.

Esta ampliação ocorre dentro da mesma leitura transacional já utilizada pelo `updateExternalOrder()`.

Este checkpoint ainda é exclusivamente de leitura.

Neste micro-passo:

- nenhum `OrderItem` é atualizado;
- nenhum `OrderItem` é criado;
- nenhum `OrderItem` é removido;
- nenhuma `ExternalOrderItemReference` é criada ou alterada;
- `itemUpdateEligibility` continua sem controlar qualquer escrita;
- nenhuma comparação operacional entre payload e item canônico foi adicionada;
- nenhum campo recebido é aplicado ao item canônico;
- não existe inferência por SKU, título, posição, quantidade ou preço;
- ausência de item no payload continua sem significar remoção.

A alteração foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter ./apps/api build` — aprovado.

Este micro-passo apenas disponibiliza os dados canônicos necessários para uma futura comparação idempotente, sem executar reconciliação ou escrita de item.

### Micro-checkpoint — vínculo somente-leitura entre identidade externa e item canônico

Após a ampliação da leitura dos `OrderItem`, o fluxo passou a ligar em memória cada identidade externa já conhecida ao respectivo item canônico do pedido.

Foi criado o mapa:

`canonicalOrderItemsById`

Esse mapa utiliza:

`OrderItem.id -> OrderItem`

Durante a construção de `incomingItemMatches`, o fluxo agora:

1. normaliza e localiza o `externalItemId`;
2. encontra a `ExternalOrderItemReference`;
3. utiliza o `orderItemId` dessa referência;
4. localiza o `OrderItem` canônico correspondente;
5. inclui esse objeto no resultado como `canonicalOrderItem`.

A cadeia de identidade utilizada é:

`externalItemId -> ExternalOrderItemReference -> orderItemId -> OrderItem`

Este checkpoint continua exclusivamente de leitura e preparação.

Neste micro-passo:

- nenhum `OrderItem` é atualizado;
- nenhum `OrderItem` é criado;
- nenhum `OrderItem` é removido;
- nenhuma `ExternalOrderItemReference` é criada ou alterada;
- nenhum campo recebido é comparado operacionalmente com o item canônico;
- nenhuma diferença entre payload e estado canônico produz escrita;
- `itemUpdateEligibility` continua sem controlar qualquer escrita;
- item desconhecido continua sem ser criado ou rejeitado automaticamente;
- item ausente no payload continua sem significar remoção;
- não existe fallback de identidade por SKU, título, posição, quantidade ou preço.

A alteração foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter ./apps/api build` — aprovado.

Este micro-passo apenas disponibiliza, dentro de `incomingItemMatches`, o `OrderItem` canônico associado a uma identidade externa já conhecida.

### Micro-checkpoint — comparação escalar somente-leitura dos itens correspondidos

Após o vínculo entre a identidade externa e o `OrderItem` canônico, o fluxo passou a comparar em memória alguns campos simples do item recebido com os valores atualmente armazenados no item canônico.

Foi adicionada a estrutura:

`scalarItemComparison`

A comparação é produzida somente quando existe `canonicalOrderItem`. Caso contrário, o resultado permanece `null`.

Campos comparados neste checkpoint:

- `titleMatches`
  - compara `titleSnapshot` com `item.title.trim()`.

- `skuMatches`
  - compara `skuSnapshot` com o SKU recebido normalizado por `trim()`;
  - SKU ausente ou vazio é normalizado para `null`, mantendo a mesma regra utilizada na criação.

- `quantityMatches`
  - compara a quantidade canônica com `item.quantity`.

- `unitPriceMatches`
  - converte o preço recebido para `Prisma.Decimal`;
  - compara com `OrderItem.unitPrice` utilizando `Decimal.equals()`.

Este checkpoint continua exclusivamente de leitura e análise.

Neste micro-passo:

- nenhum `OrderItem` é atualizado;
- nenhum `OrderItem` é criado;
- nenhum `OrderItem` é removido;
- nenhuma `ExternalOrderItemReference` é criada ou alterada;
- nenhuma diferença detectada produz escrita;
- `itemUpdateEligibility` continua sem controlar qualquer escrita;
- `productId` ainda não é comparado;
- `variationSnapshot` ainda não é comparado;
- item desconhecido continua sem ser criado ou rejeitado automaticamente;
- item ausente no payload continua sem significar remoção;
- não existe fallback de identidade por SKU, título, posição, quantidade ou preço.

A alteração foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter ./apps/api build` — aprovado.

Este micro-passo apenas detecta igualdade ou diferença de campos escalares simples em memória, sem executar reconciliação ou escrita.

### Micro-checkpoint — classificação somente-leitura da comparação escalar

Após a criação de `scalarItemComparison`, o fluxo passou a classificar em memória o resultado dessa comparação.

Foi adicionada a estrutura:

`scalarItemComparisonState`

Estados possíveis neste checkpoint:

- `not_comparable`
  - usado quando `scalarItemComparison` é `null`;
  - portanto, não existe `canonicalOrderItem` disponível para comparação.

- `matches`
  - usado somente quando todos os quatro campos escalares comparados são iguais:
    - `titleMatches`;
    - `skuMatches`;
    - `quantityMatches`;
    - `unitPriceMatches`.

- `differs`
  - usado quando existe comparação válida, mas pelo menos um dos quatro campos acima é diferente.

Este checkpoint continua exclusivamente de leitura e classificação em memória.

Neste micro-passo:

- nenhum `OrderItem` é atualizado;
- nenhum `OrderItem` é criado;
- nenhum `OrderItem` é removido;
- nenhuma `ExternalOrderItemReference` é criada ou alterada;
- `scalarItemComparisonState` não produz escrita;
- `scalarItemComparisonState` não controla `itemUpdateEligibility`;
- `itemUpdateEligibility` continua sem efeito operacional;
- `productId` continua fora da comparação;
- `variationSnapshot` continua fora da comparação;
- item desconhecido continua sem ser criado ou rejeitado automaticamente;
- item ausente no payload continua sem significar remoção;
- não existe fallback de identidade por SKU, título, posição, quantidade ou preço.

A alteração foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter ./apps/api build` — aprovado.

Este micro-passo apenas transforma o resultado das quatro comparações escalares em um estado explícito de análise, ainda sem executar reconciliação ou escrita.

### Micro-checkpoint — identificação somente-leitura das diferenças escalares

Após a criação de `scalarItemComparisonState`, o fluxo passou também a identificar em memória quais dos campos escalares suportados realmente divergem.

Foi adicionada a estrutura:

`scalarItemDifferences`

Semântica implementada:

- quando `scalarItemComparison` é `null`:
  - `scalarItemDifferences = null`;
  - não existe `OrderItem` canônico disponível para comparação.

- quando todos os quatro campos escalares comparados são iguais:
  - `scalarItemDifferences = []`.

- quando existe uma ou mais divergências:
  - `scalarItemDifferences` contém somente os nomes dos campos divergentes;
  - valores atualmente suportados:
    - `title`;
    - `sku`;
    - `quantity`;
    - `unitPrice`;
  - a lista é derivada exclusivamente de `scalarItemComparison` já calculado.

A ordem atual dos nomes segue a própria comparação:

1. `title`;
2. `sku`;
3. `quantity`;
4. `unitPrice`.

Este checkpoint continua exclusivamente de leitura e análise em memória.

Neste micro-passo:

- nenhum `OrderItem` é atualizado;
- nenhum `OrderItem` é criado;
- nenhum `OrderItem` é removido;
- nenhuma `ExternalOrderItemReference` é criada ou alterada;
- `scalarItemDifferences` não produz escrita;
- `scalarItemDifferences` não controla `itemUpdateEligibility`;
- `itemUpdateEligibility` continua sem efeito operacional;
- `productId` continua fora da comparação;
- `variationSnapshot` continua fora da comparação;
- identidade não é inferida por SKU, título, posição, quantidade ou preço;
- item ausente no payload continua sem significar remoção.

A alteração foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter api build` — aprovado;
- teste específico `external-order-ingestion.service.spec.ts` — 10 de 10 testes aprovados;
- suíte completa da API — 8 suítes e 17 de 17 testes aprovados.

Os testes automatizados atuais não possuem asserção direta sobre `scalarItemDifferences`, porque essa estrutura ainda permanece interna ao processamento e não produz saída ou efeito operacional observável. As suítes executadas confirmam ausência de regressão no comportamento já protegido.

Este micro-passo somente torna o estado `differs` explicável em memória, sem executar reconciliação ou escrita.

### Micro-checkpoint — detalhamento somente-leitura das diferenças escalares

Após `scalarItemDifferences`, o fluxo passou também a representar em memória os valores atual e recebido de cada campo escalar que já havia sido identificado como divergente.

Foi adicionada a estrutura:

`scalarItemDifferenceDetails`

Semântica implementada:

- quando não existe `OrderItem` canônico comparável:
  - `scalarItemDifferenceDetails = null`.

- quando existe item comparável e nenhum dos quatro campos escalares diverge:
  - `scalarItemDifferenceDetails = {}`.

- quando existe uma ou mais divergências:
  - a estrutura contém somente os campos realmente divergentes;
  - cada campo registra:
    - `current`: valor presente no `OrderItem` canônico;
    - `incoming`: valor normalizado recebido na atualização externa.

Campos atualmente suportados:

- `title`;
- `sku`;
- `quantity`;
- `unitPrice`.

Valores utilizados:

- `title`:
  - `current`: `canonicalOrderItem.titleSnapshot`;
  - `incoming`: `item.title.trim()`.

- `sku`:
  - `current`: `canonicalOrderItem.skuSnapshot`;
  - `incoming`: `normalizedSku`.

- `quantity`:
  - `current`: `canonicalOrderItem.quantity`;
  - `incoming`: `item.quantity`.

- `unitPrice`:
  - `current`: `canonicalOrderItem.unitPrice`;
  - `incoming`: `incomingUnitPrice`.

`unitPrice` permanece como `Prisma.Decimal` em memória; nenhuma conversão adicional ou persistência foi adicionada.

A estrutura reutiliza exclusivamente os resultados de `scalarItemComparison`.

Ela não cria uma segunda regra para determinar igualdade ou divergência.

Este checkpoint continua exclusivamente de leitura e análise em memória.

Neste micro-passo:

- nenhum `OrderItem` é atualizado;
- nenhum `OrderItem` é criado;
- nenhum `OrderItem` é removido;
- nenhuma `ExternalOrderItemReference` é criada ou alterada;
- `scalarItemDifferenceDetails` não produz escrita;
- `scalarItemDifferenceDetails` não controla `itemUpdateEligibility`;
- `itemUpdateEligibility` continua sem efeito operacional;
- `productId` continua fora da comparação;
- `variationSnapshot` continua fora da comparação;
- identidade não é inferida por SKU, título, posição, quantidade ou preço;
- item ausente no payload continua sem significar remoção;
- nenhuma exposição por endpoint foi adicionada.

A alteração foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Validações realizadas:

- `git diff --check` — aprovado;
- build da API com `pnpm --filter api build` — aprovado;
- teste específico `external-order-ingestion.service.spec.ts` — 10 de 10 testes aprovados;
- suíte completa da API — 8 suítes e 17 de 17 testes aprovados.

Os testes automatizados atuais não possuem asserção direta sobre `scalarItemDifferenceDetails`, porque essa estrutura permanece interna ao processamento e ainda não produz saída ou efeito operacional observável. As suítes executadas confirmam ausência de regressão no comportamento já protegido.

Este micro-passo somente detalha em memória diferenças já detectadas, sem executar reconciliação ou escrita.

### Micro-checkpoint — classificação somente-leitura da abrangência das diferenças escalares

Após `scalarItemDifferences` e `scalarItemDifferenceDetails`, o fluxo passou a classificar em memória a abrangência das diferenças escalares já identificadas.

Foi adicionada a estrutura:

`scalarItemDifferenceScope`

Semântica implementada:

- `scalarItemDifferences = null` -> `not_comparable`;
- `scalarItemDifferences = []` -> `no_differences`;
- exatamente uma diferença -> `single_field`;
- duas ou mais diferenças -> `multiple_fields`.

A classificação é derivada exclusivamente de `scalarItemDifferences` já calculado e não repete as comparações de `title`, `sku`, `quantity` ou `unitPrice`.

Este checkpoint continua exclusivamente de leitura e análise em memória.

Neste micro-passo:

- nenhum `OrderItem` é atualizado, criado ou removido;
- nenhuma `ExternalOrderItemReference` é criada ou alterada;
- `scalarItemDifferenceScope` não produz escrita;
- não controla `itemUpdateEligibility`;
- `productId` continua fora da comparação;
- `variationSnapshot` continua fora da comparação;
- identidade não é inferida por SKU, título, posição, quantidade ou preço;
- item ausente no payload continua sem significar remoção;
- nenhuma exposição por endpoint foi adicionada.

A alteração de código foi realizada somente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Validações realizadas:

- build da API — aprovado;
- teste específico `external-order-ingestion.service.spec.ts` — 10/10 aprovado;
- suíte completa da API — 8 suítes e 17/17 testes aprovados;
- `git diff --check` — aprovado.

Os testes atuais não possuem asserção direta sobre `scalarItemDifferenceScope`, pois a estrutura permanece interna e sem efeito operacional observável.

### Micro-checkpoint — resumo agregado das comparações escalares dos itens

Após a classificação individual por `scalarItemDifferenceScope`, o fluxo passou a produzir em memória um resumo agregado das comparações escalares dos itens recebidos.

Foi adicionada a estrutura:

`scalarItemComparisonSummary`

Ela é derivada exclusivamente de `incomingItemMatches` e dos valores de `scalarItemDifferenceScope` já calculados.

Campos implementados:

- `totalItems`;
- `comparableItems`;
- `notComparableItems`;
- `noDifferences`;
- `singleFieldDifferences`;
- `multipleFieldDifferences`.

Semântica implementada:

- `not_comparable`
  - incrementa `notComparableItems`;

- `no_differences`
  - incrementa `comparableItems`;
  - incrementa `noDifferences`;

- `single_field`
  - incrementa `comparableItems`;
  - incrementa `singleFieldDifferences`;

- `multiple_fields`
  - incrementa `comparableItems`;
  - incrementa `multipleFieldDifferences`.

Para `incomingItemMatches = []`, todos os contadores permanecem em zero.

Invariantes:

`totalItems = notComparableItems + noDifferences + singleFieldDifferences + multipleFieldDifferences`

`comparableItems = noDifferences + singleFieldDifferences + multipleFieldDifferences`

A estrutura não repete as comparações de `title`, `sku`, `quantity` ou `unitPrice`.

Este checkpoint continua exclusivamente de leitura e análise em memória.

Neste micro-passo:

- nenhum `OrderItem` foi atualizado, criado ou removido;
- nenhuma `ExternalOrderItemReference` foi criada ou alterada;
- `itemUpdateEligibility` não foi alterado;
- `scalarItemComparisonSummary` não produz escrita;
- nenhuma decisão operacional é tomada com base no resumo;
- `productId` continua fora da comparação;
- `variationSnapshot` continua fora da comparação;
- identidade não é inferida por SKU, título, posição, quantidade ou preço;
- item ausente no payload continua sem significar remoção;
- nenhuma exposição por endpoint foi adicionada;
- nenhuma alteração Prisma ou migration foi realizada.

Validações realizadas:

- build da API — aprovado;
- teste específico `external-order-ingestion.service.spec.ts` — 10/10 aprovado;
- suíte completa da API — 8 suítes e 17/17 testes aprovados;
- `git diff --check` — aprovado;
- alteração do serviço limitada a 37 linhas adicionadas.

Os testes atuais não possuem asserção direta sobre `scalarItemComparisonSummary`, porque a estrutura permanece interna e sem efeito operacional observável.

Checkpoint protegido no Git:

`182ee7a` — `feat(orders): resume comparacoes escalares dos itens`

### Micro-checkpoint — resumo das diferenças escalares por campo

Após `scalarItemComparisonSummary`, o fluxo passou também a resumir em memória em quais campos escalares estão concentradas as diferenças já identificadas.

Foi adicionada a estrutura:

`scalarItemDifferenceFieldSummary`

Ela é derivada exclusivamente de `scalarItemDifferences` já calculado em cada item de `incomingItemMatches`.

Campos implementados:

- `title`;
- `sku`;
- `quantity`;
- `unitPrice`.

Semântica implementada:

- `scalarItemDifferences = null`
  - não incrementa nenhum contador;

- `scalarItemDifferences = []`
  - não incrementa nenhum contador;

- presença de `title`
  - incrementa `title`;

- presença de `sku`
  - incrementa `sku`;

- presença de `quantity`
  - incrementa `quantity`;

- presença de `unitPrice`
  - incrementa `unitPrice`.

Um mesmo item pode incrementar mais de um contador.

Para `incomingItemMatches = []`, todos os contadores permanecem em zero.

A soma dos quatro contadores representa ocorrências de diferenças escalares e não necessariamente quantidade de itens divergentes.

Este checkpoint continua exclusivamente de leitura e análise em memória.

Neste micro-passo:

- nenhum `OrderItem` foi atualizado, criado ou removido;
- nenhuma `ExternalOrderItemReference` foi criada ou alterada;
- `itemUpdateEligibility` não foi alterado;
- nenhuma decisão operacional foi tomada com base no resumo;
- nenhuma comparação adicional de valores foi criada;
- `productId` permaneceu fora da comparação;
- `variationSnapshot` permaneceu fora da comparação;
- nenhuma identidade foi inferida por SKU, título, posição, quantidade ou preço;
- item ausente no payload continuou sem significar remoção;
- nenhuma exposição por endpoint foi criada;
- nenhuma alteração Prisma ou migration foi realizada.

Validações realizadas:

- build da API — aprovado;
- teste específico `external-order-ingestion.service.spec.ts` — 10/10 aprovado;
- suíte completa da API — 8 suítes e 17/17 testes aprovados;
- `git diff --check` — aprovado;
- alteração do serviço limitada a 28 linhas adicionadas.

Os testes atuais não possuem asserção direta sobre `scalarItemDifferenceFieldSummary`, porque a estrutura permanece interna e sem efeito operacional observável.

Checkpoint protegido no Git:

`6994ac2` — `feat(orders): resume diferencas escalares por campo`

### Micro-checkpoint — classificação da prontidão para futura reconciliação

Após `itemUpdateEligibility` e os resumos escalares, o fluxo passou a classificar em memória a situação atual da análise dos itens para uma futura reconciliação.

Foi adicionada a estrutura:

`scalarItemReconciliationReadiness`

Ela reutiliza exclusivamente:

- `itemUpdateEligibility`;
- `scalarItemComparisonSummary`.

Nenhuma comparação de item é repetida.

Estados implementados:

- `preserve_items`;
- `blocked_unmatched`;
- `blocked_not_comparable`;
- `no_scalar_changes`;
- `scalar_changes_detected`.

Precedência implementada:

1. `preserve_items`;
2. `blocked_unmatched`;
3. `blocked_not_comparable`;
4. `no_scalar_changes`;
5. `scalar_changes_detected`.

`blocked_not_comparable` permanece como classificação defensiva.

`scalar_changes_detected` não autoriza atualização de `OrderItem`.

`no_scalar_changes` não significa reconciliação completa do pedido, porque ainda existem dimensões fora da comparação, incluindo:

- `productId`;
- `variationSnapshot`.

Este checkpoint continua exclusivamente de leitura, classificação e análise em memória.

Neste micro-passo:

- nenhum `OrderItem` foi atualizado, criado ou removido;
- nenhuma `ExternalOrderItemReference` foi criada ou alterada;
- `itemUpdateEligibility` não foi modificado;
- nenhum estado de readiness executa escrita;
- item desconhecido não foi rejeitado automaticamente;
- nenhum backfill de item legado foi executado;
- identidade não foi inferida por SKU, título, posição, quantidade ou preço;
- item ausente no payload continuou sem significar remoção;
- `productId` permaneceu fora da comparação;
- `variationSnapshot` permaneceu fora da comparação;
- nenhuma persistência, endpoint, alteração Prisma ou migration foi criada.

Validações realizadas:

- build da API — aprovado;
- teste específico `external-order-ingestion.service.spec.ts` — 10/10 aprovado;
- suíte completa da API — 8 suítes e 17/17 testes aprovados;
- `git diff --check` — aprovado;
- alteração do serviço limitada a 12 linhas adicionadas.

Os testes atuais não possuem asserção direta sobre `scalarItemReconciliationReadiness`, porque a estrutura permanece interna e sem efeito operacional observável.

Checkpoint protegido no Git:

`7b69157` — `feat(orders): classifica prontidao para reconciliacao dos itens`

### Micro-checkpoint — comparação de productId

A definição de `productIdComparisonState` foi protegida inicialmente no Git em:

`81253bf` — `docs: define comparação de productId dos itens externos`

A implementação foi concluída, validada e protegida no Git em:

`16ce1e6` — `feat(orders): classifica comparacao de productId dos itens`

A implementação permanece exclusivamente de leitura e classificação em memória.

Estados implementados:

- `not_comparable`;
- `not_provided`;
- `invalid`;
- `matches`;
- `differs`.

A normalização implementada é:

- `undefined` -> ausência de valor comparável;
- `null` -> ausência de valor comparável;
- string fornecida -> `trim()`;
- string vazia após `trim()` -> `invalid`.

Nenhum estado executa escrita.

Neste checkpoint:

- `OrderItem.productId` não foi alterado;
- nenhuma associação automática entre produto e item foi criada;
- nenhuma `ExternalOrderItemReference` foi criada ou alterada;
- `itemUpdateEligibility` não foi alterado;
- `scalarItemReconciliationReadiness` não foi alterado;
- diferença de `productId` não executa relink automático;
- ausência ou valor inválido de `productId` não apaga vínculo canônico;
- nenhuma persistência adicional foi criada;
- nenhuma alteração Prisma ou migration foi realizada.

Validações realizadas:

- `git diff --check` — aprovado;
- build da API — aprovado;
- teste específico — 10/10 aprovado;
- suíte completa da API — 8 suítes e 17/17 testes aprovados.

Os testes atuais ainda não possuem asserção direta sobre `productIdComparisonState`, porque a estrutura continua interna e sem efeito operacional observável.

## 19. Próxima ação exata

O checkpoint documental que definiu `variationComparisonState` foi protegido no Git em:

`d6bbbb0` — `docs: define comparação estrutural de variation dos itens`

A implementação de `variationComparisonState` está concluída e validada localmente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Também foram adicionados testes focados em:

`apps/api/src/modules/orders/external-order-ingestion.service.spec.ts`

Foi adicionado o helper privado:

`areJsonValuesStructurallyEqual`

Objetivo do helper:

comparar valores JSON estruturalmente, sem depender da ordem textual das propriedades de objetos e sem mutar os valores comparados.

Regras implementadas:

- valores primitivos iguais pelo próprio valor retornam igualdade;
- `null` somente é igual a `null`;
- arrays:
  - precisam possuir o mesmo tamanho;
  - preservam relevância da ordem;
  - são comparados recursivamente posição por posição;
- objetos:
  - precisam possuir o mesmo conjunto de chaves;
  - ignoram a ordem original das propriedades;
  - são comparados recursivamente por chave;
  - chave ausente é diferente de chave presente com valor `null`;
- tipos estruturais incompatíveis resultam em diferença.

A implementação não:

- ordena ou reescreve os objetos;
- muta o valor recebido;
- muta o `variationSnapshot` canônico;
- converte ausência de propriedade em `null`.

Dentro de `incomingItemMatches` foi adicionada a estrutura:

`variationComparisonState`

Estados implementados:

- `not_comparable`
  - quando `canonicalOrderItem === null`;
  - possui precedência sobre os demais estados.

- `not_provided`
  - quando `item.variation === undefined`;
  - ausência não significa remoção de `variationSnapshot`.

- `matches`
  - quando `item.variation` foi fornecido;
  - existe item canônico correspondente;
  - a comparação estrutural retorna igualdade.

- `differs`
  - quando `item.variation` foi fornecido;
  - existe item canônico correspondente;
  - a comparação estrutural retorna diferença.

`variationComparisonState` foi incluído somente no objeto interno retornado por cada entrada de `incomingItemMatches`.

Neste micro-passo:

- nenhum `OrderItem` foi atualizado, criado ou removido;
- `OrderItem.variationSnapshot` não foi alterado;
- nenhuma `ExternalOrderItemReference` foi criada ou alterada;
- `productIdComparisonState` não foi alterado;
- `itemUpdateEligibility` não foi alterado;
- `scalarItemReconciliationReadiness` não foi alterado;
- `variationComparisonState` não autoriza escrita;
- diferença estrutural não executa atualização automática;
- ausência de `variation` não significa remoção;
- item desconhecido não é rejeitado automaticamente;
- nenhum backfill de item legado é executado;
- identidade não é inferida por SKU, título, posição, quantidade ou preço;
- ausência de item no payload continua sem significar remoção;
- nenhuma persistência adicional foi criada;
- nenhum endpoint foi adicionado;
- nenhum timestamp de lifecycle foi alterado;
- o serviço não foi registrado no `OrdersModule`;
- nenhum conector de marketplace foi criado;
- nenhuma alteração Prisma ou migration foi realizada.

Foram adicionados 10 testes focados para `areJsonValuesStructurallyEqual`.

Casos cobertos diretamente:

1. objetos com mesmas chaves e ordem diferente;
2. objetos com valores diferentes;
3. arrays iguais na mesma ordem;
4. arrays com os mesmos valores em ordem diferente;
5. objetos e arrays aninhados;
6. `null` comparado com `null`;
7. `null` comparado com valor não nulo;
8. chave ausente versus chave presente com `null`;
9. objetos com mesmas chaves e valores;
10. primitivas iguais e diferentes.

Validações executadas localmente:

- `git diff --check` no serviço
  - aprovado;

- `git diff --check` no arquivo de testes
  - aprovado;

- `pnpm --filter api build`
  - aprovado;

- `pnpm --filter api test -- external-order-ingestion.service.spec.ts`
  - 1 suíte aprovada;
  - 20 de 20 testes aprovados;
  - 10 testes anteriores preservados;
  - 10 testes estruturais novos aprovados;

- `pnpm --filter api test`
  - 8 de 8 suítes aprovadas;
  - 27 de 27 testes aprovados.

Com `variationComparisonState`, passam a estar cobertas para comparação as dimensões atualmente identificadas de item:

- título;
- SKU;
- quantidade;
- preço unitário;
- `productId`;
- `variationSnapshot`.

Isso ainda não significa reconciliação efetiva e não autoriza escrita automática.

O próximo passo autorizado é somente revisar e proteger este checkpoint no Git.

O commit deste checkpoint deverá conter apenas:

- implementação de `areJsonValuesStructurallyEqual`;
- implementação de `variationComparisonState`;
- testes focados da igualdade estrutural;
- documentação deste checkpoint.

Ainda não implementar:

- atualização efetiva de `OrderItem.variationSnapshot`;
- atualização efetiva de `OrderItem.productId`;
- atualização efetiva dos campos escalares de `OrderItem`;
- criação, remoção ou reconciliação efetiva de itens;
- uso de `variationComparisonState` para executar escrita;
- uso de `productIdComparisonState` para executar escrita;
- uso de `scalarItemReconciliationReadiness` para executar escrita;
- criação ou alteração de `ExternalOrderItemReference`;
- rejeição automática de item desconhecido;
- associação automática ou backfill de item legado;
- inferência de identidade por SKU, título, posição, quantidade ou preço;
- interpretação de ausência de item no payload como remoção;
- timestamps de lifecycle;
- endpoints;
- registro do serviço no `OrdersModule`;
- conectores de marketplace;
- alterações Prisma ou migrations.

O checkpoint acima foi protegido no Git em `aaf3040`. A partir dele, inicia-se abaixo a definição separada do plano consolidado de reconciliação dos itens.

### Plano consolidado de reconciliação dos itens — definição antes da implementação

Depois dos checkpoints já protegidos para:

- comparação dos campos escalares;
- `productIdComparisonState`;
- `variationComparisonState`;

o próximo passo deverá consolidar essas informações em uma decisão por item.

Essa nova estrutura continuará:

- somente em memória;
- somente analítica;
- sem atualizar `OrderItem`;
- sem alterar `ExternalOrderItemReference`;
- sem criar ou remover itens;
- sem executar relink de produto;
- sem interpretar ausência de item como remoção.

Nome conceitual proposto:

`itemReconciliationPlanState`

A estrutura deverá respeitar a identidade já resolvida por:

`externalItemId -> ExternalOrderItemReference -> orderItemId -> OrderItem`

Nenhuma identidade deverá ser inferida por:

- SKU;
- título;
- posição;
- quantidade;
- preço;
- `productId`;
- `variation`.

#### Precedência proposta

A classificação deverá usar a seguinte precedência conservadora.

##### 1. `blocked_not_comparable`

Aplicar quando não existe `canonicalOrderItem`.

Significado:

- não existe item canônico seguro para comparar;
- nenhuma atualização pode ser considerada segura;
- nenhuma tentativa de associação automática deverá ocorrer.

##### 2. `blocked_invalid_product_id`

Aplicar quando:

`productIdComparisonState === 'invalid'`

Significado:

- o campo foi fornecido;
- depois de normalização o valor é inválido;
- isso não autoriza remoção do vínculo existente;
- isso não autoriza relink;
- nenhuma atualização automática relacionada ao produto deverá ocorrer.

##### 3. `blocked_product_relink_required`

Aplicar quando:

`productIdComparisonState === 'differs'`

Significado:

- existe item canônico correspondente;
- existe `productId` externo válido;
- o `productId` recebido é diferente do vínculo canônico atual.

Essa situação não deverá ser tratada como atualização comum de snapshot.

Especialmente:

- diferença de `productId` não deverá ser misturada com diferença de título, SKU, quantidade, preço ou variação;
- nenhum relink automático deverá ocorrer;
- a divergência deverá permanecer bloqueada para uma política específica futura de vínculo entre `OrderItem` e `Product`.

Se houver simultaneamente:

- diferença escalar;
- diferença de `variation`;
- e diferença de `productId`;

a precedência deverá continuar sendo:

`blocked_product_relink_required`

Isso evita que uma possível troca de produto seja escondida dentro de uma atualização aparentemente comum de item.

##### 4. `snapshot_changes_detected`

Aplicar somente quando:

- existe `canonicalOrderItem`;
- `productIdComparisonState` é `matches` ou `not_provided`;
- e pelo menos uma das condições abaixo é verdadeira:
  - existe diferença nos campos escalares;
  - `variationComparisonState === 'differs'`.

Os campos de snapshot atualmente considerados são:

- `titleSnapshot`;
- `skuSnapshot`;
- `quantity`;
- `unitPrice`;
- `variationSnapshot`.

Esse estado significa somente:

há mudanças candidatas nos dados do item.

Ele ainda não autoriza escrita.

Não deverá:

- executar `update` em `OrderItem`;
- persistir `variationSnapshot`;
- alterar `productId`;
- atualizar referências externas;
- criar eventos;
- disparar automações.

##### 5. `no_changes`

Aplicar quando:

- existe `canonicalOrderItem`;
- todos os campos escalares comparáveis são iguais;
- `productIdComparisonState` é `matches` ou `not_provided`;
- `variationComparisonState` é `matches` ou `not_provided`.

Significado:

- nenhuma alteração candidata foi detectada para o item recebido;
- nenhuma escrita é necessária.

#### Campos opcionais e preservação

O contrato atual de `NormalizedExternalOrderItem` define:

- `productId?: string | null`;
- `sku?: string | null`;
- `variation?: Prisma.InputJsonValue`.

Portanto:

- ausência de `productId` não significa remover `OrderItem.productId`;
- `productId: null` também não significa remover o vínculo canônico;
- ausência de `variation` não significa remover `variationSnapshot`;
- ausência de item no payload não significa remover o `OrderItem` correspondente.

#### Conjunto parcial de itens

`incomingItemMatchState === 'matched_subset'` deverá continuar sendo permitido para análise dos itens efetivamente recebidos.

Os itens canônicos não presentes no payload deverão ser preservados.

Um payload parcial não deverá ser convertido automaticamente em:

- remoção de item;
- cancelamento de item;
- redução do conjunto canônico;
- desvinculação de referência externa.

#### Relação com estruturas existentes

`itemReconciliationPlanState` não deverá substituir:

- `itemIdentityState`;
- `incomingItemMatchState`;
- `itemUpdateEligibility`;
- `scalarItemReconciliationReadiness`;
- `productIdComparisonState`;
- `variationComparisonState`.

A nova camada deverá apenas consolidar as informações já produzidas por essas estruturas em uma intenção segura por item.

#### Etapa posterior

Depois da classificação individual estar definida e validada, poderá ser criada separadamente uma agregação do conjunto de itens para distinguir, por exemplo:

- conjunto sem mudanças;
- conjunto com mudanças candidatas de snapshot;
- conjunto contendo bloqueios;
- conjunto preservado por ausência ou falta de identidade segura.

Essa agregação também deverá ser inicialmente somente de leitura e em memória.

Ainda não implementar nesta etapa:

- atualização efetiva de snapshots;
- atualização ou troca de `productId`;
- criação de novos `OrderItem`;
- remoção de `OrderItem`;
- reconciliação automática de item desconhecido;
- backfill de referências;
- inferência de identidade;
- persistência de estados analíticos;
- endpoints;
- conectores;
- alterações Prisma;
- migrations.

### Implementação de `itemReconciliationPlanState`

A definição do plano consolidado de reconciliação dos itens foi protegida anteriormente no Git em:

`1283c5c` — `docs: define plano consolidado de reconciliacao dos itens`

A primeira implementação de `itemReconciliationPlanState` foi concluída localmente em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

Foi adicionado o helper privado:

`getItemReconciliationPlanState`

O helper recebe somente informações já calculadas em memória:

- existência ou não de `canonicalOrderItem`;
- `productIdComparisonState`;
- `variationComparisonState`;
- `scalarItemComparisonState`.

Ele não consulta o banco e não executa persistência.

A precedência implementada é:

1. `blocked_not_comparable`
   - quando não existe `canonicalOrderItem`.

2. `blocked_invalid_product_id`
   - quando `productIdComparisonState === 'invalid'`.

3. `blocked_product_relink_required`
   - quando `productIdComparisonState === 'differs'`.

4. `snapshot_changes_detected`
   - quando existe item canônico;
   - o `productId` não está bloqueado;
   - e existe diferença escalar ou diferença de `variation`.

5. `no_changes`
   - quando nenhuma das condições anteriores é atendida.

Essa precedência garante especialmente que:

- ausência de item canônico bloqueia a reconciliação;
- `productId` inválido vence sobre diferenças de snapshot;
- divergência de `productId` vence sobre diferenças escalares ou de `variation`;
- uma possível troca de produto não é escondida dentro de uma atualização comum de snapshot.

Dentro de `incomingItemMatches`, cada item recebido passa a carregar também:

`itemReconciliationPlanState`

Esse estado continua exclusivamente interno e analítico.

Neste checkpoint:

- nenhum `OrderItem` foi atualizado;
- nenhum `OrderItem` foi criado;
- nenhum `OrderItem` foi removido;
- nenhum `OrderItem.productId` foi alterado;
- nenhum `variationSnapshot` foi persistido;
- nenhuma diferença escalar foi persistida;
- nenhuma `ExternalOrderItemReference` foi criada ou alterada;
- nenhum relink automático de produto foi executado;
- nenhuma identidade foi inferida por SKU, título, posição, quantidade, preço, `productId` ou `variation`;
- ausência de item no payload continua sem significar remoção;
- `itemUpdateEligibility` não foi alterado;
- `scalarItemReconciliationReadiness` não foi alterado;
- nenhum endpoint foi criado;
- nenhum evento adicional foi criado;
- nenhum conector foi criado;
- nenhuma alteração Prisma ou migration foi realizada.

Foram adicionados 7 testes focados para `getItemReconciliationPlanState`.

Casos cobertos diretamente:

1. ausência de item canônico resulta em `blocked_not_comparable`;
2. `productId` inválido possui precedência sobre diferenças de snapshot;
3. divergência de `productId` possui precedência sobre diferenças de snapshot;
4. diferença escalar com identidade de produto segura resulta em `snapshot_changes_detected`;
5. diferença de `variation` com identidade de produto segura resulta em `snapshot_changes_detected`;
6. valores fornecidos e iguais resultam em `no_changes`;
7. ausência de `productId` e `variation`, sem diferença escalar, resulta em `no_changes`.

Validações executadas localmente:

- `git diff --check`
  - aprovado para o serviço e o arquivo de testes;

- `pnpm --filter api build`
  - aprovado;

- `pnpm --filter api test -- external-order-ingestion.service.spec.ts`
  - 1 suíte aprovada;
  - 27 de 27 testes aprovados;
  - 7 testes novos de `getItemReconciliationPlanState` aprovados;

- `pnpm --filter api test`
  - 8 de 8 suítes aprovadas;
  - 34 de 34 testes aprovados.

A implementação atual ainda não constitui reconciliação efetiva.

Ela apenas transforma as comparações já existentes em uma intenção segura por item.

A etapa seguinte prevista é avaliar uma agregação do conjunto de `itemReconciliationPlanState` para distinguir, ainda somente em memória:

- conjunto sem mudanças;
- conjunto com mudanças candidatas;
- conjunto contendo bloqueios;
- conjunto que deve ser preservado.

Ainda não implementar:

- escrita efetiva dos snapshots;
- atualização de `productId`;
- relink de produto;
- criação ou remoção de itens;
- reconciliação automática de item desconhecido;
- backfill;
- inferência de identidade;
- persistência dos estados analíticos;
- endpoints;
- conectores;
- alterações Prisma;
- migrations.

### Agregação do conjunto de reconciliação — definição antes da implementação

O checkpoint anterior implementou e validou:

`itemReconciliationPlanState`

Esse estado responde individualmente o que cada item recebido representa.

O próximo passo deverá agregar esses estados para produzir uma visão do conjunto recebido, ainda:

- somente em memória;
- somente analítica;
- sem atualizar `OrderItem`;
- sem criar ou remover itens;
- sem alterar `ExternalOrderItemReference`;
- sem executar relink de produto;
- sem interpretar ausência de item como remoção.

A agregação não deverá substituir:

- `itemIdentityState`;
- `incomingItemMatchState`;
- `itemUpdateEligibility`;
- `scalarItemReconciliationReadiness`;
- `itemReconciliationPlanState`.

Cada estrutura continuará respondendo uma pergunta diferente.

#### `itemReconciliationPlanSummary`

Deverá ser criado um resumo quantitativo dos estados individuais.

Estrutura conceitual proposta:

`itemReconciliationPlanSummary`

Campos:

- `totalItems`
  - quantidade total de itens recebidos e analisados.

- `noChanges`
  - quantidade de itens com `itemReconciliationPlanState === 'no_changes'`.

- `snapshotChangesDetected`
  - quantidade de itens com `itemReconciliationPlanState === 'snapshot_changes_detected'`.

- `blockedNotComparable`
  - quantidade de itens com `itemReconciliationPlanState === 'blocked_not_comparable'`.

- `blockedInvalidProductId`
  - quantidade de itens com `itemReconciliationPlanState === 'blocked_invalid_product_id'`.

- `blockedProductRelinkRequired`
  - quantidade de itens com `itemReconciliationPlanState === 'blocked_product_relink_required'`.

- `blockedItems`
  - soma de todos os estados individuais bloqueados.

`blockedItems` deverá ser derivado exclusivamente de:

- `blocked_not_comparable`;
- `blocked_invalid_product_id`;
- `blocked_product_relink_required`.

O resumo não deverá:

- alterar nenhum estado individual;
- decidir escrita;
- persistir dados;
- ocultar o motivo específico de um bloqueio.

#### `itemReconciliationSetState`

Além do resumo quantitativo, deverá existir uma classificação agregada do conjunto.

Nome conceitual proposto:

`itemReconciliationSetState`

A precedência deverá ser:

##### 1. `preserve_items`

Aplicar quando:

`itemUpdateEligibility === 'preserve_items'`

Significado:

- o conjunto recebido não deve entrar em reconciliação;
- os itens canônicos devem ser preservados;
- nenhuma ausência deve ser interpretada como remoção.

##### 2. `blocked_unmatched`

Aplicar quando:

`itemUpdateEligibility === 'blocked_unmatched'`

Significado:

- o payload contém pelo menos um item sem correspondência segura;
- nenhuma identidade deverá ser inferida;
- a reconciliação do conjunto permanece bloqueada.

Esse estado deverá ter precedência sobre qualquer mudança detectada nos itens que conseguiram ser identificados.

##### 3. `blocked_item_reconciliation`

Aplicar quando:

- `itemUpdateEligibility === 'matched_items_only'`;
- e `itemReconciliationPlanSummary.blockedItems > 0`.

Significado:

- os itens recebidos foram associados por identidade segura;
- porém pelo menos um item possui bloqueio individual de reconciliação.

Exemplos de causas:

- `productId` inválido;
- divergência de `productId` que exige política específica de relink.

`blocked_not_comparable` continua existindo no resumo individual como estado defensivo e diagnóstico.

Porém, no fluxo consistente atual, quando um item recebido não possui correspondência segura por `externalItemId`, ele produz `orderItemId === null` e o conjunto é classificado antes como:

`blocked_unmatched`

Por isso, `blocked_not_comparable` não deverá ser tratado como causa normal de `blocked_item_reconciliation` enquanto as invariantes atuais de identidade e unicidade forem preservadas.

Se houver simultaneamente:

- itens sem mudança;
- itens com mudanças candidatas de snapshot;
- e pelo menos um item bloqueado;

o estado do conjunto deverá continuar sendo:

`blocked_item_reconciliation`

Um bloqueio não deverá ser escondido por mudanças aparentemente seguras em outros itens.

##### 4. `snapshot_changes_detected`

Aplicar quando:

- `itemUpdateEligibility === 'matched_items_only'`;
- `itemReconciliationPlanSummary.blockedItems === 0`;
- e `itemReconciliationPlanSummary.snapshotChangesDetected > 0`.

Significado:

- não há bloqueio individual;
- existe pelo menos uma mudança candidata de snapshot entre os itens recebidos.

Esse estado ainda não autoriza escrita.

##### 5. `no_changes`

Aplicar quando:

- `itemUpdateEligibility === 'matched_items_only'`;
- não existe item bloqueado;
- não existe `snapshot_changes_detected`.

Significado:

- os itens recebidos e comparáveis não possuem mudanças candidatas;
- nenhuma escrita é necessária.

#### Relação com `matched_subset`

`incomingItemMatchState === 'matched_subset'` deverá continuar sendo semanticamente preservado.

Um conjunto parcial poderá resultar em:

- `no_changes`;
- `snapshot_changes_detected`;
- `blocked_item_reconciliation`;

desde que os itens efetivamente recebidos estejam associados por identidade segura.

Isso não deverá significar que o conjunto canônico inteiro foi recebido.

Itens canônicos ausentes do payload deverão continuar preservados.

Ausência no payload não deverá significar:

- remoção;
- cancelamento;
- redução de quantidade;
- desvinculação;
- criação de evento;
- necessidade automática de correção.

#### Relação com `scalarItemReconciliationReadiness`

`scalarItemReconciliationReadiness` deverá continuar existindo como leitura específica das diferenças escalares.

A nova agregação não deverá substituí-lo.

A diferença é:

- `scalarItemReconciliationReadiness`
  - observa somente o escopo escalar;

- `itemReconciliationSetState`
  - consolida a intenção geral do conjunto considerando:
    - correspondência dos itens;
    - bloqueios de `productId`;
    - diferenças de `variation`;
    - diferenças escalares.

#### Regras conservadoras

A agregação deverá ser determinística.

Ela não deverá:

- executar `update` em `OrderItem`;
- atualizar snapshots;
- alterar `productId`;
- executar relink;
- criar ou remover `OrderItem`;
- criar ou alterar `ExternalOrderItemReference`;
- inferir identidade;
- executar backfill;
- transformar ausência de item em remoção;
- persistir `itemReconciliationPlanSummary`;
- persistir `itemReconciliationSetState`;
- criar endpoint;
- criar evento;
- criar conector;
- alterar Prisma;
- criar migration.

#### Etapa posterior

Somente depois dessa agregação estar implementada, testada e protegida no Git deverá ser definida separadamente qualquer política de escrita efetiva.

A existência de:

`snapshot_changes_detected`

não deverá, por si só, autorizar atualização de `OrderItem`.

A política de escrita deverá ser um checkpoint posterior e explícito.

### Política de escrita efetiva de OrderItem — definição antes da implementação

Com a agregação de `itemReconciliationPlanState` já implementada e protegida, fica definida a política que deverá controlar uma futura escrita dos snapshots de `OrderItem`.

Este checkpoint continua apenas documental.

Nenhuma escrita de item será implementada nesta etapa.

#### Princípio geral

A sincronização externa somente poderá alterar um `OrderItem` já existente quando:

- a sincronização não estiver classificada como stale;
- o pedido possuir identidade externa de itens estruturalmente confiável;
- o item recebido estiver ligado ao item canônico exclusivamente por:

`externalItemId -> ExternalOrderItemReference -> orderItemId -> OrderItem`

- `itemUpdateEligibility === 'matched_items_only'`;
- `itemReconciliationSetState === 'snapshot_changes_detected'`;
- não existir qualquer bloqueio individual no conjunto recebido.

A existência isolada de uma diferença não autoriza escrita.

#### Estados do conjunto e efeito futuro

`preserve_items`

- não executar escrita de `OrderItem`;
- preservar integralmente os itens canônicos.

`blocked_unmatched`

- não executar escrita de nenhum item do conjunto recebido;
- não inferir identidade;
- não criar automaticamente novo `OrderItem`.

`blocked_item_reconciliation`

- não executar escrita de nenhum item do conjunto recebido;
- mesmo que outros itens possuam mudanças aparentemente seguras, a existência de pelo menos um bloqueio impede a reconciliação daquele conjunto.

`no_changes`

- não executar escrita de `OrderItem`.

`snapshot_changes_detected`

- representa o único estado agregado candidato a futura atualização de snapshots;
- ainda deverá respeitar as regras individuais de cada campo;
- somente os itens efetivamente recebidos e identificados poderão ser considerados.

#### Política por campo

##### `titleSnapshot`

`title` é obrigatório no contrato normalizado.

Quando o item estiver elegível e o valor recebido após `trim()` for diferente do snapshot atual:

- poderá atualizar `titleSnapshot`.

Valor igual:

- não deverá gerar escrita.

##### `quantity`

`quantity` é obrigatório e já passa pela validação estrutural comum.

Quando o item estiver elegível e a quantidade recebida for diferente da persistida:

- poderá atualizar `quantity`.

Valor igual:

- não deverá gerar escrita.

##### `unitPrice`

`unitPrice` é obrigatório e já passa pela validação estrutural comum.

A comparação deverá continuar utilizando `Prisma.Decimal`.

Quando o item estiver elegível e o valor recebido for diferente do persistido:

- poderá atualizar `unitPrice`.

Valor equivalente:

- não deverá gerar escrita.

##### `variationSnapshot`

`variation` permanece opcional.

Semântica:

- `variation === undefined` -> não informado nesta sincronização;
- preservar `variationSnapshot`;
- não considerar ausência como remoção.

Quando `variation` for fornecida:

- comparar estruturalmente utilizando a regra já implementada;
- valor estruturalmente igual -> nenhuma escrita;
- valor estruturalmente diferente -> poderá atualizar `variationSnapshot`, desde que todo o conjunto esteja elegível.

##### `skuSnapshot`

O contrato atual permite:

`sku?: string | null`

A futura atualização deverá adotar semântica conservadora:

- `sku === undefined` -> SKU não informado nesta sincronização -> preservar;
- `sku === null` -> SKU não informado nesta sincronização -> preservar;
- string vazia após `trim()` -> SKU não informado nesta sincronização -> preservar;
- somente string não vazia deverá participar da comparação de atualização.

Para uma string não vazia:

- valor igual ao `skuSnapshot` atual -> nenhuma escrita;
- valor diferente -> mudança candidata de snapshot.

Este contrato não possuirá, neste estágio, comando implícito para apagar um SKU existente.

Caso no futuro seja necessário permitir limpeza explícita de SKU, isso deverá possuir semântica própria e deliberada no contrato, sem reutilizar ausência, `null` ou string vazia como comando destrutivo.

#### Pré-condição técnica para SKU

A comparação atualmente existente normaliza:

`item.sku?.trim() || null`

Essa expressão torna indistinguíveis:

- `undefined`;
- `null`;
- string vazia;
- string contendo apenas espaços.

No fluxo de atualização, isso pode fazer a ausência de SKU parecer uma divergência em relação a um `skuSnapshot` já persistido.

Portanto, antes de habilitar qualquer escrita efetiva de `OrderItem`, a comparação de SKU deverá ser ajustada para preservar a distinção entre:

- SKU efetivamente fornecido;
- SKU não informado.

A política de escrita não deverá ser implementada enquanto essa pré-condição não estiver protegida por testes.

#### `productId`

`productId` não faz parte dos snapshots atualizáveis automaticamente.

Semântica já protegida:

- `undefined` -> preservar relação atual;
- `null` -> preservar relação atual;
- valor igual -> nenhuma alteração;
- valor inválido -> bloquear reconciliação;
- valor diferente -> bloquear reconciliação e exigir política específica de relink.

A sincronização normal nunca deverá executar automaticamente:

- troca de `OrderItem.productId`;
- relink para outro `Product`;
- desvinculação do produto atual.

#### Conjunto parcial

`matched_subset` continua permitido.

Quando somente parte dos itens canônicos estiver presente no payload:

- analisar somente os itens recebidos;
- atualizar futuramente somente os itens recebidos que estiverem elegíveis;
- preservar integralmente os itens canônicos ausentes.

Ausência de item no payload não significa:

- remoção;
- cancelamento;
- redução da quantidade daquele item;
- desvinculação;
- criação de evento;
- necessidade automática de correção.

#### Atomicidade do conjunto recebido

Se qualquer item recebido produzir bloqueio que resulte em:

`blocked_item_reconciliation`

nenhum `OrderItem` daquele conjunto recebido deverá ser atualizado.

Não deverá existir reconciliação parcial em que:

- um item bloqueado permaneça intacto;
- enquanto outro item do mesmo payload seja atualizado.

O bloqueio do conjunto deverá vencer sobre mudanças candidatas de snapshot.

Essa regra reduz o risco de persistir um estado parcialmente reconciliado quando o mesmo payload contém uma divergência de identidade ou de produto ainda não resolvida.

#### Idempotência

A futura implementação deverá construir atualização somente para campos realmente diferentes e autorizados.

Uma nova sincronização com os mesmos valores já persistidos deverá:

- não executar atualização desnecessária de `OrderItem`;
- não criar `OrderItem`;
- não remover `OrderItem`;
- não alterar `ExternalOrderItemReference`;
- não gerar evento adicional.

#### Eventos e lifecycle

Mudanças de snapshot de item, por si só, não deverão neste estágio:

- criar `OrderEvent`;
- alterar timestamps de lifecycle;
- alterar `Order.status`;
- disparar automações operacionais.

Qualquer uma dessas consequências deverá possuir regra própria e explícita em checkpoint posterior.

#### Fora do escopo

Esta política não autoriza ainda:

- execução de `tx.orderItem.update`;
- criação de novo `OrderItem` durante atualização;
- remoção de `OrderItem`;
- cancelamento de item;
- alteração de `productId`;
- relink de produto;
- criação ou alteração de `ExternalOrderItemReference`;
- bootstrap/backfill de pedidos legados;
- associação por SKU, título, posição, quantidade, preço, `productId` ou `variation`;
- persistência dos estados analíticos de reconciliação;
- endpoints;
- conectores;
- alterações Prisma;
- migrations.

O próximo passo técnico, antes de qualquer escrita de `OrderItem`, deverá ser corrigir e testar a semântica de comparação de `sku` no fluxo de atualização.

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

### Micro-checkpoint — escrita efetiva segura de snapshots de OrderItem

A pré-condição técnica da política de escrita referente ao SKU foi concluída e protegida no Git em:

`06df6b1` — `fix(orders): preserva sku ausente na reconciliacao`

A partir desse checkpoint:

- `sku === undefined` preserva o snapshot existente;
- `sku === null` preserva o snapshot existente;
- string vazia preserva o snapshot existente;
- string contendo apenas espaços preserva o snapshot existente;
- somente SKU não vazio efetivamente fornecido participa da comparação e de eventual atualização.

Com essa pré-condição protegida, foi implementada localmente a primeira escrita efetiva e conservadora de snapshots de `OrderItem` em:

`apps/api/src/modules/orders/external-order-ingestion.service.ts`

A escrita somente ocorre quando:

- a atualização não foi descartada como stale;
- o pedido possui identidade externa completa e confiável dos itens;
- o item recebido foi identificado exclusivamente pelo caminho:
  `externalItemId -> ExternalOrderItemReference -> orderItemId -> OrderItem`;
- `itemUpdateEligibility === 'matched_items_only'`;
- `itemReconciliationSetState === 'snapshot_changes_detected'`;
- não existe bloqueio individual de reconciliação no conjunto recebido.

Campos autorizados nesta primeira escrita:

- `titleSnapshot`;
- `skuSnapshot`;
- `variationSnapshot`;
- `quantity`;
- `unitPrice`.

Regras preservadas por campo:

- `titleSnapshot`
  - atualiza somente quando o título normalizado é diferente;

- `skuSnapshot`
  - somente SKU não vazio fornecido pode atualizar;
  - ausência, `null`, vazio ou whitespace preservam o valor atual;

- `variationSnapshot`
  - `variation === undefined` preserva o snapshot;
  - valor fornecido somente atualiza quando estruturalmente diferente;

- `quantity`
  - atualiza somente quando diferente;

- `unitPrice`
  - continua sendo comparado por `Prisma.Decimal`;
  - atualiza somente quando diferente.

`productId` continua explicitamente fora da escrita automática.

A sincronização normal continua sem executar:

- alteração de `OrderItem.productId`;
- relink para outro `Product`;
- desvinculação de produto;
- criação de novo `OrderItem` durante update;
- remoção de `OrderItem`;
- cancelamento de item;
- criação ou alteração de `ExternalOrderItemReference`;
- inferência de identidade por SKU, título, posição, quantidade, preço, `productId` ou `variation`;
- bootstrap ou backfill de pedidos legados;
- interpretação de ausência de item no payload como remoção.

A atomicidade do conjunto recebido foi preservada:

- se qualquer item recebido exigir `productId` diferente ou produzir outro bloqueio de reconciliação, nenhum item daquele conjunto é atualizado;
- payload contendo item sem correspondência segura continua bloqueado;
- não existe atualização parcial de um item seguro enquanto outro item do mesmo payload permanece bloqueado.

`matched_subset` continua permitido:

- somente os itens efetivamente recebidos e identificados podem ser atualizados;
- itens canônicos ausentes do payload são preservados integralmente.

A implementação também preserva idempotência:

- somente campos realmente diferentes são adicionados ao `OrderItemUpdateInput`;
- se nenhum campo autorizado estiver diferente, `tx.orderItem.update()` não é executado.

Mudanças de snapshot continuam sem:

- criar `OrderEvent`;
- alterar `Order.status`;
- alterar timestamps de lifecycle;
- disparar automações operacionais.

Foram adicionados 6 testes focados para a escrita de snapshots.

Casos cobertos:

1. atualizar somente snapshots realmente alterados em item identificado;
2. preservar SKU e variation omitidos enquanto outro snapshot é atualizado;
3. bloquear todo o conjunto quando um item exige relink de `productId`;
4. não atualizar itens quando o payload contém item sem correspondência;
5. em `matched_subset`, atualizar somente o item recebido;
6. não executar update quando todos os valores recebidos são equivalentes aos persistidos.

Resultado inicial antes da implementação:

- 46 testes focados executados;
- 43 aprovados;
- 3 falharam exatamente por ausência de `tx.orderItem.update()`.

Resultado após a implementação:

- teste focado:
  - 1 suíte aprovada;
  - 46 de 46 testes aprovados;

- `git diff --check`:
  - aprovado;

- `pnpm --filter api build`:
  - aprovado;

- suíte completa da API:
  - 8 de 8 suítes aprovadas;
  - 53 de 53 testes aprovados.

Estado local validado antes deste registro:

- branch: `feat/marto-ops-integration`;
- HEAD protegido anterior: `06df6b1`;
- arquivos de código alterados:
  - `apps/api/src/modules/orders/external-order-ingestion.service.ts`;
  - `apps/api/src/modules/orders/external-order-ingestion.service.spec.ts`;
- `docs/marto-ia/` permanece untracked e não foi alterado;
- nenhum commit ou push desta implementação havia sido realizado.

Este checkpoint não autoriza ainda novas etapas de integração.

Próxima ação exata:

1. revisar o diff final de serviço, testes e deste MASTER;
2. confirmar que nenhuma alteração fora do escopo foi incluída;
3. proteger esta microetapa em um commit próprio na branch `feat/marto-ops-integration`;
4. executar push da mesma branch somente após a revisão;
5. somente depois definir separadamente o próximo checkpoint técnico.

Ainda não fazer:

- integração Mercado Livre;
- integração Shopee;
- registro de conectores reais;
- telas operacionais;
- migração de Cotações;
- migração de Pós-venda;
- alteração da `main`;
- remoção ou substituição do HTML;
- criação automática de novos itens em update;
- remoção automática de itens;
- relink automático de `productId`;
- bootstrap/backfill automático de itens legados.

### Micro-checkpoint — definição da criação segura de item externo novo em pedido existente

O checkpoint anterior foi implementado, validado e protegido no Git em:

`a77cd68` — `feat(orders): aplica escrita segura de snapshots de itens`

Nesse estado:

- `externalItemId` já conhecido pode localizar e atualizar com segurança o mesmo `OrderItem`;
- snapshots autorizados podem ser atualizados de forma conservadora;
- `productId` não sofre relink automático;
- itens desconhecidos continuam classificados como conjunto bloqueado;
- nenhum novo `OrderItem` é criado durante update.

O próximo comportamento a ser preparado é a criação segura de um item externo realmente novo em um pedido já existente.

Este checkpoint é somente de definição.

Nenhuma criação de item será implementada ainda.

#### Pré-condição estrutural

Um `externalItemId` desconhecido somente poderá futuramente ser considerado candidato a item novo quando o estado do pedido existente, antes de aplicar o payload, for:

`itemIdentityState === 'identified_complete'`

Isso significa que:

- o pedido já possui `OrderItem` canônicos;
- todos os itens canônicos existentes possuem identidade externa vinculada;
- todas as `ExternalOrderItemReference` existentes apontam para itens daquele mesmo pedido;
- não existe lacuna de identidade anterior a ser inferida.

Os seguintes estados não poderão criar automaticamente um novo item:

- `legacy_unlinked`;
- `inconsistent`;
- `empty_unidentified`;
- qualquer estado em que a identidade anterior dos itens não seja confiável.

Em pedido legado sem referências de item, um `externalItemId` desconhecido não poderá ser interpretado como item novo.

#### Identidade

A única identidade permitida continuará sendo:

`externalItemId -> ExternalOrderItemReference -> OrderItem`

Não será permitido inferir que um item recebido é novo ou corresponde a item existente utilizando:

- título;
- SKU;
- posição no array;
- quantidade;
- preço;
- `productId`;
- `variation`;
- combinação desses campos.

#### Validação do item candidato

O item candidato continuará passando pelas validações estruturais comuns:

- `externalItemId` obrigatório e não vazio;
- `externalItemId` único dentro do payload;
- título obrigatório após normalização;
- `quantity` inteira e maior que zero;
- `unitPrice` válido, finito e não negativo.

#### productId do item novo

Para item externo novo:

- `productId === undefined` -> criar futuramente com `productId = null`;
- `productId === null` -> criar futuramente com `productId = null`;
- string vazia após `trim()` -> item não elegível para criação;
- valor informado -> deverá existir e pertencer ao mesmo `Merchant` do `SalesChannel`;
- produto inexistente ou de outro Merchant -> bloquear as escritas de item daquele conjunto;
- nunca criar `Product` fictício;
- nunca executar relink automático.

#### Snapshots iniciais

Quando a criação for futuramente autorizada, o novo `OrderItem` deverá nascer com:

- `titleSnapshot` normalizado;
- `skuSnapshot` normalizado ou `null` quando não informado;
- `variationSnapshot` conforme valor recebido, quando fornecido;
- `quantity`;
- `unitPrice`;
- `productId` validado ou `null`.

#### Criação atômica da identidade

Um novo item externo nunca poderá ser persistido apenas como `OrderItem`.

A futura escrita deverá criar, dentro da mesma transação:

`OrderItem + ExternalOrderItemReference`

A referência deverá utilizar:

- o `OrderItem.id` recém-criado;
- a `ExternalOrderReference.id` do pedido já existente;
- o `externalItemId` recebido.

Se a criação da referência falhar, a criação do `OrderItem` também deverá sofrer rollback.

Não poderá existir `OrderItem` externo novo sem identidade de linha associada.

#### Payload parcial

A existência de item novo em um payload não transforma o payload em snapshot completo do pedido.

Itens canônicos existentes omitidos continuam preservados.

Ausência continua sem significar:

- remoção;
- cancelamento;
- redução de conjunto;
- desvinculação;
- correção automática.

#### Conjunto misto

Um mesmo payload poderá futuramente conter:

- itens externos já conhecidos sem mudanças;
- itens conhecidos com mudanças autorizadas de snapshot;
- itens externos novos candidatos à criação.

As escritas de item daquele payload deverão ser tratadas como um único conjunto atômico.

Antes de executar qualquer escrita de item:

- todos os itens recebidos deverão ser classificados;
- todos os candidatos novos deverão ser validados;
- todos os bloqueios deverão ser conhecidos.

Se existir bloqueio de reconciliação no conjunto:

- não atualizar snapshots de itens conhecidos daquele payload;
- não criar novos `OrderItem`;
- não criar novas `ExternalOrderItemReference`.

Campos independentes do pedido e da referência externa continuarão seguindo suas regras próprias já definidas.

#### Idempotência

Depois que um item externo novo for criado e sua `ExternalOrderItemReference` persistida:

- uma nova sincronização com o mesmo `externalItemId` deverá localizá-lo como item conhecido;
- não deverá criar outro `OrderItem`;
- não deverá criar outra referência;
- valores iguais não deverão gerar update desnecessário.

As constraints existentes continuam sendo proteção adicional:

- `(externalOrderReferenceId, externalItemId)` único;
- `(externalOrderReferenceId, orderItemId)` único.

#### Concorrência

A futura criação de item durante update introduzirá risco de duas sincronizações concorrentes tentarem criar a mesma referência externa.

O update atualmente trata retry transacional para:

`P2034`

Antes de habilitar criação de `ExternalOrderItemReference` nesse fluxo, deverá ser avaliada e protegida também a colisão de unicidade:

`P2002`

A política deverá preservar:

- nenhuma duplicação de `OrderItem`;
- nenhuma duplicação de `ExternalOrderItemReference`;
- nenhuma escrita parcial;
- revalidação transacional após retry.

#### Remoção continua fora do escopo

A criação de item novo não autorizará:

- remover item ausente;
- cancelar item ausente;
- reduzir automaticamente o conjunto canônico;
- apagar `ExternalOrderItemReference`;
- relink de `productId`;
- bootstrap/backfill de pedido legado.

Remoção ou cancelamento somente poderá existir futuramente mediante sinal explícito, inequívoco e confiável da origem.

#### Próxima ação exata

Depois desta definição estar revisada e protegida no Git, a próxima microetapa deverá ser somente a criação de testes focados para esse comportamento.

Os primeiros testes deverão proteger, no mínimo:

1. item desconhecido em pedido `identified_complete` como candidato seguro a novo item;
2. criação futura de `OrderItem + ExternalOrderItemReference` em conjunto;
3. `productId` ausente resultando em `productId = null`;
4. `productId` válido pertencente ao mesmo Merchant;
5. `productId` inválido ou de outro Merchant bloqueando as escritas de item;
6. pedido legado sem identidade completa não criando item desconhecido;
7. payload parcial preservando itens existentes omitidos;
8. conjunto misto com item conhecido e item novo mantendo atomicidade;
9. repetição do mesmo `externalItemId` sem duplicação;
10. proteção de concorrência envolvendo `P2002/P2034`.

Ainda não implementar nesta etapa:

- `tx.orderItem.create()` no fluxo de update;
- `tx.externalOrderItemReference.create()` no fluxo de update;
- mudança da classificação `blocked_unmatched`;
- remoção ou cancelamento de item;
- relink de `productId`;
- bootstrap/backfill;
- endpoints;
- conectores Mercado Livre ou Shopee;
- alteração da `main`.

### Micro-checkpoint — criação segura de item externo novo em pedido existente

A política desta etapa foi definida e protegida anteriormente no Git em:

`5f82482` — `docs(orders): define criacao segura de item externo novo`

A partir dessa definição, foi implementado localmente o comportamento de criação segura de item externo novo em pedido já existente.

Arquivos envolvidos:

- `apps/api/src/modules/orders/external-order-ingestion.service.ts`;
- `apps/api/src/modules/orders/external-order-ingestion.service.spec.ts`.

Nenhum schema Prisma, migration, endpoint ou conector foi alterado.

#### Pré-condição estrutural preservada

A criação automática de novo item continua restrita ao fluxo em que o pedido existente possui identidade externa de itens confiável.

Pedido legado sem cobertura de `ExternalOrderItemReference` continua sem interpretar `externalItemId` desconhecido como item novo.

Assim:

- pedido com identidade completa pode classificar `externalItemId` desconhecido como candidato novo;
- pedido legado sem identidade de item continua preservado;
- nenhuma associação é inferida por SKU, título, posição, preço, quantidade, `productId` ou `variation`.

#### Separação entre itens conhecidos e candidatos novos

O fluxo passou a separar explicitamente:

- itens recebidos já associados a `OrderItem` canônico;
- candidatos novos sem `ExternalOrderItemReference` existente.

Itens conhecidos continuam seguindo a política já protegida de atualização conservadora dos snapshots.

Candidatos novos somente entram no fluxo de criação quando não existe bloqueio no conjunto recebido.

#### productId de item novo

Para candidato novo:

- `productId` ausente ou `null` resulta em novo `OrderItem` com `productId = null`;
- string vazia após normalização é considerada inválida;
- valor informado é validado contra `Product` pertencente ao mesmo `Merchant` do `SalesChannel`;
- produto inexistente ou pertencente a outro Merchant bloqueia todas as escritas de item daquele payload;
- nenhum `Product` fictício é criado;
- nenhum `productId` de item existente sofre relink automático.

A validação dos produtos candidatos ocorre antes de qualquer update ou create de item do conjunto.

#### Criação atômica

Novo item externo é criado como par dentro da mesma transação:

`OrderItem + ExternalOrderItemReference`

O `OrderItem` recebe:

- `orderId` do pedido existente;
- `productId` validado ou `null`;
- `titleSnapshot` normalizado;
- `skuSnapshot` normalizado ou `null`;
- `variationSnapshot` quando fornecido;
- `quantity`;
- `unitPrice`.

Depois da criação do `OrderItem`, é criada a referência com:

- `orderItemId` recém-criado;
- `externalOrderReferenceId` do pedido existente;
- `externalItemId` recebido.

Se qualquer escrita da transação falhar, o par não deverá permanecer parcialmente persistido.

#### Conjunto misto

Payload pode conter simultaneamente:

- item conhecido sem mudanças;
- item conhecido com mudança autorizada de snapshot;
- item externo novo.

Quando o conjunto é válido:

- snapshots autorizados dos itens conhecidos podem ser atualizados;
- novos itens podem ser criados;
- novas `ExternalOrderItemReference` podem ser criadas.

Quando existe bloqueio:

- nenhum snapshot conhecido daquele conjunto é atualizado;
- nenhum `OrderItem` novo é criado;
- nenhuma nova `ExternalOrderItemReference` é criada.

#### Payload parcial

A inclusão de um item novo não transforma a resposta externa em snapshot completo do pedido.

Itens canônicos omitidos continuam preservados.

Ausência continua sem significar:

- remoção;
- cancelamento;
- redução de conjunto;
- desvinculação.

#### Idempotência

`externalItemId` já conhecido continua localizando o mesmo item.

Nesse caso:

- não é criado outro `OrderItem`;
- não é criada outra `ExternalOrderItemReference`;
- snapshots somente são atualizados quando realmente diferentes.

Depois que um item novo for persistido com sua identidade externa, nova sincronização com o mesmo `externalItemId` deverá entrar nesse fluxo de item conhecido.

#### Concorrência

O retry transacional do update foi ampliado para tratar:

- `P2034`;
- `P2002`.

`P2034` já era protegido anteriormente.

`P2002` foi acrescentado porque a criação de nova `ExternalOrderItemReference` durante update introduz possibilidade de colisão de unicidade entre sincronizações concorrentes.

Após retry, toda a transação reexecuta a leitura do estado atual antes das escritas.

#### Testes adicionados

Foram adicionados 12 testes novos nesta microetapa.

Nove testes de comportamento de item novo:

1. criar item para `externalItemId` desconhecido quando a identidade existente é completa;
2. criar `OrderItem + ExternalOrderItemReference` como par;
3. criar com `productId = null` quando `productId` é omitido;
4. aceitar `productId` somente quando pertence ao mesmo Merchant;
5. bloquear todas as escritas de item quando o `productId` novo é inválido;
6. não criar item desconhecido para pedido legado sem identidade de item;
7. preservar itens existentes omitidos em payload parcial;
8. atualizar item conhecido e criar item novo juntos quando não existem bloqueios;
9. não duplicar item quando o `externalItemId` já é conhecido.

Três testes de concorrência:

10. preservar retry do update após `P2034`;
11. executar retry do update após `P2002`;
12. após colisão `P2002`, repetir a transação, reler a identidade externa criada concorrentemente e não tentar criar um segundo `OrderItem`.

#### Ciclo RED

Primeiro conjunto de testes de item novo, antes da implementação:

- 55 testes focados;
- 48 aprovados;
- 7 falharam;
- as 7 falhas corresponderam exatamente aos comportamentos de criação ainda ausentes.

Depois da inclusão dos testes de concorrência:

- 57 testes focados;
- 49 aprovados;
- 8 falharam.

Nesse segundo RED:

- o teste de `P2034` passou;
- o teste de `P2002` falhou;
- a falha de `P2002` ocorreu porque o update ainda rejeitava a exceção em vez de repetir a transação.

Nenhuma regressão inesperada foi observada nos testes já existentes.

#### Resultado GREEN

Depois da implementação:

- teste focado de `ExternalOrderIngestionService`:
  - 1 suíte aprovada;
  - 57 de 57 testes aprovados.

#### Proteção adicional de concorrência após o GREEN inicial

Depois do primeiro GREEN de 57 de 57 testes focados, foi adicionada uma proteção adicional específica para concorrência real de identidade externa.

O novo teste simula:

1. primeira tentativa classificando `externalItemId` como novo;
2. criação local de `OrderItem`;
3. colisão `P2002` ao criar `ExternalOrderItemReference`;
4. rollback da primeira tentativa pela transação;
5. retry do update;
6. nova leitura transacional encontrando o item e a referência criados concorrentemente;
7. reconhecimento do `externalItemId` como item já conhecido;
8. nenhuma segunda tentativa de criação de `OrderItem`.

Resultado após essa proteção adicional:

- teste focado de `ExternalOrderIngestionService`:
  - 1 suíte aprovada;
  - 58 de 58 testes aprovados.

Isso protege explicitamente a regra de que retry por `P2002` deve revalidar o estado atual antes de qualquer nova escrita e não pode duplicar item externo.

#### Validação ampla

Após o GREEN focado:

- `git diff --check`:
  - aprovado;

- `pnpm --filter api build`:
  - aprovado;

- suíte completa da API:
  - 8 de 8 suítes aprovadas;
  - 65 de 65 testes aprovados;
  - 0 snapshots.

Estado local validado:

- branch: `feat/marto-ops-integration`;
- HEAD base protegido: `5f82482`;
- arquivos de código alterados:
  - `apps/api/src/modules/orders/external-order-ingestion.service.ts`;
  - `apps/api/src/modules/orders/external-order-ingestion.service.spec.ts`;
- `docs/marto-ia/` permanece untracked e fora do escopo;
- nenhum commit ou push desta implementação foi realizado.

#### Limites preservados

Esta etapa não autoriza:

- remoção automática de `OrderItem`;
- cancelamento automático de item;
- remoção de `ExternalOrderItemReference`;
- alteração automática de `OrderItem.productId`;
- relink de produto;
- bootstrap/backfill de pedido legado;
- heurística de identidade;
- criação de `Product`;
- endpoints;
- conectores Mercado Livre;
- conectores Shopee;
- telas operacionais;
- alteração da `main`;
- substituição ou remoção do HTML.

#### Próxima ação exata

1. revisar o diff final de:
   - service;
   - spec;
   - este MASTER;
2. confirmar novamente que a implementação respeita os bloqueios e não introduziu escrita fora do escopo;
3. proteger esta microetapa em commit próprio na branch `feat/marto-ops-integration`;
4. executar push somente após revisão;
5. somente então definir o próximo checkpoint técnico.

### Micro-checkpoint — contrato observável do resultado da ingestão externa

A criação segura de item externo novo em pedido existente foi implementada, validada e protegida no Git em:

`3490f68` — `feat(orders): cria itens externos novos com seguranca`

Nesse estado:

- snapshots de itens conhecidos podem ser atualizados com segurança;
- itens externos realmente novos podem ser criados;
- `OrderItem + ExternalOrderItemReference` são persistidos atomicamente;
- `productId` novo é validado pelo Merchant;
- pedido legado sem identidade confiável permanece protegido;
- payload parcial não remove itens omitidos;
- `P2034` e `P2002` possuem retry;
- retry após `P2002` relê a identidade atual e evita duplicação.

O próximo problema arquitetural é a observabilidade do resultado da ingestão.

Hoje o fluxo pode preservar ou bloquear a reconciliação dos itens e, ainda assim, o retorno externo do serviço continuar contendo apenas uma ação ampla como:

`action: 'update'`

Isso não é suficiente para um futuro adapter de canal distinguir:

- pedido totalmente reconciliado;
- pedido atualizado somente em campos independentes;
- itens preservados;
- itens não avaliados;
- reconciliação de itens bloqueada;
- snapshots realmente atualizados;
- novos itens realmente criados.

Antes de registrar `ExternalOrderIngestionService` no `OrdersModule` ou conectá-lo a Mercado Livre, Shopee ou outro canal, o resultado do caso de uso deverá tornar essas decisões observáveis.

Este checkpoint é somente de definição.

Nenhum código será alterado ainda.

#### Contrato conceitual mínimo

Para remover ambiguidade antes da implementação, o resultado de itens deverá possuir conceitualmente uma estrutura equivalente a:

`itemReconciliation`

com os campos:

- `mode`;
- `reason`;
- `itemIdentityState`;
- `decisionState`;
- `receivedItems`;
- `matchedExistingItems`;
- `newItemCandidates`;
- `updatedExistingItems`;
- `createdNewItems`;
- `blockedItems`.

A nomenclatura TypeScript definitiva poderá ser ajustada durante a implementação somente se preservar exatamente esta semântica.

##### `mode`

Estados:

- `initial_creation`
  - utilizado quando `action === 'create'`;
  - representa a criação inicial dos itens junto com o novo pedido;
  - não deve fingir que houve comparação com itens canônicos anteriores.

- `update_reconciliation`
  - utilizado quando um pedido existente teve seus itens efetivamente analisados pela lógica de reconciliação.

- `not_evaluated`
  - utilizado quando a reconciliação de itens deliberadamente não foi executada.

##### `reason`

Quando `mode !== 'not_evaluated'`:

`reason = null`

Quando `mode === 'not_evaluated'`, o motivo deverá ser explícito.

Motivos mínimos inicialmente definidos:

- `stale_update`;
- `items_omitted`;
- `unsafe_item_identity`.

Não utilizar string genérica como:

`unknown`

para esconder um caso já conhecido pelo fluxo.

##### `itemIdentityState`

Quando o pedido existente passou pela classificação de identidade, reutilizar o estado já produzido:

- `items_omitted`;
- `legacy_unlinked`;
- `identified_complete`;
- `empty_unidentified`;
- `inconsistent`.

Para criação inicial, onde não existe conjunto canônico anterior para reconciliar:

`itemIdentityState = null`

##### `decisionState`

Representa a decisão de reconciliação antes de considerar os contadores de efeito.

Quando `mode === 'update_reconciliation'`, reutilizar a decisão já calculada pelo fluxo.

Estados atualmente relevantes:

- `preserve_items`;
- `blocked_item_reconciliation`;
- `no_changes`;
- `snapshot_changes_detected`;
- `new_items_detected`.

Quando não houve reconciliação:

`decisionState = null`

Quando `mode === 'initial_creation'`:

`decisionState = null`

A criação inicial não deverá inventar um estado de update apenas para preencher o retorno.

##### Contadores de efeito

Os contadores deverão representar somente o resultado final da tentativa transacional que concluiu com sucesso.

`receivedItems`

- quantidade de itens presentes no payload;
- para `items` omitido, zero;
- atualização stale poderá informar a quantidade recebida, mas isso não significa que os itens foram avaliados.

`matchedExistingItems`

- itens recebidos ligados com segurança a `OrderItem` já existente.

`newItemCandidates`

- itens externos desconhecidos classificados como candidatos seguros a criação durante update.

`updatedExistingItems`

- quantidade de `OrderItem` existentes que efetivamente receberam `tx.orderItem.update()` na transação concluída.

`createdNewItems`

- quantidade de `OrderItem` efetivamente criados pela ingestão concluída;
- em `initial_creation`, corresponde aos itens criados junto com o novo pedido;
- em update, corresponde apenas aos novos itens externos realmente criados.

`blockedItems`

- quantidade de itens bloqueados segundo a análise efetivamente executada.

Uma escrita executada em tentativa posteriormente revertida por `P2002` ou `P2034` não poderá aparecer nesses contadores finais.

#### Exemplos semânticos obrigatórios

Pedido novo com três itens:

- `action = create`;
- `mode = initial_creation`;
- `reason = null`;
- `decisionState = null`;
- `receivedItems = 3`;
- `createdNewItems = 3`;
- `updatedExistingItems = 0`.

Update stale contendo dois itens:

- `action = ignored_stale`;
- `mode = not_evaluated`;
- `reason = stale_update`;
- `receivedItems = 2`;
- `updatedExistingItems = 0`;
- `createdNewItems = 0`.

Update sem campo `items`:

- `action = update`;
- `mode = not_evaluated`;
- `reason = items_omitted`;
- `receivedItems = 0`;
- `updatedExistingItems = 0`;
- `createdNewItems = 0`.

Pedido legado recebendo itens:

- `action = update`;
- `mode = not_evaluated`;
- `reason = unsafe_item_identity`;
- `itemIdentityState = legacy_unlinked`;
- nenhuma criação automática;
- nenhum update de item.

Item conhecido sem alteração:

- `mode = update_reconciliation`;
- `decisionState = no_changes`;
- `matchedExistingItems = 1`;
- `updatedExistingItems = 0`;
- `createdNewItems = 0`.

Conjunto misto válido contendo um item conhecido alterado e um item externo novo:

- `mode = update_reconciliation`;
- `matchedExistingItems = 1`;
- `newItemCandidates = 1`;
- `updatedExistingItems = 1`;
- `createdNewItems = 1`.

Conjunto bloqueado:

- `mode = update_reconciliation`;
- `decisionState = blocked_item_reconciliation`;
- `blockedItems > 0`;
- `updatedExistingItems = 0`;
- `createdNewItems = 0`.

#### Princípio

O resultado da ingestão deverá continuar possuindo a ação principal:

- `create`;
- `update`;
- `ignored_stale`.

Além dela, deverá existir futuramente um resultado estruturado específico para os itens.

Nome conceitual:

`itemReconciliation`

Esse resultado será informação do caso de uso.

Ele não deverá representar uma nova entidade persistida.

#### Separação entre decisão e efeito

O resultado deverá distinguir:

1. o que foi analisado;
2. qual decisão de reconciliação foi tomada;
3. quais escritas efetivamente ocorreram.

Isso evita tratar:

`mudança detectada`

como sinônimo de:

`mudança persistida`.

Também evita tratar:

`action: update`

como sinônimo de:

`todos os itens foram reconciliados`.

#### Estado de identidade

Quando aplicável, o resultado deverá preservar a classificação já existente:

`itemIdentityState`

Estados já conhecidos:

- `items_omitted`;
- `legacy_unlinked`;
- `identified_complete`;
- `empty_unidentified`;
- `inconsistent`.

Essa informação permitirá saber por que os itens puderam ou não entrar em reconciliação.

#### Estado agregado da reconciliação

Quando os itens forem efetivamente avaliados, o resultado deverá expor a decisão agregada derivada das regras já existentes.

Estados relevantes atualmente:

- `preserve_items`;
- `blocked_item_reconciliation`;
- `no_changes`;
- `snapshot_changes_detected`;
- `new_items_detected`.

Não deverá ser criada uma segunda regra de negócio paralela apenas para construir o retorno.

O resultado deverá reutilizar as decisões já tomadas pelo próprio fluxo.

#### Casos não avaliados

Existem situações em que a reconciliação de itens não deve ser executada.

O resultado deverá representar isso explicitamente.

Exemplos:

- atualização stale;
- `items` omitido;
- identidade anterior não confiável;
- pedido legado sem identidade externa completa.

O caller não deverá precisar inferir esse estado pela ausência de writes no banco.

#### Contadores mínimos

Quando aplicáveis, deverão ser disponibilizados contadores derivados do processamento.

Conjunto mínimo proposto:

- `receivedItems`
  - quantidade de itens presentes no payload recebido;

- `matchedExistingItems`
  - quantidade de itens recebidos identificados como `OrderItem` já existente;

- `newItemCandidates`
  - quantidade de `externalItemId` desconhecidos classificados com segurança como candidatos novos;

- `updatedExistingItems`
  - quantidade de `OrderItem` existentes que efetivamente receberam `update`;

- `createdNewItems`
  - quantidade de novos `OrderItem` efetivamente criados;

- `blockedItems`
  - quantidade de itens cuja reconciliação ficou bloqueada.

Os contadores deverão refletir fatos do processamento atual.

Não deverão estimar nem inferir escritas que não ocorreram.

#### Motivos de bloqueio

Quando a reconciliação estiver bloqueada, o resultado deverá preservar informação suficiente para diagnóstico.

No mínimo deverão permanecer distinguíveis:

- item não comparável com segurança;
- `productId` inválido;
- divergência de `productId` exigindo política específica de relink;
- `productId` de candidato novo inexistente ou pertencente a outro Merchant;
- identidade do pedido inadequada para criação ou reconciliação segura.

O objetivo não é expor todo o objeto interno `incomingItemMatches`.

O resultado deverá fornecer diagnóstico útil sem acoplar callers à implementação interna do algoritmo.

#### Pedido criado

Quando:

`action === 'create'`

o resultado deverá ser coerente com o fato de que os itens iniciais foram criados junto com o pedido.

Deverá ser possível distinguir:

- quantidade recebida;
- quantidade criada;
- ausência de reconciliação de item existente.

Não deverá fingir que a criação inicial passou pelo mesmo processo de comparação de um update.

#### Update stale

Quando:

`action === 'ignored_stale'`

nenhuma reconciliação de item deverá ser apresentada como executada.

O resultado deverá informar explicitamente que os itens não foram avaliados por causa da proteção contra atualização stale.

#### Itens omitidos

Quando `items` não estiver presente no payload:

- os itens canônicos continuam preservados;
- nenhuma reconciliação deverá ser apresentada como executada;
- o resultado deverá permitir distinguir esse caso de um payload com `items: []`.

Ausência do campo continua sem significar remoção.

#### Pedido legado ou identidade insegura

Quando a identidade anterior dos itens não for segura:

- não inferir correspondência;
- não criar novo item automaticamente;
- não executar backfill;
- informar no resultado que a reconciliação de itens não foi executada por causa do estado de identidade.

Isso permitirá futuramente gerar:

- log;
- alerta;
- fila de revisão;
- métrica;
- tarefa operacional;

sem enfraquecer as regras de identidade.

Essas consequências ainda não serão implementadas nesta etapa.

#### Conjunto bloqueado

Quando um conjunto possuir bloqueio:

- `updatedExistingItems` deverá permanecer zero para aquele conjunto;
- `createdNewItems` deverá permanecer zero;
- o resultado deverá deixar claro que nenhuma escrita de item foi aplicada.

Campos independentes do pedido e da `ExternalOrderReference` poderão continuar seguindo suas regras atuais.

#### Conjunto misto

Quando um payload válido possuir simultaneamente:

- item conhecido alterado;
- item novo;
- item conhecido sem alteração;

o resultado deverá permitir observar separadamente:

- quantidade identificada;
- quantidade atualizada;
- quantidade criada;
- quantidade sem necessidade de escrita.

Não deverão ser criadas escritas artificiais apenas para gerar contadores.

#### Idempotência observável

Uma nova sincronização contendo os mesmos valores já persistidos deverá resultar em informação compatível com:

- nenhum novo item criado;
- nenhum item existente atualizado;
- nenhuma referência duplicada;
- nenhuma escrita desnecessária.

A observabilidade deverá refletir a idempotência já protegida pelo fluxo.

#### Concorrência

Quando ocorrer retry por `P2002` ou `P2034`, o resultado final deverá representar somente o estado da tentativa que efetivamente concluiu a transação.

Uma tentativa revertida não poderá inflar:

- `createdNewItems`;
- `updatedExistingItems`;
- outros contadores de efeito.

Especialmente no caso já testado de colisão `P2002`:

- a primeira tentativa pode chegar até uma escrita que será revertida;
- a segunda tentativa relê o banco;
- se o item já existir por ação concorrente, o resultado final não deverá declarar uma nova criação feita por esta ingestão.

#### Sem persistência adicional

Neste estágio, `itemReconciliation` deverá futuramente ser apenas parte do retorno em memória.

Não criar ainda:

- tabela de auditoria;
- coluna adicional;
- JSON persistido;
- evento operacional;
- log estruturado definitivo;
- métrica;
- fila.

Persistência de diagnóstico poderá ser definida separadamente no futuro.

#### Limite de aplicação

Depois que esse contrato de resultado estiver implementado e testado, o próximo passo arquitetural poderá ser registrar:

`ExternalOrderIngestionService`

em:

`OrdersModule`

como provider/export utilizável por adapters internos.

Até lá:

- não criar endpoint público de ingestão;
- não adicionar rota ao `OrdersController`;
- não chamar o serviço diretamente a partir de controller genérico;
- não integrar Mercado Livre;
- não integrar Shopee.

#### Responsabilidade futura dos adapters

Adapters de marketplaces deverão futuramente:

1. receber dados específicos do canal;
2. autenticar/validar a origem conforme a integração;
3. normalizar para `NormalizedExternalOrderInput`;
4. chamar `ExternalOrderIngestionService`;
5. interpretar o resultado estruturado da ingestão.

Adapters não deverão escrever diretamente em:

- `Order`;
- `OrderItem`;
- `ExternalOrderReference`;
- `ExternalOrderItemReference`.

As regras canônicas deverão permanecer concentradas no caso de uso de ingestão.

#### Testes mínimos antes da implementação

A futura implementação deverá começar por testes focados.

Cobertura mínima:

1. criação de pedido informa quantidade de itens criados;
2. update stale informa que itens não foram avaliados;
3. `items` omitido informa preservação sem reconciliação;
4. item conhecido sem mudança informa zero updates e zero creates;
5. mudança de snapshot informa item existente efetivamente atualizado;
6. item externo novo informa criação efetiva;
7. conjunto misto informa separadamente update e create;
8. conjunto bloqueado informa bloqueio e zero writes de item;
9. pedido legado informa identidade não segura e zero writes;
10. retry por `P2002` não contabiliza como criação a tentativa revertida.

#### Próxima ação exata

Depois desta definição estar revisada:

1. proteger este checkpoint documental em commit próprio;
2. criar testes focados para o contrato observável;
3. observar o RED correspondente;
4. implementar somente o resultado estruturado em memória;
5. preservar todas as regras atuais de persistência;
6. executar build e suíte completa;
7. somente depois avaliar o registro de `ExternalOrderIngestionService` no `OrdersModule`.

Ainda não fazer:

- endpoint de ingestão;
- webhook;
- polling;
- Mercado Livre;
- Shopee;
- backfill;
- relink automático de `productId`;
- remoção automática de item;
- alteração da `main`;
- mudanças Prisma;
- migrations.

### Checkpoint implementado — resultado observável da ingestão externa

O contrato definido anteriormente para observabilidade da ingestão externa foi implementado no `ExternalOrderIngestionService`.

Arquivos de código envolvidos:

- `apps/api/src/modules/orders/external-order-ingestion.service.ts`;
- `apps/api/src/modules/orders/external-order-ingestion.service.spec.ts`.

Nenhuma migration, alteração de schema Prisma, controller público, adapter de marketplace ou integração externa foi criada neste checkpoint.

#### Resultado `itemReconciliation`

A ingestão agora devolve um resultado estruturado em memória capaz de separar:

- ação principal da ingestão;
- modo da reconciliação de itens;
- motivo de não avaliação;
- estado de identidade dos itens;
- decisão de reconciliação;
- quantidade recebida;
- itens conhecidos encontrados;
- candidatos a novo item;
- updates efetivamente aplicados;
- novos itens efetivamente criados;
- itens bloqueados;
- motivos de bloqueio.

Modos implementados:

- `initial_creation`;
- `update_reconciliation`;
- `not_evaluated`.

Motivos explícitos de `not_evaluated`:

- `stale_update`;
- `items_omitted`;
- `unsafe_item_identity`.

Estados observáveis de decisão:

- `preserve_items`;
- `blocked_item_reconciliation`;
- `no_changes`;
- `snapshot_changes_detected`;
- `new_items_detected`.

#### Contadores de efeito

Foram implementados os contadores:

- `receivedItems`;
- `matchedExistingItems`;
- `newItemCandidates`;
- `updatedExistingItems`;
- `createdNewItems`;
- `blockedItems`.

`updatedExistingItems` é incrementado somente após um `OrderItem.update()` efetivamente executado na tentativa transacional corrente.

`createdNewItems` é incrementado somente depois da criação do par:

- `OrderItem`;
- `ExternalOrderItemReference`.

Os contadores existem dentro da tentativa transacional.

Assim, uma tentativa revertida por `P2002` ou `P2034` não contamina o resultado retornado pela tentativa posterior que realmente conclui.

#### Diagnóstico de bloqueios

Foi adicionado `blockReasons` para que um adapter futuro não receba apenas um bloqueio genérico.

Motivos atualmente expostos:

- `blocked_not_comparable`;
- `blocked_invalid_product_id`;
- `blocked_product_relink_required`;
- `blocked_new_item_product_id`.

Isso é somente observabilidade.

Os motivos não alteram a decisão de persistência já existente.

#### Regras de persistência preservadas

Este checkpoint não alterou as regras previamente aprovadas.

Continua proibido:

- inferir identidade por título;
- inferir identidade por SKU;
- inferir identidade por posição;
- inferir identidade por quantidade ou preço;
- relink automático de `productId`;
- remover item por ausência no payload;
- cancelar item por ausência no payload;
- backfill automático de identidade legada;
- criar `Product` artificialmente;
- alterar `Product` durante reconciliação;
- remover `ExternalOrderItemReference`.

Pedido legado continua sem reconciliação automática quando a identidade externa segura não existe.

Payload parcial continua preservando itens omitidos.

`productId` continua sendo identidade canônica de catálogo e não snapshot mutável.

#### Comportamentos observáveis protegidos por testes

Os testes agora cobrem explicitamente:

1. criação inicial com contagem de itens criados;
2. update stale como `not_evaluated`;
3. campo `items` omitido como preservação sem reconciliação;
4. item conhecido sem alteração;
5. alteração efetiva de snapshot;
6. criação efetiva de novo item externo;
7. conjunto misto com update + criação;
8. conjunto bloqueado com zero writes;
9. identidade legada insegura;
10. retry `P2002` sem contabilizar criação revertida;
11. bloqueio por relink de `productId`;
12. bloqueio por `productId` inválido;
13. bloqueio de novo item cujo `productId` não é válido para o merchant.

#### Ciclo RED → GREEN confirmado

Primeiro ciclo:

- 68 testes focados;
- 58 passaram;
- 10 falharam;
- as 10 falhas eram exclusivamente pela ausência de `itemReconciliation`.

Após implementação inicial:

- 65/68 passaram;
- 3 falharam;
- causa identificada: o resultado observável estava sendo finalizado dentro do gate de escrita.

Correção aplicada:

- resultado observável passou a ser calculado mesmo quando não existe write;
- regras de persistência permaneceram iguais.

Resultado:

- 68/68 testes focados aprovados.

Depois foi ampliado o diagnóstico de bloqueios com `blockReasons`.

Validação final:

- 71/71 testes focados aprovados;
- `pnpm --filter api build` aprovado;
- 8/8 suítes da API aprovadas;
- 78/78 testes da API aprovados;
- `git diff --check` aprovado.

#### Estado arquitetural após este checkpoint

`ExternalOrderIngestionService` agora possui:

- persistência segura de pedidos externos;
- proteção stale;
- reconciliação segura de snapshots;
- criação segura de novos itens externos;
- proteção contra relink automático;
- retry para `P2002` e `P2034`;
- resultado observável estruturado para consumo futuro por adapters.

Ainda não existe neste checkpoint:

- endpoint público de ingestão;
- webhook;
- polling;
- adapter Mercado Livre;
- adapter Shopee;
- registro público via `OrdersController`;
- backfill;
- remoção/cancelamento de item;
- migration nova.

#### Próxima ação exata

Antes de abrir nova funcionalidade:

1. revisar o diff final dos três arquivos;
2. confirmar que o diff contém somente:
   - testes do contrato observável;
   - retorno estruturado em memória;
   - contadores de efeito;
   - diagnóstico de bloqueios;
   - este registro no MASTER;
3. confirmar novamente ausência de operações proibidas;
4. criar um commit único deste checkpoint;
5. publicar somente em `feat/marto-ops-integration`;
6. confirmar o SHA remoto;
7. somente depois iniciar o próximo checkpoint técnico.

Próximo checkpoint técnico candidato após publicação:

- registrar `ExternalOrderIngestionService` no `OrdersModule` como provider/export para uso interno por adapters futuros.

Ainda não criar endpoint público nem integração Mercado Livre/Shopee nesse passo.

### Checkpoint implementado — registro interno da ingestão externa no OrdersModule

O `ExternalOrderIngestionService` foi registrado no `OrdersModule` para poder ser consumido internamente por futuros componentes de integração.

Arquivos deste checkpoint:

- `apps/api/src/modules/orders/orders.module.ts`;
- `apps/api/src/modules/orders/orders.module.spec.ts`.

Nenhum controller, endpoint, webhook, adapter externo, migration ou schema Prisma foi alterado.

#### Alteração aplicada

`OrdersModule` passou a importar:

- `ExternalOrderIngestionService`.

O service passou a constar em:

- `providers`;
- `exports`.

Isso permite que outros módulos internos possam depender do serviço canônico de ingestão sem duplicar sua lógica de persistência.

`PrismaService` não foi registrado novamente no módulo porque `PrismaModule` já é global.

#### Proteção por teste arquitetural

Foi criado `orders.module.spec.ts` com dois contratos:

1. `ExternalOrderIngestionService` deve estar registrado como provider do `OrdersModule`;
2. `ExternalOrderIngestionService` deve ser exportado pelo `OrdersModule`.

Ciclo RED confirmado antes da implementação:

- 1 suíte executada;
- 2 testes executados;
- 2 testes falharam;
- `providers` continha somente `OrdersService`;
- `exports` continha somente `OrdersService`.

Após a implementação:

- 2/2 testes focados aprovados.

#### Validação completa

Após o registro interno:

- `pnpm --filter api test -- orders.module.spec.ts --runInBand` aprovado;
- 2/2 testes focados aprovados;
- `pnpm --filter api build` aprovado;
- 9/9 suítes da API aprovadas;
- 80/80 testes da API aprovados.

O diff do `OrdersModule` foi mantido mínimo:

- 3 adições;
- 2 remoções.

As mudanças lógicas são somente:

1. import de `ExternalOrderIngestionService`;
2. inclusão em `providers`;
3. inclusão em `exports`.

O arquivo mantém seu formato CRLF original.

Não existe espaço ou TAB real no final das linhas alteradas.

A validação de whitespace do arquivo CRLF foi executada com `core.whitespace=cr-at-eol`.

#### Escopo explicitamente não alterado

Este checkpoint NÃO criou:

- endpoint público de ingestão;
- endpoint administrativo de ingestão;
- webhook;
- polling;
- integração Mercado Livre;
- integração Shopee;
- adapter de marketplace;
- controller novo;
- método novo no `OrdersController`;
- migration;
- alteração no Prisma schema;
- tabela de auditoria;
- backfill;
- relink automático;
- remoção de item externo.

O comportamento e as regras do `ExternalOrderIngestionService` publicado no checkpoint anterior permanecem inalterados.

#### Estado arquitetural após este checkpoint

A cadeia interna passa a permitir:

`futuro adapter de canal -> OrdersModule -> ExternalOrderIngestionService -> Prisma`

O `ExternalOrderIngestionService` continua sendo a fronteira canônica responsável pelas regras de ingestão e reconciliação.

Adapters futuros não devem escrever diretamente em:

- `Order`;
- `OrderItem`;
- `ExternalOrderReference`;
- `ExternalOrderItemReference`.

Eles deverão normalizar os dados externos para o contrato canônico e delegar a persistência ao serviço de ingestão.

#### Próxima ação exata

Antes de abrir outro checkpoint técnico:

1. auditar o diff final de:
   - `orders.module.ts`;
   - `orders.module.spec.ts`;
   - este registro no MASTER;
2. confirmar novamente:
   - diff mínimo do módulo;
   - somente provider/export adicionados;
   - nenhuma rota/controller alterado;
   - nenhuma migration;
   - `docs/marto-ia/` fora do Git;
3. criar um commit único deste checkpoint;
4. publicar somente em `feat/marto-ops-integration`;
5. confirmar o SHA remoto.

Somente depois da publicação iniciar o próximo checkpoint.

Próximo checkpoint técnico candidato:

- definir a fronteira interna do primeiro adapter Mercado Livre para aproximar contas desse canal da ingestão canônica;
- o adapter deverá transformar dados específicos do Mercado Livre em `NormalizedExternalOrderInput`;
- ele não deverá possuir lógica própria de persistência de pedidos;
- ainda não criar endpoint público ou webhook antes de essa fronteira estar definida e testada.

### Definição — fronteira interna do adapter Mercado Livre

Após a publicação do registro interno do `ExternalOrderIngestionService`, o próximo checkpoint técnico será a primeira fronteira específica de canal.

Canal da primeira integração:

`Mercado Livre`

A conta utilizada durante desenvolvimento e testes é selecionada através de um `SalesChannel` cadastrado.

O nome escolhido para essa conta é apenas dado de exibição em `SalesChannel.name` e não faz parte do contrato do adapter.

O adapter Mercado Livre deve funcionar da mesma forma para qualquer conta Mercado Livre conectada ao Marto.

O objetivo desta etapa NÃO é ainda conectar a API real.

O objetivo é definir e testar o componente responsável por transformar dados externos já coletados do Mercado Livre em:

`NormalizedExternalOrderInput`

A persistência continuará exclusivamente em:

`ExternalOrderIngestionService.ingest(...)`

#### Separação das responsabilidades

A arquitetura planejada fica dividida em quatro responsabilidades:

1. descoberta de pedidos;
2. coleta/enriquecimento dos recursos externos;
3. normalização para o contrato canônico;
4. ingestão/persistência canônica.

Fluxo conceitual:

`MercadoLivreClient futuro`

→ `MercadoLivreSyncService futuro`

→ `MercadoLivreOrderAdapter.normalize(...)`

→ `ExternalOrderIngestionService.ingest(...)`

O adapter de normalização será puro.

#### Regra de independência da conta

O adapter Mercado Livre é específico da plataforma Mercado Livre, não de uma loja ou conta específica.

O caller fornecerá o `salesChannelId` da conta que está sendo processada.

O adapter não poderá:

- conhecer o nome escolhido para a conta;
- procurar uma conta por nome;
- comparar nomes como condição de negócio;
- possuir IDs fixos de conta;
- assumir que existe apenas uma conta Mercado Livre por Merchant;
- possuir qualquer constante referente ao nome de uma loja-piloto.

Assim, um mesmo Merchant poderá futuramente possuir múltiplos `SalesChannel` do tipo `MERCADO_LIVRE`, cada um com seu próprio `externalAccountId` e nome de exibição.

Do mesmo modo, vários Merchants poderão utilizar o mesmo adapter sem qualquer alteração de código.

Ele NÃO poderá:

- fazer chamada HTTP;
- conhecer access token;
- renovar token;
- consultar banco;
- usar `PrismaService`;
- criar `Order`;
- criar `OrderItem`;
- criar `ExternalOrderReference`;
- criar `ExternalOrderItemReference`;
- alterar `Product`;
- chamar controller;
- executar polling;
- receber webhook.

#### Local arquitetural candidato

O código específico do Mercado Livre não deverá ser colocado dentro do núcleo canônico de `orders`.

Estrutura candidata:

`apps/api/src/modules/integrations/mercado-livre/`

Primeiro componente:

`mercado-livre-order.adapter.ts`

Teste correspondente:

`mercado-livre-order.adapter.spec.ts`

O módulo Nest e a orquestração HTTP poderão ser criados em checkpoint posterior.

Não criar ainda `MercadoLivreModule` apenas para hospedar um mapper puro.

#### Fonte do pedido

A listagem/search de pedidos deverá futuramente ser usada para:

- descobrir IDs;
- percorrer paginação;
- identificar pedidos que precisam de atualização.

Ela NÃO deverá ser considerada automaticamente o snapshot autoritativo enviado para a ingestão.

Antes de normalizar um pedido, o fluxo futuro deverá obter o detalhe do order correspondente.

Recurso conceitual:

`GET /orders/{order_id}`

O relógio principal usado para:

`externalUpdatedAt`

deverá vir do:

`last_updated`

do detalhe do pedido.

Não usar `date_last_updated` de resultados de busca como substituto automático do `last_updated` autoritativo do detalhe.

Isso protege a regra stale já existente em `ExternalOrderIngestionService`.

#### Identidade do pedido

A identidade externa canônica do pedido Mercado Livre será:

`String(order.id)`

Portanto:

`externalOrderId = String(order.id)`

Nunca usar como `externalOrderId`:

- `pack_id`;
- shipment id;
- payment id;
- buyer id;
- número de NF;
- SKU;
- posição na listagem.

#### Packs

`pack_id` NÃO representa a identidade canônica deste `Order`.

Quando presente, deverá ser preservado apenas como informação externa/metadata.

Um pack poderá futuramente ser utilizado para:

- agrupamento visual;
- logística;
- relacionamento entre orders;
- conferência operacional.

Mas não deverá fazer vários orders externos perderem suas identidades individuais.

Não criar nesta etapa uma entidade Marto específica para pack.

#### Identidade do item externo

Na primeira versão, o detalhe de order Mercado Livre deverá possuir exatamente um item-variação válido para entrar no adapter.

A identidade externa do item será derivada diretamente do identificador externo da publicação:

`externalItemId = item.id`

Essa decisão é válida porque a referência externa de item no Marto já é escopada por:

`ExternalOrderReference`

Portanto a mesma publicação pode aparecer em vários pedidos sem colisão global.

Não usar como identidade:

- título;
- SKU;
- posição do array;
- quantidade;
- preço;
- `productId` Marto.

`variation_id` será snapshot da variação e não será usado para relink automático de catálogo.

Se a estrutura recebida contradizer o contrato esperado — por exemplo, item sem `item.id` — o adapter deverá falhar explicitamente.

Não inventar identificador substituto.

#### `productId` canônico

O campo:

`NormalizedExternalOrderItem.productId`

representa o catálogo canônico do Marto.

Portanto o adapter Mercado Livre NÃO poderá preencher `productId` automaticamente a partir de:

- `item.id`;
- `variation_id`;
- `seller_sku`;
- `seller_custom_field`;
- título;
- categoria;
- posição.

Enquanto não existir uma política explícita e segura de vinculação catálogo ↔ canal:

`productId` deverá permanecer ausente.

Isso preserva a regra já aprovada de que reconciliação de pedido não realiza relink automático de produto.

#### Snapshot do item

O adapter poderá normalizar:

- `externalItemId`;
- título;
- SKU externo;
- variação;
- quantidade;
- preço unitário.

SKU:

1. usar `seller_sku` quando existir e for não vazio;
2. caso contrário, usar `seller_custom_field` quando existir e for não vazio;
3. caso contrário, manter SKU ausente.

SKU continua sendo snapshot.

Não usar SKU como identidade canônica.

Variação poderá preservar, quando disponível:

- `variation_id`;
- `variation_attributes`.

A estrutura deverá continuar sendo JSON de snapshot.

#### Datas

`date_created` deverá alimentar:

`externalCreatedAt`

`last_updated` do detalhe deverá alimentar:

`externalUpdatedAt`

Datas inválidas não deverão ser silenciosamente convertidas em `new Date()` do momento atual.

Não inventar horário.

#### Status externo

O status original do Mercado Livre deverá sempre poder ser preservado em:

`externalStatus`

A conversão para:

`canonicalStatus`

deverá ser explícita e testada.

Não mapear estados apenas por semelhança de nome.

Especialmente:

`confirmed` do Mercado Livre

NÃO deve automaticamente significar:

`CONFIRMED_BY_SELLER`

do Marto.

`CONFIRMED_BY_SELLER` representa uma etapa semântica própria do lifecycle Marto.

#### Política inicial conservadora de status

A primeira implementação deverá começar somente com mapeamentos cuja semântica esteja suficientemente clara.

Base inicial:

- order `paid` → `PAID`;
- order `cancelled` → `CANCELLED`;
- shipment `delivered` → `DELIVERED`;
- shipment `shipped` → `IN_TRANSIT`.

Para `ready_to_ship`, o substatus deverá ser considerado antes do mapeamento.

Casos que indiquem coleta/trânsito, como:

- `picked_up`;
- `authorized_by_carrier`;
- `in_hub`;

poderão ser tratados como candidatos a:

`IN_TRANSIT`

mas essa regra deverá possuir teste explícito antes de ser implementada.

`ready_to_ship` sem evidência de coleta não deverá ser confundido automaticamente com `IN_TRANSIT`.

Estados ainda sem política aprovada não deverão ser inventados.

O adapter deverá falhar de maneira explícita quando um status necessário para criação não possuir mapeamento seguro.

#### Separação Order x Shipment

Dados comerciais do pedido e dados logísticos não deverão ser confundidos.

O snapshot de order poderá fornecer, entre outros:

- ID;
- status comercial;
- datas;
- comprador;
- item;
- quantidade;
- preço;
- pack;
- moeda.

O recurso de shipment deverá futuramente fornecer o enriquecimento logístico.

O adapter deverá aceitar shipment como informação opcional.

Ausência de shipment NÃO deverá fazer o adapter:

- inventar endereço;
- inventar CEP;
- inventar cidade;
- inventar estado;
- inventar destinatário;
- inventar status logístico.

#### Endereço de destino

Quando o snapshot enriquecido de shipment possuir endereço de destino válido, poderão ser normalizados:

- `recipientName`;
- `destinationZipCode`;
- `city`;
- `state`;
- `destinationAddress`.

`destinationAddress` deverá conter um snapshot estruturado dos campos relevantes recebidos.

Não persistir automaticamente o payload bruto inteiro do shipment como endereço.

#### Metadata externa

Informações externas úteis que não possuem campo canônico próprio poderão ser preservadas em `metadata`.

Candidatos iniciais:

- `packId`;
- `shippingId`;
- `currencyId`;
- `totalAmount`;
- `paidAmount`;
- seller externo;
- site do marketplace;
- detalhes externos de status quando necessários.

Metadata não poderá ser usada para duplicar lógica canônica.

#### Dados do comprador

Dados disponíveis do buyer poderão alimentar:

- `buyerName`;
- `buyerContact`.

A composição de nome deverá usar apenas campos recebidos.

Não inventar nome quando os dados estiverem ocultos ou ausentes.

IDs externos do comprador são metadata/contato externo.

Eles NÃO deverão ser tratados como `userId` canônico do Marto.

#### Payload parcial

O adapter deverá respeitar o significado atual de payload parcial.

Se determinado enriquecimento não estiver disponível:

- omitir o campo;
- preservar a ausência;
- não preencher com `null` apenas para apagar snapshot existente.

Especialmente em updates, ausência não deve virar remoção implícita.

#### Limites da primeira implementação

O primeiro `MercadoLivreOrderAdapter` NÃO fará:

- paginação;
- OAuth;
- refresh token;
- HTTP;
- webhook;
- polling;
- persistência;
- lookup de `Product`;
- criação de `Product`;
- backfill;
- agrupamento por pack;
- NF;
- Mercado Pago;
- reclamações;
- devoluções;
- mediações;
- cotação de frete;
- rastreamento ativo.

Essas responsabilidades serão adicionadas em checkpoints separados.

#### Testes mínimos do primeiro adapter

A implementação deverá começar por testes focados.

Cobertura mínima planejada:

1. transforma `order.id` em `externalOrderId` string;
2. usa o `salesChannelId` recebido pelo caller;
3. nunca usa `pack_id` como `externalOrderId`;
4. preserva `pack_id` em metadata quando presente;
5. mapeia `paid` para `PAID`;
6. mapeia `cancelled` para `CANCELLED`;
7. mapeia shipment `delivered` para `DELIVERED`;
8. mapeia shipment `shipped` para `IN_TRANSIT`;
9. não converte automaticamente ML `confirmed` em `CONFIRMED_BY_SELLER`;
10. usa `item.id` como `externalItemId`;
11. não preenche `productId` a partir do item Mercado Livre;
12. preserva SKU somente como snapshot;
13. preserva `variation_id` e atributos como snapshot;
14. normaliza quantidade e preço unitário;
15. usa `date_created` como `externalCreatedAt`;
16. usa `last_updated` do detalhe como `externalUpdatedAt`;
17. rejeita data obrigatória inválida em vez de inventar horário;
18. ausência de shipment não inventa endereço;
19. shipment enriquecido pode preencher CEP/cidade/estado/endereço;
20. item sem identificador externo falha explicitamente;
21. estrutura de item incompatível falha sem inferência por posição/título/SKU;
22. status necessário sem política segura falha explicitamente.

#### Sequência planejada depois desta definição

Depois de proteger esta definição documental:

1. criar somente o spec do mapper;
2. observar RED;
3. implementar o mapper puro;
4. executar testes focados;
5. executar build;
6. executar suíte completa da API;
7. registrar o resultado no MASTER;
8. auditar;
9. commit;
10. push somente em `feat/marto-ops-integration`.

Somente depois avaliar o próximo componente:

`MercadoLivreSyncService`

Esse serviço futuro poderá coordenar:

- descoberta/paginação;
- GET de detalhe;
- GET de shipment;
- chamada ao mapper;
- chamada a `ExternalOrderIngestionService.ingest(...)`.

Ainda não criar endpoint público nem webhook.