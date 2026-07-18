# P0 — Segurança e Integridade

Atualizado em: 18/07/2026

Status da fase: NÃO INICIADA

Prioridade: CRÍTICA

Documento mestre: `docs/MARTO-MASTER-PLAN.md`

Estado do projeto: `docs/MARTO-STATUS.md`

Regras do repositório: `AGENTS.md`

## 1. Objetivo

Garantir que o Marto possa receber usuários, empresas, pedidos e dados reais sem riscos críticos conhecidos de:

- acesso indevido;
- manipulação financeira;
- perda de dados;
- vazamento de informações;
- duplicação de operações;
- uso de funcionalidades simuladas em produção;
- migrations inseguras;
- falhas silenciosas;
- ausência de rastreabilidade.

A P0 protege tudo que será construído depois.

Nenhuma expansão ampla do Marto deverá passar à frente de um risco crítico aberto.

## 2. Resultado esperado

Ao final da P0:

- rotas privadas validarão autenticação, papel e acesso ao recurso;
- preços e totais serão determinados pelo servidor;
- funcionalidades mock estarão bloqueadas em produção;
- dados de empresas diferentes permanecerão isolados;
- entradas externas serão validadas;
- migrations possuirão processo seguro;
- backup e restauração estarão testados;
- ações críticas possuirão histórico;
- erros importantes estarão visíveis;
- fluxos críticos possuirão testes;
- build e verificações estarão automatizados;
- riscos restantes estarão documentados.

## 3. Escopo incluído

Esta fase inclui:

- baseline técnico;
- segredos;
- variáveis de ambiente;
- autenticação;
- sessão;
- autorização;
- propriedade de recursos;
- isolamento de dados;
- preços;
- pedidos;
- pagamentos;
- mocks;
- validação de entradas;
- proteção da API;
- banco;
- migrations;
- backups;
- logs;
- auditoria;
- monitoramento;
- testes críticos;
- CI;
- implantação;
- recuperação;
- documentação de segurança.

## 4. Escopo excluído

Esta fase não inclui:

- redesenho visual;
- novas páginas de marketplace;
- novos painéis sem relação com segurança;
- integração completa com Tiny;
- integração completa com Mercado Livre;
- automação completa de WhatsApp;
- estoque avançado;
- cotação automática;
- Marto Pay;
- Marto Copilot;
- expansão do Marto Social;
- microsserviços;
- refatoração estética ampla.

Uma correção poderá tocar um módulo existente apenas quando isso for necessário para eliminar um risco da P0.

## 5. Instruções obrigatórias para qualquer nova conversa

Antes de executar qualquer tarefa desta fase:

1. Ler integralmente `AGENTS.md`.
2. Ler integralmente `docs/MARTO-STATUS.md`.
3. Ler integralmente `docs/MARTO-MASTER-PLAN.md`.
4. Ler integralmente este arquivo.
5. Executar `git status --short`.
6. Verificar branch e commit atual.
7. Identificar o primeiro item não concluído e não bloqueado.
8. Inspecionar os arquivos relacionados.
9. Explicar o que será feito.
10. Informar todos os caminhos completos.
11. Executar somente um item por vez.
12. Testar somente o escopo alterado.
13. Apresentar evidências.
14. Aguardar validação do usuário.
15. Atualizar este checklist apenas depois da validação.
16. Não fazer commit ou push sem solicitação.
17. Não iniciar a próxima tarefa automaticamente.

## 6. Texto para iniciar uma nova conversa

Copiar e enviar:

```text
Estamos executando a fase P0 do projeto Marto.

Repositório:
C:\Users\Luu\Desktop\Marto

Leia integralmente, nesta ordem:

1. C:\Users\Luu\Desktop\Marto\AGENTS.md
2. C:\Users\Luu\Desktop\Marto\docs\MARTO-STATUS.md
3. C:\Users\Luu\Desktop\Marto\docs\MARTO-MASTER-PLAN.md
4. C:\Users\Luu\Desktop\Marto\docs\phases\P0-SEGURANCA-E-INTEGRIDADE.md

Depois confira o Git e localize o primeiro item não concluído da P0.

Execute somente esse item.

Antes de alterar qualquer arquivo, explique o que fará, por que fará, quais arquivos serão alterados e quais riscos existem.

Não avance para a tarefa seguinte sem minha validação.
```

## 7. Regras de marcação

- `[ ]` significa pendente.
- `[x]` significa concluído e validado.
- `BLOQUEADO` deverá ser escrito ao lado do item quando existir dependência.
- Nenhum item será marcado como concluído somente porque o código foi escrito.
- Todo item concluído deverá possuir evidência.
- Evidência poderá ser teste, build, log controlado, diff, commit ou validação manual.
- Falhas encontradas deverão permanecer registradas.
- Riscos aceitos deverão possuir justificativa.

## 8. Pré-requisitos já concluídos

- [x] `AGENTS.md` criado e enviado ao GitHub.
- [x] `docs/MARTO-STATUS.md` criado e enviado ao GitHub.
- [x] `docs/MARTO-MASTER-PLAN.md` criado e enviado ao GitHub.
- [x] Configuração obsoleta `baseUrl` removida de `apps/api/tsconfig.json`.
- [x] Build da API executado com sucesso após a remoção do `baseUrl`.

Esses itens não substituem a criação do baseline oficial da P0.

## 9. Ordem obrigatória dos blocos

| Ordem | Bloco | Prioridade | Dependência |
|---:|---|---|---|
| 1 | P0-00 — Baseline | Crítica | Nenhuma |
| 2 | P0-01 — Segredos | Crítica | Baseline |
| 3 | P0-02 — Ambientes | Crítica | Segredos |
| 4 | P0-03 — Autenticação | Crítica | Ambientes |
| 5 | P0-04 — Autorização | Crítica | Autenticação |
| 6 | P0-05 — Integridade financeira | Crítica | Autorização |
| 7 | P0-06 — Mocks | Crítica | Ambientes |
| 8 | P0-07 — Proteção da API | Alta | Autenticação |
| 9 | P0-08 — Banco e backups | Crítica | Baseline |
| 10 | P0-09 — Integrações e filas | Alta | Ambientes |
| 11 | P0-10 — Logs e auditoria | Alta | Autorização |
| 12 | P0-11 — Testes e CI | Crítica | Blocos anteriores |
| 13 | P0-12 — Liberação da P0 | Crítica | Todos |

A ordem poderá mudar somente se uma dependência técnica comprovada exigir.

## 10. Janela de planejamento

As janelas são estimativas internas, não promessas.

| Bloco | Janela indicativa |
|---|---|
| P0-00 | 1 dia |
| P0-01 | 1 a 2 dias |
| P0-02 | 1 a 2 dias |
| P0-03 | 2 a 4 dias |
| P0-04 | 3 a 5 dias |
| P0-05 | 2 a 4 dias |
| P0-06 | 1 a 2 dias |
| P0-07 | 2 a 4 dias |
| P0-08 | 2 a 4 dias |
| P0-09 | 1 a 2 dias |
| P0-10 | 2 a 3 dias |
| P0-11 | 3 a 5 dias |
| P0-12 | 1 a 2 dias |

A estimativa deverá ser revisada depois do baseline.

## 11. SLA interno da fase

| Severidade | Exemplo | Tratamento |
|---|---|---|
| Crítica | Vazamento, acesso cruzado, perda de dados, manipulação financeira | Bloquear avanço e tratar imediatamente |
| Alta | Falha que bloqueia piloto ou causa duplicação | Analisar no mesmo dia útil |
| Média | Falha com alternativa manual segura | Registrar e planejar na P0 |
| Baixa | Melhoria sem risco operacional | Registrar para fase futura |

Nenhum item crítico poderá ser adiado para a P1 sem decisão registrada.

---

# P0-00 — Baseline técnico e de segurança

## Objetivo

Registrar o estado real antes de qualquer correção.

## Checklist

- [ ] P0-00.1 Confirmar que o terminal está na raiz `C:\Users\Luu\Desktop\Marto`.
- [ ] P0-00.2 Executar `git status --short`.
- [ ] P0-00.3 Confirmar branch atual.
- [ ] P0-00.4 Registrar o commit inicial da P0.
- [ ] P0-00.5 Confirmar que não existem mudanças desconhecidas.
- [ ] P0-00.6 Identificar o gerenciador de pacotes e lockfile oficial.
- [ ] P0-00.7 Registrar versões de Node.js, pnpm, NestJS, Next.js, Prisma e TypeScript.
- [ ] P0-00.8 Confirmar a versão do TypeScript usada no terminal.
- [ ] P0-00.9 Confirmar a versão do TypeScript usada pelo VS Code.
- [ ] P0-00.10 Verificar divergências entre `package.json`, lockfile e ambiente.
- [ ] P0-00.11 Executar instalação verificável sem atualizar dependências.
- [ ] P0-00.12 Executar build da API.
- [ ] P0-00.13 Executar build da Web.
- [ ] P0-00.14 Executar testes existentes da API.
- [ ] P0-00.15 Executar testes existentes da Web, se houver.
- [ ] P0-00.16 Executar validação do Prisma.
- [ ] P0-00.17 Listar migrations existentes.
- [ ] P0-00.18 Identificar erros de lint sem aplicar correção automática ampla.
- [ ] P0-00.19 Mapear variáveis de ambiente pelos nomes, sem exibir valores.
- [ ] P0-00.20 Mapear serviços necessários: PostgreSQL, Redis, storage e integrações.
- [ ] P0-00.21 Mapear rotas e módulos da API.
- [ ] P0-00.22 Mapear fluxos críticos da Web.
- [ ] P0-00.23 Registrar falhas encontradas.
- [ ] P0-00.24 Classificar falhas por severidade.
- [ ] P0-00.25 Definir o primeiro risco técnico a ser corrigido.

## Evidência mínima

- branch;
- commit;
- status do Git;
- versões;
- resultado dos builds;
- resultado dos testes;
- resultado do Prisma;
- lista de falhas;
- riscos classificados.

## Definição de concluído

O baseline deverá permitir comparar o estado anterior e posterior à P0.

---

# P0-01 — Segredos e credenciais

## Objetivo

Impedir exposição de senhas, tokens, chaves e credenciais.

## Checklist

- [ ] P0-01.1 Conferir `.gitignore`.
- [ ] P0-01.2 Confirmar que `.env` não está rastreado.
- [ ] P0-01.3 Confirmar que arquivos de configuração local não estão rastreados.
- [ ] P0-01.4 Procurar segredos em arquivos rastreados.
- [ ] P0-01.5 Procurar tokens, senhas e chaves no histórico público.
- [ ] P0-01.6 Verificar credenciais de banco.
- [ ] P0-01.7 Verificar segredos JWT.
- [ ] P0-01.8 Verificar tokens de Tiny, Mercado Livre e outros parceiros.
- [ ] P0-01.9 Verificar URLs privadas que contenham credenciais.
- [ ] P0-01.10 Verificar logs e mensagens de erro.
- [ ] P0-01.11 Criar ou revisar arquivo `.env.example` sem valores reais.
- [ ] P0-01.12 Documentar todas as variáveis obrigatórias.
- [ ] P0-01.13 Definir armazenamento de segredos por ambiente.
- [ ] P0-01.14 Planejar criptografia de credenciais de integrações.
- [ ] P0-01.15 Rotacionar qualquer credencial que tenha sido exposta.
- [ ] P0-01.16 Habilitar proteção contra novos segredos no GitHub, quando disponível.
- [ ] P0-01.17 Garantir que testes não imprimam segredos.
- [ ] P0-01.18 Garantir que logs ocultem tokens e senhas.
- [ ] P0-01.19 Registrar resultado da auditoria sem copiar valores sensíveis.

## Regra de segurança

Nenhum segredo deverá ser colado na conversa, terminal compartilhado, documentação ou commit.

## Definição de concluído

- nenhum segredo ativo identificado no código atual;
- credenciais expostas rotacionadas;
- arquivos locais ignorados;
- exemplo de ambiente seguro;
- logs com ocultação;
- processo documentado.

---

# P0-02 — Ambientes e configuração de produção

## Objetivo

Fazer o sistema iniciar de forma segura e falhar quando uma configuração crítica estiver ausente.

## Checklist

- [ ] P0-02.1 Mapear ambientes local, teste, homologação e produção.
- [ ] P0-02.2 Validar `NODE_ENV`.
- [ ] P0-02.3 Validar presença das variáveis obrigatórias na inicialização.
- [ ] P0-02.4 Impedir segredo JWT fraco ou padrão.
- [ ] P0-02.5 Impedir conexão de produção com banco de desenvolvimento.
- [ ] P0-02.6 Impedir uso de dados seed em produção.
- [ ] P0-02.7 Criar lista permitida de origens CORS.
- [ ] P0-02.8 Impedir CORS aberto com credenciais.
- [ ] P0-02.9 Definir política de cookies por ambiente, se adotados.
- [ ] P0-02.10 Definir URLs públicas da Web e API por ambiente.
- [ ] P0-02.11 Validar conexão com Redis.
- [ ] P0-02.12 Definir comportamento seguro quando Redis estiver indisponível.
- [ ] P0-02.13 Separar logs de desenvolvimento e produção.
- [ ] P0-02.14 Impedir stack trace sensível em produção.
- [ ] P0-02.15 Criar verificação de configuração no build ou startup.
- [ ] P0-02.16 Documentar como iniciar cada ambiente.
- [ ] P0-02.17 Testar inicialização com configuração válida.
- [ ] P0-02.18 Testar falha controlada com configuração inválida.

## Definição de concluído

O Marto não deverá iniciar em modo inseguro quando faltar uma configuração crítica.

---

# P0-03 — Autenticação e sessão

## Objetivo

Garantir identidade confiável do usuário durante toda a sessão.

## Checklist

- [ ] P0-03.1 Mapear cadastro.
- [ ] P0-03.2 Mapear login.
- [ ] P0-03.3 Mapear `/me`.
- [ ] P0-03.4 Mapear logout.
- [ ] P0-03.5 Mapear recuperação de acesso, se existir.
- [ ] P0-03.6 Revisar geração do token.
- [ ] P0-03.7 Revisar validação do token.
- [ ] P0-03.8 Revisar tempo de expiração.
- [ ] P0-03.9 Verificar segredo e algoritmo JWT.
- [ ] P0-03.10 Verificar usuário inativo, bloqueado ou suspenso.
- [ ] P0-03.11 Impedir sessão de usuário desativado.
- [ ] P0-03.12 Revisar armazenamento atual `marto_access`.
- [ ] P0-03.13 Documentar decisão entre token local e cookie HttpOnly.
- [ ] P0-03.14 Avaliar proteção contra XSS.
- [ ] P0-03.15 Avaliar proteção contra CSRF caso cookies sejam usados.
- [ ] P0-03.16 Definir renovação ou novo login após expiração.
- [ ] P0-03.17 Garantir logout efetivo.
- [ ] P0-03.18 Revisar hash de senha.
- [ ] P0-03.19 Escolher uma única biblioteca de hash quando possível.
- [ ] P0-03.20 Definir requisito mínimo de senha.
- [ ] P0-03.21 Impedir enumeração de e-mails no login.
- [ ] P0-03.22 Aplicar limite de tentativas.
- [ ] P0-03.23 Registrar tentativas suspeitas sem registrar senha.
- [ ] P0-03.24 Testar token ausente.
- [ ] P0-03.25 Testar token inválido.
- [ ] P0-03.26 Testar token expirado.
- [ ] P0-03.27 Testar usuário suspenso.
- [ ] P0-03.28 Testar logout.
- [ ] P0-03.29 Testar acesso normal após login.
- [ ] P0-03.30 Atualizar documentação da sessão.

## Decisão obrigatória

A estratégia de sessão deverá ser registrada antes de uma mudança ampla na Web.

## Definição de concluído

- sessão possui expiração;
- usuário inválido não acessa;
- senha é protegida;
- tentativas são limitadas;
- estratégia de armazenamento está documentada;
- testes críticos passam.

---

# P0-04 — Autorização, papéis e propriedade

## Objetivo

Impedir que um usuário acesse ou altere recursos de outro usuário ou empresa.

## Checklist geral

- [ ] P0-04.1 Criar matriz completa de rotas.
- [ ] P0-04.2 Classificar cada rota como pública ou privada.
- [ ] P0-04.3 Definir papéis permitidos por rota.
- [ ] P0-04.4 Definir proprietário de cada recurso.
- [ ] P0-04.5 Definir regras de administrador.
- [ ] P0-04.6 Revisar `activeRole`.
- [ ] P0-04.7 Impedir uso de papel residual.
- [ ] P0-04.8 Impedir escolha arbitrária de papel pelo cliente.
- [ ] P0-04.9 Garantir filtro por usuário ou empresa nas consultas.
- [ ] P0-04.10 Garantir validação também em mutações.
- [ ] P0-04.11 Evitar autorização baseada somente em dados enviados pelo frontend.
- [ ] P0-04.12 Padronizar guards e policies.
- [ ] P0-04.13 Padronizar respostas 401 e 403.
- [ ] P0-04.14 Impedir exposição de campos privados em respostas públicas.
- [ ] P0-04.15 Documentar modelo mínimo de isolamento empresarial.
- [ ] P0-04.16 Registrar decisão sobre organização e membros para P1.

## Matriz de módulos a revisar

- [ ] P0-04.17 Usuários e perfil.
- [ ] P0-04.18 Avatar e upload.
- [ ] P0-04.19 Perfis públicos.
- [ ] P0-04.20 Lojistas.
- [ ] P0-04.21 Produtos.
- [ ] P0-04.22 Catálogo.
- [ ] P0-04.23 Pedidos do comprador.
- [ ] P0-04.24 Pedidos do vendedor.
- [ ] P0-04.25 Alteração de status.
- [ ] P0-04.26 Pagamentos.
- [ ] P0-04.27 Remessas.
- [ ] P0-04.28 Avaliação de entrega.
- [ ] P0-04.29 Publicações verificadas.
- [ ] P0-04.30 Prestadores.
- [ ] P0-04.31 Transportadoras.
- [ ] P0-04.32 Fábricas.
- [ ] P0-04.33 Representantes.
- [ ] P0-04.34 Rotas administrativas.

## Testes obrigatórios de acesso cruzado

- [ ] P0-04.35 Usuário A não lê pedido do usuário B.
- [ ] P0-04.36 Usuário A não altera pedido do usuário B.
- [ ] P0-04.37 Lojista A não altera produto do lojista B.
- [ ] P0-04.38 Comprador não executa ação exclusiva do vendedor.
- [ ] P0-04.39 Vendedor não executa ação exclusiva do comprador.
- [ ] P0-04.40 Prestador não altera dados de outro prestador.
- [ ] P0-04.41 Fábrica não altera dados de outra fábrica.
- [ ] P0-04.42 Representante não altera outro representante.
- [ ] P0-04.43 Usuário comum não acessa rota administrativa.
- [ ] P0-04.44 Recurso inexistente não revela dados internos.

## Definição de concluído

Toda rota privada deverá possuir autenticação, regra de papel e regra de propriedade verificável.

---

# P0-05 — Integridade financeira, pedidos e pagamentos

## Objetivo

Impedir manipulação de preços, quantidades, totais, fretes e estados financeiros.

## Checklist de pedidos

- [ ] P0-05.1 Revisar DTO de criação de pedido.
- [ ] P0-05.2 Confirmar se `unitPrice` é aceito do cliente.
- [ ] P0-05.3 Buscar preço atual no servidor.
- [ ] P0-05.4 Validar produto ativo.
- [ ] P0-05.5 Validar vínculo entre produto e lojista.
- [ ] P0-05.6 Validar quantidade inteira e positiva.
- [ ] P0-05.7 Definir quantidade máxima segura.
- [ ] P0-05.8 Recalcular subtotal no servidor.
- [ ] P0-05.9 Recalcular total no servidor.
- [ ] P0-05.10 Usar representação financeira sem erro de ponto flutuante.
- [ ] P0-05.11 Registrar snapshot de preço.
- [ ] P0-05.12 Registrar origem do preço.
- [ ] P0-05.13 Validar modalidade de frete no servidor.
- [ ] P0-05.14 Registrar snapshot de prazo e valor do frete.
- [ ] P0-05.15 Impedir produto de outro lojista no mesmo agrupamento inválido.
- [ ] P0-05.16 Tratar produto alterado durante checkout.
- [ ] P0-05.17 Tratar concorrência.
- [ ] P0-05.18 Usar transação quando necessário.
- [ ] P0-05.19 Validar transições de status.
- [ ] P0-05.20 Impedir salto de estados.
- [ ] P0-05.21 Registrar ator de cada transição.
- [ ] P0-05.22 Testar cancelamento.
- [ ] P0-05.23 Testar devolução.
- [ ] P0-05.24 Testar expiração de reserva.

## Checklist de pagamentos

- [ ] P0-05.25 Mapear `PixCharge`.
- [ ] P0-05.26 Mapear confirmação mock.
- [ ] P0-05.27 Impedir comprador de confirmar pagamento real manualmente.
- [ ] P0-05.28 Restringir confirmação mock ao ambiente permitido.
- [ ] P0-05.29 Garantir idempotência da confirmação.
- [ ] P0-05.30 Impedir pagamento duplicado.
- [ ] P0-05.31 Impedir pagamento após expiração.
- [ ] P0-05.32 Vincular valor da cobrança ao total do servidor.
- [ ] P0-05.33 Validar assinatura de webhook quando houver provedor real.
- [ ] P0-05.34 Registrar evento financeiro.
- [ ] P0-05.35 Não registrar dados financeiros sensíveis em logs.
- [ ] P0-05.36 Testar valor adulterado.
- [ ] P0-05.37 Testar quantidade negativa.
- [ ] P0-05.38 Testar preço negativo.
- [ ] P0-05.39 Testar produto inexistente.
- [ ] P0-05.40 Testar pagamento repetido.
- [ ] P0-05.41 Testar confirmação sem permissão.

## Gate obrigatório

O frontend poderá enviar intenção de compra, mas nunca determinar o valor final aceito.

## Definição de concluído

Nenhum valor financeiro crítico será confiado ao navegador.

---

# P0-06 — Funcionalidades mock e dados simulados

## Objetivo

Impedir que simulações sejam confundidas com operações reais.

## Checklist

- [ ] P0-06.1 Procurar `mock` no repositório.
- [ ] P0-06.2 Procurar `fake`.
- [ ] P0-06.3 Procurar `demo`.
- [ ] P0-06.4 Procurar confirmações manuais.
- [ ] P0-06.5 Procurar KPIs fixos.
- [ ] P0-06.6 Procurar dados seed acessíveis.
- [ ] P0-06.7 Classificar cada ocorrência.
- [ ] P0-06.8 Identificar mock de pagamento.
- [ ] P0-06.9 Identificar mock de logística.
- [ ] P0-06.10 Identificar mock de fábrica.
- [ ] P0-06.11 Identificar mock de relatórios.
- [ ] P0-06.12 Criar flag explícita para desenvolvimento.
- [ ] P0-06.13 Bloquear mocks em produção.
- [ ] P0-06.14 Fazer startup falhar se mock proibido estiver habilitado.
- [ ] P0-06.15 Marcar visualmente ambientes de teste.
- [ ] P0-06.16 Impedir mistura de dados reais e simulados.
- [ ] P0-06.17 Criar teste de produção com mock desabilitado.
- [ ] P0-06.18 Documentar o que continuará simulado após P0.

## Definição de concluído

Produção não deverá aceitar nenhuma ação financeira ou operacional simulada.

---

# P0-07 — Validação e proteção da API

## Objetivo

Reduzir abuso, entradas inválidas e exposição de detalhes internos.

## Checklist de validação

- [ ] P0-07.1 Revisar configuração global do `ValidationPipe`.
- [ ] P0-07.2 Ativar `whitelist` quando seguro.
- [ ] P0-07.3 Avaliar `forbidNonWhitelisted`.
- [ ] P0-07.4 Avaliar `transform`.
- [ ] P0-07.5 Garantir DTO nos endpoints de escrita.
- [ ] P0-07.6 Validar IDs.
- [ ] P0-07.7 Validar enums.
- [ ] P0-07.8 Validar datas.
- [ ] P0-07.9 Validar CEP.
- [ ] P0-07.10 Validar CPF e CNPJ conforme necessidade.
- [ ] P0-07.11 Validar tamanho de textos.
- [ ] P0-07.12 Definir limites de paginação.
- [ ] P0-07.13 Impedir filtros sem limite.
- [ ] P0-07.14 Validar URLs recebidas.
- [ ] P0-07.15 Revisar HTML ou texto exibido.
- [ ] P0-07.16 Revisar consultas SQL brutas, se existirem.

## Checklist de proteção

- [ ] P0-07.17 Aplicar headers de segurança.
- [ ] P0-07.18 Revisar CORS.
- [ ] P0-07.19 Aplicar rate limit no login.
- [ ] P0-07.20 Aplicar rate limit no cadastro.
- [ ] P0-07.21 Aplicar rate limit em ações sensíveis.
- [ ] P0-07.22 Definir limite de tamanho do corpo.
- [ ] P0-07.23 Definir limite de upload.
- [ ] P0-07.24 Validar tipo real de arquivo.
- [ ] P0-07.25 Impedir extensão perigosa.
- [ ] P0-07.26 Definir armazenamento seguro de upload.
- [ ] P0-07.27 Impedir exposição de caminho interno.
- [ ] P0-07.28 Padronizar tratamento de erro.
- [ ] P0-07.29 Ocultar stack trace em produção.
- [ ] P0-07.30 Criar identificador de requisição.
- [ ] P0-07.31 Revisar proteção contra XSS.
- [ ] P0-07.32 Revisar proteção contra CSRF.
- [ ] P0-07.33 Revisar riscos de SSRF.
- [ ] P0-07.34 Revisar redirecionamentos.
- [ ] P0-07.35 Testar payload inválido.
- [ ] P0-07.36 Testar payload excessivo.
- [ ] P0-07.37 Testar campos extras.
- [ ] P0-07.38 Testar abuso de login.

## Definição de concluído

Entradas inválidas deverão ser rejeitadas de maneira previsível e sem exposição de detalhes internos.

---

# P0-08 — Banco de dados, migrations e recuperação

## Objetivo

Proteger consistência, histórico e recuperação dos dados.

## Checklist do schema

- [ ] P0-08.1 Ler `packages/db/prisma/schema.prisma` integralmente.
- [ ] P0-08.2 Mapear entidades críticas.
- [ ] P0-08.3 Revisar chaves únicas.
- [ ] P0-08.4 Revisar índices.
- [ ] P0-08.5 Revisar relações.
- [ ] P0-08.6 Revisar `onDelete`.
- [ ] P0-08.7 Revisar campos opcionais.
- [ ] P0-08.8 Revisar valores padrão.
- [ ] P0-08.9 Revisar datas e fuso horário.
- [ ] P0-08.10 Revisar representação monetária.
- [ ] P0-08.11 Revisar identificadores externos.
- [ ] P0-08.12 Revisar estados e enums.
- [ ] P0-08.13 Revisar histórico de eventos.
- [ ] P0-08.14 Revisar isolamento por usuário ou empresa.
- [ ] P0-08.15 Revisar retenção e exclusão.
- [ ] P0-08.16 Verificar registros órfãos possíveis.

## Checklist de migrations

- [ ] P0-08.17 Listar todas as migrations.
- [ ] P0-08.18 Confirmar alinhamento entre migrations e schema.
- [ ] P0-08.19 Confirmar que produção não depende de `db push`.
- [ ] P0-08.20 Definir comando oficial de migration.
- [ ] P0-08.21 Proibir reset como solução normal.
- [ ] P0-08.22 Testar migrations em banco vazio.
- [ ] P0-08.23 Testar migrations em cópia com dados.
- [ ] P0-08.24 Registrar tempo e risco de migrations.
- [ ] P0-08.25 Definir rollback ou estratégia de avanço corretivo.
- [ ] P0-08.26 Documentar migrations irreversíveis.

## Checklist de consistência

- [ ] P0-08.27 Usar transação em operações atômicas.
- [ ] P0-08.28 Revisar criação de pedido e itens.
- [ ] P0-08.29 Revisar pagamento e mudança de status.
- [ ] P0-08.30 Revisar remessa e pedido.
- [ ] P0-08.31 Revisar reserva e expiração.
- [ ] P0-08.32 Impedir identificador externo duplicado.
- [ ] P0-08.33 Impedir eventos duplicados.
- [ ] P0-08.34 Definir comportamento em falha parcial.

## Checklist de backup

- [ ] P0-08.35 Definir frequência de backup.
- [ ] P0-08.36 Definir retenção.
- [ ] P0-08.37 Definir criptografia.
- [ ] P0-08.38 Definir acesso aos backups.
- [ ] P0-08.39 Executar backup de teste.
- [ ] P0-08.40 Restaurar o backup em ambiente isolado.
- [ ] P0-08.41 Validar dados restaurados.
- [ ] P0-08.42 Medir tempo de recuperação.
- [ ] P0-08.43 Documentar procedimento.
- [ ] P0-08.44 Definir responsável pelo processo.

## Gate obrigatório

A existência de um arquivo de backup não será suficiente. A restauração deverá ser executada e validada.

## Definição de concluído

O banco deverá possuir processo reproduzível de evolução e recuperação.

---

# P0-09 — Integrações, filas e tarefas assíncronas

## Objetivo

Preparar uma base segura para integrações futuras sem implementar toda a P2.

## Checklist

- [ ] P0-09.1 Mapear integrações já existentes.
- [ ] P0-09.2 Mapear uso atual de Redis.
- [ ] P0-09.3 Mapear filas BullMQ.
- [ ] P0-09.4 Confirmar autenticação do Redis.
- [ ] P0-09.5 Confirmar separação entre ambientes.
- [ ] P0-09.6 Validar payloads externos.
- [ ] P0-09.7 Definir timeout padrão.
- [ ] P0-09.8 Definir tentativas máximas.
- [ ] P0-09.9 Definir espera progressiva.
- [ ] P0-09.10 Evitar repetição infinita.
- [ ] P0-09.11 Definir idempotência.
- [ ] P0-09.12 Definir identificador externo.
- [ ] P0-09.13 Registrar falhas.
- [ ] P0-09.14 Criar destino para tarefas definitivamente falhas.
- [ ] P0-09.15 Impedir segredo no payload da fila.
- [ ] P0-09.16 Impedir dado pessoal desnecessário.
- [ ] P0-09.17 Revisar logs de integrações.
- [ ] P0-09.18 Definir cancelamento seguro.
- [ ] P0-09.19 Definir reprocessamento manual.
- [ ] P0-09.20 Desabilitar integrações incompletas em produção.
- [ ] P0-09.21 Documentar base que será utilizada na P2.

## Definição de concluído

Integrações incompletas não apresentarão risco de duplicação, vazamento ou execução descontrolada.

---

# P0-10 — Logs, auditoria e observabilidade

## Objetivo

Permitir entender o que aconteceu sem expor informações sensíveis.

## Checklist de logs

- [ ] P0-10.1 Mapear logs atuais.
- [ ] P0-10.2 Padronizar níveis de log.
- [ ] P0-10.3 Adicionar identificador de requisição.
- [ ] P0-10.4 Registrar módulo e operação.
- [ ] P0-10.5 Não registrar senha.
- [ ] P0-10.6 Não registrar token.
- [ ] P0-10.7 Não registrar segredo.
- [ ] P0-10.8 Reduzir dados pessoais.
- [ ] P0-10.9 Ocultar payload financeiro sensível.
- [ ] P0-10.10 Padronizar erros inesperados.
- [ ] P0-10.11 Separar log de desenvolvimento e produção.
- [ ] P0-10.12 Definir retenção.

## Checklist de auditoria

- [ ] P0-10.13 Definir evento de auditoria.
- [ ] P0-10.14 Registrar ator.
- [ ] P0-10.15 Registrar organização.
- [ ] P0-10.16 Registrar ação.
- [ ] P0-10.17 Registrar recurso.
- [ ] P0-10.18 Registrar resultado.
- [ ] P0-10.19 Registrar data.
- [ ] P0-10.20 Registrar origem da requisição quando necessário.
- [ ] P0-10.21 Registrar alteração de papel.
- [ ] P0-10.22 Registrar alteração de pedido.
- [ ] P0-10.23 Registrar mudança de status.
- [ ] P0-10.24 Registrar evento financeiro.
- [ ] P0-10.25 Registrar movimentação de remessa.
- [ ] P0-10.26 Registrar ação administrativa.
- [ ] P0-10.27 Proteger auditoria contra edição comum.
- [ ] P0-10.28 Definir consulta autorizada.

## Checklist de observabilidade

- [ ] P0-10.29 Criar health check da API.
- [ ] P0-10.30 Verificar banco no health check apropriado.
- [ ] P0-10.31 Verificar Redis no health check apropriado.
- [ ] P0-10.32 Definir monitoramento de erro.
- [ ] P0-10.33 Definir alerta crítico.
- [ ] P0-10.34 Definir alerta de fila parada.
- [ ] P0-10.35 Definir alerta de integração falhando.
- [ ] P0-10.36 Definir procedimento de investigação.
- [ ] P0-10.37 Testar geração e localização de um erro controlado.

## Definição de concluído

Um problema crítico deverá poder ser identificado e investigado usando evidências confiáveis.

---

# P0-11 — Testes críticos e integração contínua

## Objetivo

Impedir que correções futuras reabram riscos já resolvidos.

## Checklist de estratégia

- [ ] P0-11.1 Mapear testes atuais.
- [ ] P0-11.2 Separar testes unitários, integração e E2E.
- [ ] P0-11.3 Criar banco isolado para testes.
- [ ] P0-11.4 Impedir testes no banco real.
- [ ] P0-11.5 Criar dados previsíveis.
- [ ] P0-11.6 Limpar dados de teste com segurança.
- [ ] P0-11.7 Não utilizar credenciais reais.
- [ ] P0-11.8 Definir comandos oficiais.

## Testes obrigatórios

- [ ] P0-11.9 Login válido.
- [ ] P0-11.10 Login inválido.
- [ ] P0-11.11 Token ausente.
- [ ] P0-11.12 Token inválido.
- [ ] P0-11.13 Token expirado.
- [ ] P0-11.14 Usuário suspenso.
- [ ] P0-11.15 Acesso cruzado entre usuários.
- [ ] P0-11.16 Acesso cruzado entre lojistas.
- [ ] P0-11.17 Acesso administrativo proibido.
- [ ] P0-11.18 Preço adulterado.
- [ ] P0-11.19 Quantidade inválida.
- [ ] P0-11.20 Produto inválido.
- [ ] P0-11.21 Frete inválido.
- [ ] P0-11.22 Transição de pedido inválida.
- [ ] P0-11.23 Pagamento duplicado.
- [ ] P0-11.24 Confirmação mock bloqueada.
- [ ] P0-11.25 Remessa de outro usuário.
- [ ] P0-11.26 Publicação sem pedido entregue.
- [ ] P0-11.27 Payload com campos extras.
- [ ] P0-11.28 Rate limit.
- [ ] P0-11.29 Migration em banco vazio.
- [ ] P0-11.30 Restauração de backup.

## Checklist do CI

- [ ] P0-11.31 Confirmar workflow atual.
- [ ] P0-11.32 Instalar dependências pelo lockfile.
- [ ] P0-11.33 Validar Prisma.
- [ ] P0-11.34 Executar build da API.
- [ ] P0-11.35 Executar build da Web.
- [ ] P0-11.36 Executar lint sem alteração automática.
- [ ] P0-11.37 Executar testes críticos.
- [ ] P0-11.38 Verificar segredos.
- [ ] P0-11.39 Verificar dependências vulneráveis.
- [ ] P0-11.40 Impedir merge quando verificação crítica falhar.
- [ ] P0-11.41 Proteger branch principal quando possível.
- [ ] P0-11.42 Documentar como reproduzir localmente.
- [ ] P0-11.43 Executar workflow completo.
- [ ] P0-11.44 Registrar resultado.

## Regra de cobertura

A prioridade será cobrir fluxos críticos, não buscar uma porcentagem artificial de cobertura global.

## Definição de concluído

Riscos corrigidos deverão possuir testes que falhem caso o problema volte.

---

# P0-12 — Implantação, recuperação e liberação da fase

## Objetivo

Comprovar que a base está segura o suficiente para iniciar a P1.

## Checklist de implantação

- [ ] P0-12.1 Documentar build de produção.
- [ ] P0-12.2 Documentar migration.
- [ ] P0-12.3 Documentar variáveis obrigatórias.
- [ ] P0-12.4 Documentar backup anterior à implantação.
- [ ] P0-12.5 Documentar ordem de implantação.
- [ ] P0-12.6 Documentar verificação posterior.
- [ ] P0-12.7 Documentar rollback.
- [ ] P0-12.8 Definir responsável.
- [ ] P0-12.9 Testar implantação em ambiente isolado.
- [ ] P0-12.10 Testar rollback quando possível.

## Checklist de incidente

- [ ] P0-12.11 Definir o que é incidente crítico.
- [ ] P0-12.12 Definir como interromper uma funcionalidade.
- [ ] P0-12.13 Definir como revogar credencial.
- [ ] P0-12.14 Definir como bloquear usuário.
- [ ] P0-12.15 Definir como preservar evidências.
- [ ] P0-12.16 Definir como restaurar dados.
- [ ] P0-12.17 Definir como comunicar usuários afetados.
- [ ] P0-12.18 Criar registro de incidente.

## Checklist básico de privacidade

- [ ] P0-12.19 Mapear dados pessoais armazenados.
- [ ] P0-12.20 Identificar finalidade.
- [ ] P0-12.21 Reduzir coleta desnecessária.
- [ ] P0-12.22 Definir acesso.
- [ ] P0-12.23 Definir retenção inicial.
- [ ] P0-12.24 Definir exportação futura.
- [ ] P0-12.25 Definir exclusão ou anonimização futura.
- [ ] P0-12.26 Registrar pendências de LGPD para P5.

## Gate final de segurança

- [ ] P0-12.27 Todos os riscos críticos foram corrigidos.
- [ ] P0-12.28 Nenhum risco alto foi esquecido.
- [ ] P0-12.29 Riscos aceitos possuem justificativa.
- [ ] P0-12.30 Builds passam.
- [ ] P0-12.31 Testes críticos passam.
- [ ] P0-12.32 CI passa.
- [ ] P0-12.33 Segredos foram verificados.
- [ ] P0-12.34 Autorização foi testada.
- [ ] P0-12.35 Valores financeiros foram protegidos.
- [ ] P0-12.36 Mocks foram bloqueados.
- [ ] P0-12.37 Backup foi restaurado.
- [ ] P0-12.38 Logs não expõem segredos.
- [ ] P0-12.39 Auditoria crítica funciona.
- [ ] P0-12.40 Procedimento de implantação existe.
- [ ] P0-12.41 Procedimento de rollback existe.
- [ ] P0-12.42 `docs/MARTO-STATUS.md` foi atualizado.
- [ ] P0-12.43 `docs/MARTO-MASTER-PLAN.md` foi atualizado.
- [ ] P0-12.44 Usuário aprovou a conclusão da P0.
- [ ] P0-12.45 P1 foi oficialmente desbloqueada.

## Definição de concluído

A P0 somente será concluída quando o gate final possuir evidências e aprovação do usuário.

---

# 13. Matriz inicial de rotas

Esta tabela será preenchida durante P0-04.

| Módulo | Rota ou grupo | Pública | Papel | Proprietário | Testado |
|---|---|---:|---|---|---:|
| Auth | Cadastro | A definir | A definir | Não aplicável | Não |
| Auth | Login | A definir | A definir | Não aplicável | Não |
| Usuário | `/me` | Não | Autenticado | Próprio usuário | Não |
| Perfil | Perfil público | Sim | Todos | Leitura pública | Não |
| Lojista | Perfil | Não | Merchant | Próprio lojista | Não |
| Produtos | Escrita | Não | Merchant | Próprio lojista | Não |
| Catálogo | Leitura | Sim | Todos | Leitura pública | Não |
| Pedidos | Compras | Não | Consumer | Próprio comprador | Não |
| Pedidos | Vendas | Não | Merchant | Próprio vendedor | Não |
| Pagamentos | Pagamento | Não | Consumer | Pedido próprio | Não |
| Logística | Remessas | Não | A definir | A definir | Não |
| Social | Criar publicação | Não | Consumer | Pedido próprio | Não |
| Prestador | Perfil | Não | Service Provider | Próprio prestador | Não |
| Fábrica | Perfil | Não | Factory | Própria fábrica | Não |
| Representante | Perfil | Não | Representative | Próprio representante | Não |
| Administração | Rotas administrativas | Não | Admin | Administração | Não |

Nenhuma informação desta matriz deverá ser considerada confirmada antes da inspeção do código.

# 14. Registro de evidências

Adicionar uma linha somente depois da validação.

| ID | Data | Evidência | Arquivos | Testes | Commit | Resultado |
|---|---|---|---|---|---|---|
| Exemplo | AAAA-MM-DD | Descrição | Caminhos | Comandos | Hash | Aprovado |

# 15. Registro de decisões

| Data | Decisão | Motivo | Impacto | Responsável |
|---|---|---|---|---|
| 18/07/2026 | Executar P0 antes da expansão | Proteger usuários e dados | P1 permanece bloqueada | Marto |

# 16. Riscos abertos

| ID | Severidade | Risco | Estado | Próxima ação |
|---|---|---|---|---|
| R-P0-01 | Crítica | Valores financeiros podem depender de dados enviados pelo cliente | A confirmar | Inspecionar criação de pedido |
| R-P0-02 | Crítica | Autorização por recurso pode estar incompleta | A confirmar | Criar matriz de rotas |
| R-P0-03 | Crítica | Pagamento mock pode ser acessível indevidamente | A confirmar | Inspecionar rotas de pagamento |
| R-P0-04 | Alta | Token atual pode ampliar impacto de XSS | A confirmar | Revisar estratégia de sessão |
| R-P0-05 | Alta | Isolamento empresarial ainda não está consolidado | A confirmar | Mapear propriedade dos dados |
| R-P0-06 | Alta | Cobertura de testes críticos pode ser insuficiente | A confirmar | Criar baseline |
| R-P0-07 | Alta | Processo de backup e restauração não está comprovado | A confirmar | Auditar banco |
| R-P0-08 | Alta | Logs e auditoria podem ser insuficientes | A confirmar | Mapear logs |

Riscos poderão ser removidos somente depois de evidência técnica.

# 17. Progresso resumido

| Bloco | Estado |
|---|---|
| P0-00 — Baseline | Não iniciado |
| P0-01 — Segredos | Não iniciado |
| P0-02 — Ambientes | Não iniciado |
| P0-03 — Autenticação | Não iniciado |
| P0-04 — Autorização | Não iniciado |
| P0-05 — Integridade financeira | Não iniciado |
| P0-06 — Mocks | Não iniciado |
| P0-07 — Proteção da API | Não iniciado |
| P0-08 — Banco e backups | Não iniciado |
| P0-09 — Integrações e filas | Não iniciado |
| P0-10 — Logs e auditoria | Não iniciado |
| P0-11 — Testes e CI | Não iniciado |
| P0-12 — Liberação | Não iniciado |

# 18. Primeira tarefa oficial

A primeira tarefa da fase será:

`P0-00.1 — Confirmar que o terminal está na raiz C:\Users\Luu\Desktop\Marto`

Depois dela será executada somente:

`P0-00.2 — Executar git status --short`

Nenhuma correção de código deverá começar antes da conclusão do baseline.

# 19. Regra final

A P0 não é uma pausa no crescimento do Marto.

Ela é a fundação que permite ao Marto crescer sem colocar usuários, empresas, pedidos e o próprio projeto em risco.

Uma tarefa por vez.

Uma evidência por conclusão.

Nenhum risco crítico ignorado.
