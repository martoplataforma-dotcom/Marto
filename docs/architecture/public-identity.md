# Marto — Contrato de Identidade Pública

## Regra-mãe
Identidade é da conta. Operação é do papel. Vitrine é do domínio.

## 1. Identidade pública universal
- `User` é a identidade pública universal da conta.
- `User.handle`, `User.bio`, `User.avatarUrl` e `User.displayName` são globais.
- A rota pública universal é `/u/[handle]` e sempre nasce de `User.handle`.

## 2. Domínios por papel
- `Merchant` guarda apenas domínio comercial da loja.
- `ServiceProvider` guarda apenas domínio operacional/profissional.
- `Consumer` guarda apenas domínio de consumo/preferências/sinais públicos.
- `Factory` guarda apenas domínio industrial/fabril.
- `Representative` guarda apenas domínio comercial/relacional.

## 3. Edição
- Só a área central da conta pode editar `User.handle`, `bio`, `avatarUrl` e nome público.
- Telas de papel podem ler a identidade global, mas não editam por padrão.
- Cada papel edita apenas seu domínio.

## 4. Exibição pública
- `/u/[handle]` é uma casca pública universal.
- Blocos internos renderizam por papel/contexto principal.
- Um papel não herda bloco de outro por acidente.

## 5. Segurança
- Nenhuma tela de papel cria input de handle global por conveniência.
- Nenhuma tela de papel faz `PUT /me/profile` só para mostrar perfil público.
- Sempre separar:
  - identidade global da conta
  - dados operacionais do papel
  - blocos públicos por papel
