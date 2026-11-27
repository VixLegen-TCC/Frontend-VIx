# VixLegen — V7, integração inicial do chat com a IA

Base: branch `main` de `VixLegen-TCC/Frontend-VIx`, árvore `511241e87a2073e87c0833a0c6eca426a5b6c87c`. O backend remoto ainda não contém as classes V6; use a cópia local V6 que já funciona, incluindo a correção HTTP/1.1. Não altere a API Python, Ollama, banco SQLite ou MySQL nesta etapa.

## Instalação (Windows)

1. Faça backup/commit do seu frontend. Extraia o conteúdo do ZIP na pasta **Frontend-VIx**, onde estão `index.html`, `integration.js`, `script.js` e `style.css`. Não extraia no projeto Java nem na IA Python.
2. Na IDE, abra o terminal nessa pasta. Execute `python .\instalar-v7.py`. Não requer bibliotecas Python externas. Se extraiu o pacote em outro local, pode executar `python caminho\instalar-v7.py caminho\Frontend-VIx`.
3. O instalador valida as âncoras, cria `backup-v7-...` com os originais e altera `index.html` e `integration.js`. Adiciona `chat-v7.js` e `chat-v7.css`. Não altera `style.css`, `script.js` ou demais seções. Não publique a pasta de backup e os arquivos do instalador/testes sem necessidade.
4. Deixe Ollama, FastAPI V5 (127.0.0.1:8000), Spring Boot V6 (localhost:8080) e MySQL rodando. Abra o frontend como costuma fazer (ex.: Live Server porta 5500, origem permitida no Spring). Não abra `index.html` como `file://`.
5. Faça login real (perfil com visualizar e editar), abra IA VixLegen e clique em Verificar conexão. Envie `O que estabelece o artigo 5º da Constituição Federal?`, `E o inciso II?`, `Me dê um exemplo`. Use a mesma conversa para testar memória. Abra outra conversa e pergunte `Como faço um for em Java?`. Volte à primeira e confira os textos. Expanda as fontes, teste tema escuro e encerre uma conversa.
6. Se os arquivos foram alterados enquanto o site estava aberto, use Ctrl+F5. Se o instalador detectar âncoras ausentes, não altera os arquivos; revise a versão local.

## Contrato HTTP utilizado

O módulo reaproveita `api()` e o JWT já existentes em `integration.js`. O navegador não conhece o UUID interno do Python nem acessa a porta 8000 diretamente.

- GET `/chat/ia/health`
- POST `/chat/ia/sessoes`
- POST `/chat/ia/sessoes/{conversa_id}/mensagens`, JSON `{"mensagem":"..."}`
- POST `/chat/ia/sessoes/{conversa_id}/encerrar`

O ID externo do Java é reutilizado por conversa. As fontes exibidas são as devolvidas pelo servidor (trecho, arquivo, página, dispositivo, citada/não citada). Não há URLs inventadas para PDFs. Texto do modelo e do usuário é inserido como texto, nunca como HTML; blocos de código cercados por crases recebem formatação específica. Markdown geral não é interpretado. A mensagem completa e os avisos do RAG são mantidos.

## Limitações e decisões

- Esta é a primeira entrega da V7, usando a V6 síncrona já testada pelo usuário. Há indicador real de processamento, não streaming simulado. SSE através do Java ainda precisa de implementação.
- As conversas ficam apenas na memória da aba; atualizar/fechar a página ou sair da conta perde a lista e o histórico visual. A V6 expira sessões por inatividade e reinícios. Não há restauração de contexto ou persistência no MySQL. Não se cria automaticamente outra sessão em caso de expiração.
- Limite de 20 conversas abertas por aba, 4.000 caracteres por pergunta; operações da interface serializadas. A API pode retornar 409/429 se estiver ocupada.
- Logout/troca de conta limpa a interface e aborta o fetch; isso não garante cancelamento do processamento no servidor. Sessões abandonadas expiram. A autorização real permanece no Java, com JWT e vínculo usuário/empresa. Não trate o teste de UI como auditoria do isolamento entre contas reais.
- Anexos privados e integração de autos foram removidos da seção IA nesta entrega, pois o índice Python é global e a V5 não aceita contexto privado separado. Não enviar dados sigilosos. Outras funções do site permanecem.
- Fontes expansíveis não substituem verificação jurídica. O PDF indexado corresponde à edição fornecida, não necessariamente à legislação vigente.
- Sem alterações remotas no GitHub: conexão somente leitura. Não consegui clonar o frontend completo no ambiente de execução (DNS indisponível); validei as âncoras no código real via GitHub e executei os testes no Chromium com uma fixture das seções e API simulada. A integração completa com seu servidor e o visual do site real precisam de teste local.

## Testes executados

`node --check v7_assets/chat-v7.js`; `python -m py_compile instalar-v7.py`; `python tests/test_v7.py` (9 testes aprovados: 2 instalador + 7 Chromium). O resultado está em `resultado-testes-v7.txt`. A suíte opcional exige Playwright e Chromium; não é necessária para instalar ou usar o site. Os testes inserem os arquivos gerados em uma página de teste via `set_content`, porque a navegação local do Chromium é bloqueada neste ambiente.

## Voltar à versão anterior

Copie `index.html` e `integration.js` do diretório `backup-v7-...` de volta para a raiz do frontend e remova `chat-v7.js` e `chat-v7.css`. Recarregue o site. Nenhum dado do MySQL/SQLite será alterado por essa operação.
