# VixLegen — Frontend

Interface web do VixLegen feita em HTML, CSS e JavaScript, com integração ao backend Spring Boot.

## Documentação atualizada (30/10/2026)

**[Estado oficial do projeto e pendências](https://github.com/VixLegen-TCC/Backend-VixLegen/blob/main/docs/estado-projeto-2026-10-30.md)**

## Situação da integração

- O cadastro público e login usam a API do backend; segundo a equipe, o cadastro voltou a funcionar após ajustes no MySQL em 30/10/2026.
- A separação dos escritórios ocorre **no servidor pelo ID da empresa**. Novas contas públicas criam empresas novas mesmo quando compartilham o mesmo nome.
- Clientes, processos, tarefas, notificações, perfil e minutas possuem rotinas de integração com a API.
- A interface do chat ainda mostra mensagem informativa, **não** resposta de uma IA conectada. Segundo a equipe, a IA está desenvolvida em outra máquina por Raphael (PH) e falta integrá-la.
- A edição de informações da empresa no `script.js` atualmente atualiza somente a tela, **sem persistir via API**; é uma pendência.
- Há rotinas antigas locais no `script.js` e rotinas via API no `integration.js`. Revisar listeners duplicados e consolidar a lógica.
- O administrador de demonstração está definido no JavaScript, mas o modo demo está **desligado por padrão**; não representa autenticação real nem acesso ao banco.

## Como executar

1. Suba a API do [backend](https://github.com/VixLegen-TCC/Backend-VixLegen), com MySQL e JWT configurados.
2. Abra `index.html` por um servidor local (por exemplo, Live Server em `http://localhost:5500`).
3. A API padrão configurada em `integration.js` é `http://localhost:8080`. Caso utilize outra URL, defina `window.VIXLEGEN_API_URL` **antes** de carregar `integration.js`.
4. Cadastre uma conta nova pelo fluxo de autenticação e valide clientes, processos, tarefas e documentos.

**Antes da entrega:** testar o fluxo completo em navegador, garantir que dados editados sejam persistidos e integrar a IA do PH com autenticação e autorização no backend.

Backend: https://github.com/VixLegen-TCC/Backend-VixLegen
