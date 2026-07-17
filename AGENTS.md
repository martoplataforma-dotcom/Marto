
# AGENTS.md — Projeto Marto

Estas instruções valem para todo o repositório Marto.

## Forma de trabalho

1. Trabalhar somente uma tarefa por vez.
2. Antes de alterar qualquer arquivo, explicar:
   - o que será feito;
   - por que será feito;
   - qual arquivo será alterado.
3. Sempre informar o caminho completo do arquivo dentro do projeto.
4. Não iniciar a próxima tarefa até o usuário confirmar que a atual está correta.
5. Não alterar arquivos ou funcionalidades fora do escopo solicitado.
6. Não aproveitar uma tarefa pequena para realizar refatorações amplas.
7. Preservar tudo que já estiver funcionando.
8. Em caso de dúvida relevante, parar e explicar antes de decidir.
9. Não apresentar várias etapas de implementação ao mesmo tempo.
10. Comunicar-se em português claro, sem complicar desnecessariamente.

## Antes de editar

1. Ler o arquivo atual por completo.
2. Verificar arquivos relacionados e possíveis dependências.
3. Conferir se já existem mudanças não concluídas.
4. Explicar o impacto esperado.
5. Informar o caminho do arquivo que será alterado.
6. Limitar a mudança ao menor escopo seguro.

## Banco de dados e Prisma

1. Nunca apagar ou reiniciar o banco sem autorização explícita.
2. Nunca usar comandos destrutivos para resolver problemas de migration.
3. Antes de alterar o schema Prisma, analisar:
   - dados existentes;
   - relações afetadas;
   - necessidade de migration;
   - compatibilidade com o código atual.
4. Toda migration deve possuir uma finalidade clara.
5. Não transformar dados de produção em dados mock.

## Segurança

1. Nunca colocar senhas, tokens, chaves ou conteúdo do `.env` no código ou no GitHub.
2. Não remover autenticação ou autorização para facilitar testes.
3. Toda rota privada deve validar usuário, papel e acesso ao recurso.
4. Funcionalidades mock devem permanecer bloqueadas em produção.
5. Valores financeiros e preços devem ser calculados ou validados no servidor.

## Verificação

Depois de cada alteração:

1. Verificar erros de TypeScript.
2. Executar o teste, lint ou build relacionado quando aplicável.
3. Conferir se o fluxo anterior continua funcionando.
4. Informar claramente:
   - o que foi alterado;
   - quais arquivos foram alterados;
   - o que foi testado;
   - qualquer risco ou pendência.
5. Parar e aguardar a validação do usuário.

## Git e histórico

1. Não fazer commit, push, merge ou criar Pull Request sem solicitação.
2. Não alterar histórico do Git.
3. Não apagar mudanças existentes do usuário.
4. Não marcar uma tarefa como concluída antes da validação.
5. Quando a tarefa for aprovada, atualizar a documentação de andamento correspondente.

## Direção do Marto

O Marto será um ecossistema de comércio, serviços, logística, reputação verificada e dados.

A construção deve ser:

- evolutiva;
- modular;
- segura;
- orientada por problemas reais;
- sem copiar concorrentes diretamente;
- mantendo o Marto único e de vanguarda.

A prioridade atual é transformar o Marto em uma central operacional útil para lojas e fábricas, começando por pedidos, estoque, logística, cotação, rastreio, assistência e integrações.

## Regra principal

Uma coisa por vez, devagar, com segurança e sem bagunçar o que já funciona.