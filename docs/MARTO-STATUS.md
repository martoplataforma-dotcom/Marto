# Marto — Status Atual

Atualizado em: 18/07/2026  
Situação: MVP funcional em evolução  
Uso deste documento: fonte de verdade sobre o estado atual do projeto

## 1. Visão do Marto

O Marto será um ecossistema integrado de comércio, serviços, logística, reputação verificada e dados.

A visão completa inclui:

- lojas e catálogo;
- pedidos e pagamentos;
- pós-venda;
- estoque;
- logística e transportadoras;
- cotação e rastreio;
- assistência ao cliente;
- prestadores de serviços;
- fábricas;
- representantes;
- reputação baseada em experiências reais;
- dados operacionais;
- automações e inteligência;
- serviços financeiros no futuro.

O Marto não deve tentar construir todo o ecossistema de uma vez.

A estratégia atual é entrar no mercado como uma central operacional útil para lojas e fábricas, conquistar usuários reais e expandir de forma modular.

## 2. Problema inicial escolhido

Lojas e fábricas vendem por marketplaces, ERPs e outros canais, mas o trabalho não termina quando o pedido é recebido.

Depois da venda ainda existem:

- confirmação e organização do pedido;
- controle de prazos;
- separação;
- estoque;
- cotação de transporte;
- coleta;
- rastreio;
- contato com transportadoras;
- atendimento ao cliente;
- atrasos;
- trocas;
- devoluções;
- assistências;
- registros e relatórios.

Essas informações normalmente ficam espalhadas entre ERP, marketplace, planilhas, WhatsApp, e-mail e sites de transportadoras.

O primeiro valor real do Marto será centralizar essa operação.

## 3. Estratégia atual

A prioridade é transformar o Marto em um produto usado diariamente antes de ampliar o ecossistema.

Ordem estratégica:

1. proteger dados, usuários e operações;
2. consolidar a base técnica;
3. criar a central operacional de pedidos e pós-venda;
4. conectar pedidos reais de Tiny ERP e marketplaces;
5. organizar estoque, logística, cotação, rastreio e assistência;
6. testar com a Store5 e outros usuários-piloto;
7. medir uso e problemas reais;
8. evoluir os módulos conforme a demanda;
9. expandir gradualmente para o ecossistema completo.

## 4. Arquitetura atual

O Marto utiliza um monorepositório com as seguintes partes principais:

| Parte | Tecnologia | Responsabilidade |
|---|---|---|
| `apps/web` | Next.js | Interface web e painéis |
| `apps/api` | NestJS | API, regras e autenticação |
| `packages/db` | Prisma | Modelos e acesso ao banco |
| Banco principal | PostgreSQL | Persistência dos dados |
| Filas e tarefas | Redis e BullMQ | Processamento assíncrono |
| Gerenciador | pnpm | Dependências e workspaces |

Portas normalmente utilizadas:

- Web: `3000`;
- API: `3001`.

## 5. Funcionalidades já existentes

### 5.1 Identidade e acesso

Já existem estruturas para:

- cadastro e login;
- autenticação por token;
- perfil universal;
- `handle` público único;
- escolha de papel;
- redirecionamento por papel;
- status de usuário;
- perfis públicos em `/u/[handle]`.

Papéis existentes:

- consumidor;
- lojista;
- prestador de serviço;
- transportadora;
- fábrica;
- representante;
- administrador.

### 5.2 Consumidor

Já existem estruturas para:

- painel do consumidor;
- preferências de cidade e CEP;
- catálogo;
- visualização de produtos;
- checkout;
- lista de pedidos;
- detalhe do pedido;
- timeline;
- pagamento simulado;
- cancelamento;
- solicitação de devolução;
- avaliação da entrega;
- publicação verificada ligada a um pedido entregue.

### 5.3 Lojista

Já existem estruturas para:

- painel do lojista;
- perfil comercial;
- vitrine pública;
- cadastro e edição de produtos;
- múltiplas imagens;
- ficha técnica;
- vendas;
- resumo de pedidos;
- produtos de destaque;
- atualização de etapas do pedido.

### 5.4 Pedidos

Já existe um fluxo inicial de pedido com estados como:

- criado;
- pago;
- confirmado pelo vendedor;
- pronto para coleta;
- em trânsito;
- entregue;
- concluído;
- cancelado;
- devolução solicitada.

Existem endpoints para comprador e vendedor consultarem e atualizarem pedidos.

### 5.5 Pagamentos

Existe uma estrutura de pagamento Pix simulada.

Ela é útil para desenvolvimento, mas ainda não representa um meio de pagamento real pronto para produção.

### 5.6 Logística

Já existem estruturas para:

- criação de remessa;
- vínculo entre pedido e remessa;
- atualização do transporte;
- coleta;
- trânsito;
- entrega;
- avaliação;
- escolha entre Correios, transportadora e retirada;
- estimativa inicial de prazo e preço;
- validação de modalidades permitidas pelo produto e vendedor.

### 5.7 Prestadores e transportadoras

Já existem estruturas iniciais para:

- perfil de prestador;
- diferenciação entre prestador genérico e transportadora;
- CPF ou CNPJ;
- endereço;
- cidade e estado;
- região atendida;
- raio de atendimento;
- especialidades.

Esse módulo ainda precisa ser transformado em operação real.

### 5.8 Fábricas e representantes

Existem estruturas iniciais para:

- painel de fábrica;
- status da fábrica;
- indicadores;
- resumo de catálogo;
- resumo de pedidos;
- perfil de representante;
- região;
- código de convite.

Esses módulos ainda estão em estágio inicial.

### 5.9 Marto Social

Já existe uma base de reputação ligada a acontecimentos reais.

O conceito atual é:

- sem feed genérico;
- publicação vinculada a pedido entregue;
- produto e loja identificados;
- histórico verificável;
- reputação como consequência da operação real.

## 6. Ativos operacionais paralelos

Existem ferramentas e protótipos que ajudam na compreensão do problema, mas não devem ser considerados automaticamente integrados ao Marto principal.

Entre eles:

- sistema HTML usado na operação de e-commerce;
- planilhas de pedidos, cotações e rastreio;
- integração experimental com Tiny ERP por Google Apps Script;
- modelos de mensagens para clientes e transportadoras;
- protótipos de controle de estoque;
- pasta local `tmp-controle-de-estoque`, atualmente isolada e ignorada pelo Git.

Esses ativos podem fornecer regras de negócio para o Marto, mas precisam ser analisados e reimplementados com segurança dentro da arquitetura principal.

## 7. Estado real do produto

O Marto possui uma base ampla e várias funcionalidades de MVP.

Entretanto, ainda não deve ser tratado como produto pronto para operação pública em escala.

Classificação atual:

- arquitetura inicial: existente;
- experiência visual: parcialmente existente;
- fluxo de comércio: funcional como MVP;
- pedidos: funcional como MVP;
- logística: parcialmente funcional;
- pagamentos: simulado;
- integrações externas: experimentais ou pendentes;
- estoque operacional: pendente de consolidação;
- pós-venda centralizado: pendente;
- testes automatizados: precisam ser ampliados;
- segurança de produção: precisa de revisão;
- monitoramento e auditoria: pendentes;
- operação com usuários reais: ainda precisa ser estruturada e medida.

## 8. Riscos prioritários conhecidos

| Risco | Impacto |
|---|---|
| Valores financeiros aceitos do cliente sem validação completa no servidor | Manipulação de preços e prejuízo |
| Autorização incompleta em rotas privadas | Acesso indevido a dados ou operações |
| Funcionalidades mock disponíveis fora do desenvolvimento | Operações falsas em produção |
| Token armazenado no navegador | Maior impacto em caso de ataque XSS |
| Falta de isolamento rigoroso entre contas e organizações | Vazamento ou alteração de dados |
| Alterações de banco sem processo seguro | Perda ou inconsistência de dados |
| Poucos testes nos fluxos críticos | Regressões em pedidos e pagamentos |
| Falta de logs e auditoria completos | Dificuldade para investigar problemas |
| Dependência de processos manuais e planilhas | Erros e dificuldade de escala |
| Construção de muitos módulos antes de validar usuários | Aumento de custo sem comprovação de valor |

Esses riscos deverão ser confirmados tecnicamente e tratados na fase de segurança e integridade.

## 9. Funcionalidades ainda não consolidadas

Ainda precisam ser construídas ou fortalecidas:

- importação real e segura de pedidos do Tiny ERP;
- integração com Mercado Livre;
- central operacional de pedidos;
- estoque unificado;
- cotação com transportadoras;
- rastreio centralizado;
- histórico de contatos;
- atendimento e assistência;
- alertas de atraso;
- automações de WhatsApp;
- permissões por organização;
- pagamento real;
- cobrança de assinatura;
- relatórios operacionais;
- métricas de uso;
- logs de auditoria;
- monitoramento;
- backups testados;
- recuperação de falhas;
- implantação segura em produção.

## 10. Público inicial

O público inicial deverá ser formado por:

- lojas que vendem em marketplaces;
- lojas que utilizam Tiny ERP;
- fábricas que precisam acompanhar pedidos e entregas;
- operações que ainda dependem de planilhas e WhatsApp;
- negócios com dificuldades de pós-venda e logística.

A Store5 poderá funcionar como operação-piloto para validar o produto.

## 11. Resultado esperado da fase atual

A fase atual estará avançando corretamente quando:

- os riscos críticos estiverem controlados;
- pedidos reais puderem entrar no Marto com segurança;
- uma loja conseguir organizar o trabalho diário no sistema;
- prazos, estoque, transporte e assistência estiverem centralizados;
- nenhuma informação importante depender apenas de uma planilha;
- ações importantes possuírem histórico;
- usuários reais utilizarem o Marto repetidamente;
- os próximos módulos forem escolhidos por dados e problemas reais.

## 12. Regra de evolução

Toda nova funcionalidade deverá responder:

1. Qual problema real ela resolve?
2. Quem utilizará?
3. Com que frequência será utilizada?
4. Qual dado precisa ser protegido?
5. Qual é a menor versão útil?
6. Como saberemos se funcionou?
7. Ela fortalece a central operacional ou apenas aumenta o projeto?

Funcionalidades sem problema real comprovado não devem passar à frente das prioridades operacionais.

## 13. Próximos documentos

Depois deste arquivo serão criados:

- `docs/MARTO-MASTER-PLAN.md`;
- `docs/phases/P0-SEGURANCA-E-INTEGRIDADE.md`;
- `docs/phases/P1-MARTO-OPS.md`;
- checklists das fases seguintes.

Cada fase deverá possuir:

- objetivo;
- escopo;
- dependências;
- tarefas;
- critérios de aceite;
- testes;
- riscos;
- indicadores;
- definição de concluído.
