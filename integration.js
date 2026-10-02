document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = window.VIXLEGEN_API_URL || "http://localhost:8080";

    const state = {
        token: localStorage.getItem("vixlegen_token") || "",
        usuario: JSON.parse(localStorage.getItem("vixlegen_usuario") || "null"),
        clientes: [],
        processos: [],
        tarefas: [],
        notificacoes: [],
        status: new Map(),
        categoriasDocumento: [],
        documentoAtualId: null,
        usuarioDetalhado: null,
        aiFiles: []
    };

    const $ = (id) => document.getElementById(id);

    async function api(path, options = {}) {
        const headers = new Headers(options.headers || {});
        if (options.body && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }
        if (state.token) {
            headers.set("Authorization", `Bearer ${state.token}`);
        }

        const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
        const type = response.headers.get("content-type") || "";
        const data = type.includes("application/json")
            ? await response.json().catch(() => null)
            : await response.text().catch(() => "");

        if (!response.ok) {
            let message = data?.message || data?.erro || data?.error || data || `Erro HTTP ${response.status}`;

            if (message && typeof message === "object") {
                const campos = Object.entries(message)
                    .map(([campo, valor]) => `${campo}: ${valor}`)
                    .join(" • ");
                message = campos || "Requisição inválida";
            }

            if (response.status === 403 && (!message || message === "Forbidden")) {
                message = "Seu perfil não possui permissão para executar esta ação.";
            }

            const error = new Error(
                typeof message === "string"
                    ? message
                    : "Falha na comunicação com o servidor"
            );
            error.status = response.status;
            throw error;
        }
        return data;
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }

    let confirmationResolver = null;

    function openModal(id) {
        document.querySelectorAll(".modal-card").forEach(m => m.classList.remove("active"));
        $("modalOverlay")?.classList.add("active");
        $(id)?.classList.add("active");
    }

    function closeModals() {
        if (confirmationResolver) {
            const resolve = confirmationResolver;
            confirmationResolver = null;
            resolve(false);
        }

        $("modalOverlay")?.classList.remove("active");
        document.querySelectorAll(".modal-card").forEach(m => m.classList.remove("active"));
    }

    function confirmAction(title, message) {
        return new Promise(resolve => {
            confirmationResolver = resolve;

            if ($("confirmacaoTitulo")) {
                $("confirmacaoTitulo").textContent = title;
            }

            if ($("confirmacaoMensagem")) {
                $("confirmacaoMensagem").textContent = message;
            }

            openModal("modalConfirmacao");

            setTimeout(() => {
                $("btnConfirmacaoNao")?.focus();
            }, 0);
        });
    }

    function answerConfirmation(confirmed) {
        if (!confirmationResolver) return;

        const resolve = confirmationResolver;
        confirmationResolver = null;

        $("modalOverlay")?.classList.remove("active");
        document.querySelectorAll(".modal-card").forEach(m => m.classList.remove("active"));

        resolve(confirmed);
    }

    $("btnConfirmacaoSim")?.addEventListener("click", () => {
        answerConfirmation(true);
    });

    $("btnConfirmacaoNao")?.addEventListener("click", () => {
        answerConfirmation(false);
    });

    function alertModal(title, message) {
        if ($("alertaTitulo")) $("alertaTitulo").innerHTML = `<i class="fa-solid fa-circle-info"></i> ${escapeHtml(title)}`;
        if ($("alertaMensagem")) $("alertaMensagem").textContent = message;
        openModal("modalAlerta");
    }

    function showAuth(mode = "login") {
        $("authShell")?.classList.remove("auth-hidden");
        $("appLayout")?.classList.add("auth-hidden");
        $("authLoginCard")?.classList.toggle("active", mode === "login");
        $("authCadastroCard")?.classList.toggle("active", mode === "cadastro");
    }

    function showApp() {
        $("authShell")?.classList.add("auth-hidden");
        $("appLayout")?.classList.remove("auth-hidden");
        document.querySelector('[data-target="sec-home"]')?.click();
    }

    function saveSession(data) {
        state.token = data.token;
        state.usuario = {
            idUsuario: data.idUsuario,
            nome: data.nome,
            email: data.email,
            codigoCategoria: data.codigoCategoria,
            nivelAcesso: data.nivelAcesso
        };
        localStorage.setItem("vixlegen_token", state.token);
        localStorage.setItem("vixlegen_usuario", JSON.stringify(state.usuario));
    }

    function clearSession() {
        state.token = "";
        state.usuario = null;
        state.documentoAtualId = null;
        localStorage.removeItem("vixlegen_token");
        localStorage.removeItem("vixlegen_usuario");
    }

    $("btnIrCadastro")?.addEventListener("click", () => showAuth("cadastro"));
    $("btnIrLogin")?.addEventListener("click", () => showAuth("login"));

    $("formLogin")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const errorEl = $("loginErro");
        if (errorEl) errorEl.hidden = true;

        try {
            const data = await api("/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    email: $("loginEmail").value.trim(),
                    senha: $("loginSenha").value
                })
            });

            saveSession(data);
            showApp();
            await loadAll();
        } catch (error) {
            if (errorEl) {
                errorEl.textContent = error.message;
                errorEl.hidden = false;
            }
        }
    });

    $("formCadastro")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const errorEl = $("cadastroErro");
        if (errorEl) errorEl.hidden = true;

        const payload = {
            primeiroNome: $("cadPrimeiroNome").value.trim(),
            ultimoNome: $("cadUltimoNome").value.trim(),
            email: $("cadEmail").value.trim(),
            senha: $("cadSenha").value,
            telefone: $("cadTelefone").value.trim(),
            cpf: $("cadCpf").value.trim(),
            rg: $("cadRg").value.trim(),
            empresa: $("cadEmpresa").value.trim(),
            numeroOAB: $("cadNumeroOab").value.trim(),
            dataNascimento: $("cadDataNascimento").value,
            estado: $("cadEstado").value.trim(),
            cidade: $("cadCidade").value.trim(),
            cep: $("cadCep").value.trim()
        };

        try {
            await api("/auth/cadastro", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            $("loginEmail").value = payload.email;
            $("formCadastro").reset();
            showAuth("login");
            $("loginSenha")?.focus();
        } catch (error) {
            if (errorEl) {
                errorEl.textContent = error.message;
                errorEl.hidden = false;
            }
        }
    });

    async function loadClientes() {
        if (!state.token) return;
        state.clientes = await api("/clientes");
        renderClientes();
        fillClienteSelect();
    }

    function renderClientes() {
        const body = $("clientesTableBody");
        if (!body) return;

        const query = ($("buscaClientes")?.value || "").trim().toLowerCase();
        const items = state.clientes.filter(c =>
            [c.nomeCompleto, c.cpf, c.cnpj, c.email, c.telefone]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query)
        );

        $("clientesCount").textContent = `${items.length} cliente${items.length === 1 ? "" : "s"}`;

        body.innerHTML = items.length
            ? items.map(c => `
                <tr>
                    <td><div class="record-main"><strong>${escapeHtml(c.nomeCompleto)}</strong><span>ID #${c.idCliente}</span></div></td>
                    <td>${escapeHtml(c.cpf || c.cnpj || "—")}</td>
                    <td>${escapeHtml(c.email || "—")}</td>
                    <td>${escapeHtml(c.telefone || "—")}</td>
                    <td><div class="record-actions">
                        <button class="record-more-btn" data-cliente-view="${c.idCliente}" title="Ver mais"><i class="fa-regular fa-eye"></i> Ver mais</button>
                        <button class="record-icon-btn danger" data-cliente-delete="${c.idCliente}" title="Excluir"><i class="fa-regular fa-trash-can"></i></button>
                    </div></td>
                </tr>`).join("")
            : '<tr class="records-placeholder"><td colspan="5">Nenhum cliente encontrado.</td></tr>';
    }

    function fillClienteSelect() {
        const select = $("processoCliente");
        if (!select) return;
        select.innerHTML = '<option value="">Selecione um cliente</option>' +
            state.clientes.map(c => `<option value="${c.idCliente}">${escapeHtml(c.nomeCompleto)}</option>`).join("");
    }

    $("buscaClientes")?.addEventListener("input", renderClientes);

    $("btnNovoCliente")?.addEventListener("click", () => openModal("modalNovoCliente"));

    $("clienteTipoDocumento")?.addEventListener("change", (event) => {
        const cpf = event.target.value === "cpf";
        $("clienteDocumentoLabel").textContent = cpf ? "CPF" : "CNPJ";
        $("clienteDocumento").placeholder = cpf ? "000.000.000-00" : "00.000.000/0000-00";
    });

    $("btnSalvarCliente")?.addEventListener("click", async () => {
        const tipo = $("clienteTipoDocumento").value;
        const documento = $("clienteDocumento").value.trim();

        const payload = {
            nomeCompleto: $("clienteNome").value.trim(),
            email: $("clienteEmail").value.trim(),
            telefone: $("clienteTelefone").value.trim(),
            cpf: tipo === "cpf" ? documento : null,
            cnpj: tipo === "cnpj" ? documento : null,
            usuarioResponsavelId: state.usuario?.idUsuario
        };

        if (!payload.nomeCompleto || !payload.email || !payload.telefone || !documento) {
            return alertModal("Dados incompletos", "Preencha todos os campos do cliente.");
        }

        try {
            await api("/clientes", { method: "POST", body: JSON.stringify(payload) });
            closeModals();
            ["clienteNome", "clienteEmail", "clienteTelefone", "clienteDocumento"].forEach(id => { if ($(id)) $(id).value = ""; });
            await loadClientes();
            alertModal("Cliente cadastrado", "O cliente foi salvo com sucesso.");
        } catch (error) {
            alertModal("Falha ao cadastrar", error.message);
        }
    });

    $("clientesTableBody")?.addEventListener("click", async (event) => {
        const view = event.target.closest("[data-cliente-view]");
        const remove = event.target.closest("[data-cliente-delete]");

        if (view) {
            const cliente = state.clientes.find(c => c.idCliente === Number(view.dataset.clienteView));
            if (!cliente) return;

            let processos = [];
            try { processos = await api(`/clientes/${cliente.idCliente}/processos`); } catch (_) {}

            $("detalhesTitulo").innerHTML = `<i class="fa-solid fa-user"></i> ${escapeHtml(cliente.nomeCompleto)}`;
            $("detalhesConteudo").innerHTML =
                detail("E-mail", cliente.email) +
                detail("Telefone", cliente.telefone) +
                detail(cliente.cpf ? "CPF" : "CNPJ", cliente.cpf || cliente.cnpj) +
                detail("Processos vinculados", processos.length);
            openModal("modalDetalhesRegistro");
        }

        if (remove) {
            const id = Number(remove.dataset.clienteDelete);
            const confirmado = await confirmAction(
                "Tem certeza que quer excluir este cliente?",
                "Ao confirmar, o cliente será removido. Se houver processos vinculados, o backend ainda bloqueará a exclusão."
            );
            if (!confirmado) return;
            try {
                await api(`/clientes/${id}`, { method: "DELETE" });
                await loadClientes();
            } catch (error) {
                alertModal("Não foi possível excluir", error.message);
            }
        }
    });

    async function loadProcessos() {
        if (!state.token) return;

        state.processos = await api("/processos");
        state.status.clear();

        await Promise.allSettled(
            state.processos.map(async p => {
                try {
                    state.status.set(p.idProcesso, await api(`/processos/${p.idProcesso}/situacao`));
                } catch (_) {
                    state.status.set(p.idProcesso, null);
                }
            })
        );

        renderProcessos();
        fillProcessoSelect();
    }

    function renderProcessos() {
        const body = $("processosTableBody");
        if (!body) return;

        const query = ($("buscaProcessos")?.value || "").trim().toLowerCase();
        const statusFilter = $("filtroStatusProcesso")?.value || "";

        const items = state.processos.filter(p => {
            const status = state.status.get(p.idProcesso) || "";
            const text = [p.numeroProcesso, p.cliente?.nomeCompleto, p.tribunal, p.comarca, p.vara]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return text.includes(query) && (!statusFilter || status === statusFilter);
        });

        $("processosCount").textContent = `${items.length} processo${items.length === 1 ? "" : "s"}`;

        body.innerHTML = items.length
            ? items.map(p => `
                <tr>
                    <td><button class="process-record-link" type="button" data-processo-editor="${p.idProcesso}"><strong>${escapeHtml(p.numeroProcesso)}</strong><span>ID #${p.idProcesso}${p.segredoJustica ? " • Segredo de justiça" : ""}</span></button></td>
                    <td>${escapeHtml(p.cliente?.nomeCompleto || "—")}</td>
                    <td>${escapeHtml(p.tribunal || "—")}</td>
                    <td>${escapeHtml(p.comarca || "—")}</td>
                    <td>${statusPill(state.status.get(p.idProcesso))}</td>
                    <td>${formatDate(p.dataAbertura)}</td>
                    <td><div class="record-actions">
                        <button class="record-more-btn" data-processo-view="${p.idProcesso}" title="Ver mais"><i class="fa-regular fa-eye"></i> Ver mais</button>
                        <button class="record-icon-btn" data-processo-editor="${p.idProcesso}" title="Abrir no editor"><i class="fa-solid fa-file-pen"></i></button>
                        <button class="record-icon-btn danger" data-processo-delete="${p.idProcesso}" title="Excluir"><i class="fa-regular fa-trash-can"></i></button>
                    </div></td>
                </tr>`).join("")
            : '<tr class="records-placeholder"><td colspan="7">Nenhum processo encontrado.</td></tr>';
    }

    $("buscaProcessos")?.addEventListener("input", renderProcessos);
    $("filtroStatusProcesso")?.addEventListener("change", renderProcessos);

    $("btnNovoProcesso")?.addEventListener("click", async () => {
        if (!state.clientes.length) await loadClientes().catch(() => {});
        fillClienteSelect();
        $("processoDataAbertura").value = new Date().toISOString().slice(0, 10);
        openModal("modalNovoProcesso");
    });

    $("btnSalvarProcesso")?.addEventListener("click", async () => {
        const payload = {
            numeroProcesso: $("processoNumero").value.trim(),
            vara: $("processoVara").value.trim(),
            comarca: $("processoComarca").value.trim(),
            tribunal: $("processoTribunal").value.trim(),
            instancia: $("processoInstancia").value.trim(),
            segredoJustica: $("processoSegredo").checked,
            dataAbertura: $("processoDataAbertura").value,
            dataEncerramento: null,
            clienteId: Number($("processoCliente").value)
        };

        if (!payload.numeroProcesso || !payload.vara || !payload.comarca || !payload.tribunal ||
            !payload.instancia || !payload.dataAbertura || !payload.clienteId) {
            return alertModal("Dados incompletos", "Preencha os dados principais do processo.");
        }

        try {
            const processo = await api("/processos", {
                method: "POST",
                body: JSON.stringify(payload)
            });

            await api("/classificacoes-processo", {
                method: "POST",
                body: JSON.stringify({
                    status: $("processoStatus").value,
                    areaDireito: $("processoAreaDireito").value.trim() || "Não informada",
                    tipoAcao: $("processoTipoAcao").value.trim() || "Não informado",
                    faseProcessual: $("processoFase").value.trim() || "Inicial",
                    descricaoObjeto: $("processoObjeto").value.trim() || "Não informado",
                    processoId: processo.idProcesso
                })
            });

            closeModals();
            await loadProcessos();
            alertModal("Processo cadastrado", "Processo e classificação foram salvos.");
        } catch (error) {
            alertModal("Falha ao cadastrar", error.message);
        }
    });

    $("processosTableBody")?.addEventListener("click", async (event) => {
        const view = event.target.closest("[data-processo-view]");
        const editor = event.target.closest("[data-processo-editor]");
        const remove = event.target.closest("[data-processo-delete]");

        if (view) {
            const p = state.processos.find(x => x.idProcesso === Number(view.dataset.processoView));
            if (!p) return;

            $("detalhesTitulo").innerHTML = `<i class="fa-solid fa-scale-balanced"></i> Processo ${escapeHtml(p.numeroProcesso)}`;
            $("detalhesConteudo").innerHTML =
                detail("Cliente", p.cliente?.nomeCompleto) +
                detail("Status", translateStatus(state.status.get(p.idProcesso))) +
                detail("Tribunal", p.tribunal) +
                detail("Vara", p.vara) +
                detail("Comarca", p.comarca) +
                detail("Instância", p.instancia) +
                detail("Abertura", formatDate(p.dataAbertura)) +
                detail("Segredo de justiça", p.segredoJustica ? "Sim" : "Não");
            openModal("modalDetalhesRegistro");
        }

        if (editor) {
            const idProcesso = Number(editor.dataset.processoEditor);
            $("selectMinutaProcesso").value = String(idProcesso);
            await abrirProcessoNoEditor(idProcesso);
            document.querySelector('[data-target="sec-editor"]')?.click();
        }

        if (remove) {
            const id = Number(remove.dataset.processoDelete);
            const confirmado = await confirmAction(
                "Tem certeza que quer excluir este processo?",
                "Esta ação remove o processo selecionado. Escolha NÃO para manter os dados."
            );
            if (!confirmado) return;
            try {
                await api(`/processos/${id}`, { method: "DELETE" });
                await loadProcessos();
            } catch (error) {
                alertModal("Não foi possível excluir", error.message);
            }
        }
    });

    async function loadPerfil() {
        if (!state.token) return;

        state.usuarioDetalhado = await api("/auth/me");
        renderPerfilEmpresa();
    }

    function renderPerfilEmpresa() {
        const u = state.usuarioDetalhado;
        if (!u) return;

        const nomeCompleto = [u.primeiroNome, u.ultimoNome]
            .filter(Boolean)
            .join(" ")
            .trim();

        const iniciais = [u.primeiroNome, u.ultimoNome]
            .filter(Boolean)
            .map(parte => parte.charAt(0).toUpperCase())
            .join("")
            .slice(0, 2) || "VL";

        const categoria = ({
            1: "Administrador Geral",
            2: "Advogado Sênior",
            3: "Advogado Júnior",
            4: "Estagiário"
        })[state.usuario?.nivelAcesso] || "Profissional VixLegen";

        setText("perfilIniciais", iniciais);
        setText("perfilNome", nomeCompleto || "Profissional");
        setText("perfilCategoria", categoria);
        setText("perfilOab", u.numeroOAB ? `OAB ${u.numeroOAB}` : "OAB não informada");
        setText("perfilEmpresaTag", u.empresa || "Empresa não informada");
        setText("perfilEmpresa", u.empresa || "Não informada");
        setText("perfilNomeCompleto", nomeCompleto || "—");
        setText("perfilRegistro", u.numeroOAB || "—");
        setText("perfilCpf", u.cpf || "—");
        setText("perfilEmail", u.email || "—");
        setText("perfilTelefone", u.telefone || "—");
        setText("perfilLocalizacao", [u.cidade, u.estado].filter(Boolean).join(" - ") || "—");
        setText("perfilEmpresaDetalhe", u.empresa || "—");
        setText("perfilNascimento", formatDate(u.dataNascimento));

        setText("displayNomeEmpresa", u.empresa || "Empresa não informada");
        setText("fieldEmpresaResponsavel", nomeCompleto || "—");
        setText("fieldEmail", u.email || "—");
        setText("fieldTelefone", u.telefone || "—");

        const localizacao = [
            [u.cidade, u.estado].filter(Boolean).join(" - "),
            u.cep ? `CEP ${u.cep}` : ""
        ].filter(Boolean).join(" • ");

        setText("fieldEndereco", localizacao || "Localização não informada");
    }

    $("btnVerMaisPerfil")?.addEventListener("click", () => {
        const u = state.usuarioDetalhado;
        if (!u) return;

        $("detalhesTitulo").innerHTML = '<i class="fa-regular fa-id-card"></i> Dados completos do perfil';
        $("detalhesConteudo").innerHTML =
            detail("Nome", [u.primeiroNome, u.ultimoNome].filter(Boolean).join(" ")) +
            detail("E-mail", u.email) +
            detail("Telefone", u.telefone) +
            detail("CPF", u.cpf) +
            detail("RG", u.rg) +
            detail("Número OAB", u.numeroOAB) +
            detail("Data de nascimento", formatDate(u.dataNascimento)) +
            detail("Empresa", u.empresa) +
            detail("Cidade", u.cidade) +
            detail("Estado", u.estado) +
            detail("CEP", u.cep);
        openModal("modalDetalhesRegistro");
    });

    $("btnVerMaisEmpresa")?.addEventListener("click", () => {
        const u = state.usuarioDetalhado;
        if (!u) return;

        $("detalhesTitulo").innerHTML = '<i class="fa-regular fa-building"></i> Dados da empresa vinculada';
        $("detalhesConteudo").innerHTML =
            detail("Empresa", u.empresa) +
            detail("Responsável", [u.primeiroNome, u.ultimoNome].filter(Boolean).join(" ")) +
            detail("E-mail", u.email) +
            detail("Telefone", u.telefone) +
            detail("Cidade", u.cidade) +
            detail("Estado", u.estado) +
            detail("CEP", u.cep) +
            detail("CNPJ", "Não disponível no modelo atual do backend");
        openModal("modalDetalhesRegistro");
    });

    function setText(id, value) {
        const el = $(id);
        if (el) el.textContent = value ?? "—";
    }

    async function loadTarefas() {
        if (!state.token) return;
        state.tarefas = await api("/tarefas");
        renderTarefas();
    }

    function renderTarefas() {
        const query = ($("buscaTarefas")?.value || "").trim().toLowerCase();
        const prioridade = $("filtroPrioridadeTarefa")?.value || "";

        const filtradas = state.tarefas.filter(tarefa => {
            const texto = [
                tarefa.tipoTarefa,
                tarefa.descricao,
                tarefa.processo?.numeroProcesso,
                tarefa.processo?.cliente?.nomeCompleto
            ].filter(Boolean).join(" ").toLowerCase();

            return texto.includes(query)
                && (!prioridade || (tarefa.prioridade || "MEDIA") === prioridade);
        });

        const grupos = {
            PENDENTE: [],
            EM_ANDAMENTO: [],
            CONCLUIDA: []
        };

        filtradas.forEach(tarefa => {
            const status = tarefa.status === "ATRASADA"
                ? "PENDENTE"
                : tarefa.status;

            (grupos[status] || grupos.PENDENTE).push(tarefa);
        });

        renderTarefaColumn("kanbanPendente", grupos.PENDENTE);
        renderTarefaColumn("kanbanAndamento", grupos.EM_ANDAMENTO);
        renderTarefaColumn("kanbanConcluida", grupos.CONCLUIDA);

        setText("countPendente", grupos.PENDENTE.length);
        setText("countAndamento", grupos.EM_ANDAMENTO.length);
        setText("countConcluida", grupos.CONCLUIDA.length);

        bindTaskDrag();
    }

    function renderTarefaColumn(id, tarefas) {
        const container = $(id);
        if (!container) return;

        if (!tarefas.length) {
            container.innerHTML = '<div class="kanban-empty">Solte um card aqui ou crie uma nova tarefa.</div>';
            return;
        }

        container.innerHTML = tarefas
            .sort((a, b) => new Date(a.prazo) - new Date(b.prazo))
            .map(tarefa => taskCardHtml(tarefa))
            .join("");
    }

    function taskCardHtml(tarefa) {
        const prioridade = tarefa.prioridade || "MEDIA";
        const processo = tarefa.processo?.numeroProcesso || "Sem processo";
        const prazo = formatDateTime(tarefa.prazo);
        const atrasada = tarefa.status === "ATRASADA"
            || (tarefa.status !== "CONCLUIDA" && new Date(tarefa.prazo) < new Date());

        return `
            <article class="task-card priority-${prioridade}"
                     draggable="true"
                     data-task-id="${tarefa.idTarefa}">
                <div class="task-card-head">
                    <div class="task-card-title">
                        <h3>${escapeHtml(tarefa.tipoTarefa)}</h3>
                    </div>
                    <div class="task-card-actions">
                        <button class="task-card-action"
                                type="button"
                                data-task-edit="${tarefa.idTarefa}"
                                title="Editar card">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                        <button class="task-card-action"
                                type="button"
                                data-task-delete="${tarefa.idTarefa}"
                                title="Excluir card">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                ${tarefa.descricao
                    ? `<p class="task-card-description">${escapeHtml(tarefa.descricao)}</p>`
                    : ""}
                <div class="task-card-meta">
                    <span class="task-chip priority-${prioridade}">
                        <i class="fa-solid fa-flag"></i>
                        ${translatePrioridade(prioridade)}
                    </span>
                    <span class="task-chip">
                        <i class="fa-regular fa-calendar"></i>
                        ${escapeHtml(prazo)}
                    </span>
                    <span class="task-chip">
                        <i class="fa-solid fa-scale-balanced"></i>
                        ${escapeHtml(processo)}
                    </span>
                    ${atrasada
                        ? '<span class="task-chip priority-URGENTE"><i class="fa-solid fa-triangle-exclamation"></i> Atrasada</span>'
                        : ""}
                </div>
            </article>
        `;
    }

    function bindTaskDrag() {
        document.querySelectorAll(".task-card").forEach(card => {
            card.addEventListener("dragstart", event => {
                card.classList.add("dragging");
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", card.dataset.taskId);
            });

            card.addEventListener("dragend", () => {
                card.classList.remove("dragging");
                document.querySelectorAll(".kanban-dropzone")
                    .forEach(zone => zone.classList.remove("drag-over"));
            });
        });
    }

    document.querySelectorAll(".kanban-dropzone").forEach(zone => {
        zone.addEventListener("dragover", event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            zone.classList.add("drag-over");
        });

        zone.addEventListener("dragleave", event => {
            if (!zone.contains(event.relatedTarget)) {
                zone.classList.remove("drag-over");
            }
        });

        zone.addEventListener("drop", async event => {
            event.preventDefault();
            zone.classList.remove("drag-over");

            const id = Number(event.dataTransfer.getData("text/plain"));
            const tarefa = state.tarefas.find(item => item.idTarefa === id);
            const novoStatus = zone.dataset.status;

            if (!tarefa || !novoStatus || tarefa.status === novoStatus) return;

            const statusAnterior = tarefa.status;
            tarefa.status = novoStatus;
            renderTarefas();

            try {
                const atualizada = await api(`/tarefas/${id}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: novoStatus })
                });

                const index = state.tarefas.findIndex(item => item.idTarefa === id);
                if (index >= 0) state.tarefas[index] = atualizada;
                renderTarefas();
            } catch (error) {
                tarefa.status = statusAnterior;
                renderTarefas();
                alertModal("Não foi possível mover o card", error.message);
            }
        });
    });

    $("buscaTarefas")?.addEventListener("input", renderTarefas);
    $("filtroPrioridadeTarefa")?.addEventListener("change", renderTarefas);

    function preencherProcessosTarefa(selected = "") {
        const select = $("selectProcessoTarefa");
        if (!select) return;

        select.innerHTML = '<option value="">Selecione um processo</option>' +
            state.processos.map(processo =>
                `<option value="${processo.idProcesso}">
                    ${escapeHtml(processo.numeroProcesso)}
                    ${processo.cliente?.nomeCompleto
                        ? " — " + escapeHtml(processo.cliente.nomeCompleto)
                        : ""}
                </option>`
            ).join("");

        select.value = selected ? String(selected) : "";
    }

    function abrirNovaTarefa() {
        $("tarefaIdEdicao").value = "";
        $("tituloModalTarefa").innerHTML = '<i class="fa-solid fa-note-sticky"></i> Novo Card';
        $("inputTituloTarefa").value = "";
        $("inputDescricaoTarefa").value = "";
        $("selectPrioridadeTarefa").value = "MEDIA";
        $("selectStatusTarefa").value = "PENDENTE";
        $("btnExcluirTarefa").classList.add("task-delete-hidden");
        preencherProcessosTarefa();

        const prazo = new Date();
        prazo.setDate(prazo.getDate() + 1);
        prazo.setHours(18, 0, 0, 0);
        $("inputPrazoTarefa").value = toDateTimeLocal(prazo);

        openModal("modalNovaTarefa");
    }

    function abrirEditarTarefa(id) {
        const tarefa = state.tarefas.find(item => item.idTarefa === id);
        if (!tarefa) return;

        $("tarefaIdEdicao").value = String(tarefa.idTarefa);
        $("tituloModalTarefa").innerHTML = '<i class="fa-regular fa-pen-to-square"></i> Editar Card';
        $("inputTituloTarefa").value = tarefa.tipoTarefa || "";
        $("inputDescricaoTarefa").value = tarefa.descricao || "";
        $("inputPrazoTarefa").value = toDateTimeLocal(new Date(tarefa.prazo));
        $("selectPrioridadeTarefa").value = tarefa.prioridade || "MEDIA";
        $("selectStatusTarefa").value = tarefa.status === "ATRASADA" ? "PENDENTE" : tarefa.status;
        preencherProcessosTarefa(tarefa.processo?.idProcesso);
        $("btnExcluirTarefa").classList.remove("task-delete-hidden");

        openModal("modalNovaTarefa");
    }

    async function salvarTarefa() {
        const id = Number($("tarefaIdEdicao")?.value || 0);
        const titulo = $("inputTituloTarefa").value.trim();
        const descricao = $("inputDescricaoTarefa").value.trim();
        const prazo = $("inputPrazoTarefa").value;
        const processoId = Number($("selectProcessoTarefa").value);

        if (!titulo || !prazo || !processoId) {
            return alertModal(
                "Dados incompletos",
                "Informe título, prazo e processo para salvar o card."
            );
        }

        const payload = {
            tipoTarefa: titulo,
            descricao: descricao || null,
            prazo: localInputToIso(prazo),
            status: $("selectStatusTarefa").value,
            prioridade: $("selectPrioridadeTarefa").value,
            processoId,
            usuarioResponsavelId: state.usuario?.idUsuario
        };

        try {
            if (id) {
                await api(`/tarefas/${id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload)
                });
            } else {
                await api("/tarefas", {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
            }

            closeModals();
            await loadTarefas();
        } catch (error) {
            alertModal(
                id ? "Falha ao editar card" : "Falha ao criar card",
                error.message
            );
        }
    }

    async function excluirTarefa(id) {
        if (!id) return;
        const confirmado = await confirmAction(
            "Tem certeza que quer excluir este card?",
            "O card será removido permanentemente. Escolha NÃO para cancelar e manter a tarefa."
        );
        if (!confirmado) return;

        try {
            await api(`/tarefas/${id}`, {
                method: "DELETE"
            });

            closeModals();
            await loadTarefas();
        } catch (error) {
            alertModal(
                "Não foi possível excluir o card",
                error.message
            );
        }
    }

    // Captura os controles de tarefa antes dos listeners antigos do protótipo.
    document.addEventListener("click", event => {
        const novo = event.target.closest("#btnNovaTarefa");
        const salvar = event.target.closest("#btnConfirmarTarefa");
        const excluirModal = event.target.closest("#btnExcluirTarefa");
        const editarCard = event.target.closest("[data-task-edit]");
        const excluirCard = event.target.closest("[data-task-delete]");

        if (novo) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            abrirNovaTarefa();
            return;
        }

        if (salvar) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            salvarTarefa();
            return;
        }

        if (excluirModal) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            excluirTarefa(Number($("tarefaIdEdicao").value));
            return;
        }

        if (editarCard) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            abrirEditarTarefa(Number(editarCard.dataset.taskEdit));
            return;
        }

        if (excluirCard) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            excluirTarefa(Number(excluirCard.dataset.taskDelete));
        }
    }, true);

    function translatePrioridade(value) {
        return ({
            BAIXA: "Baixa",
            MEDIA: "Média",
            ALTA: "Alta",
            URGENTE: "Urgente"
        })[value] || "Média";
    }

    function formatDateTime(value) {
        if (!value) return "Sem prazo";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;

        return date.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function toDateTimeLocal(date) {
        const pad = value => String(value).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function localInputToIso(value) {
        return value.length === 16
            ? `${value}:00`
            : value;
    }

    async function loadNotificacoes() {
        if (!state.token) return;

        state.notificacoes = await api("/notificacoes/minhas");
        renderNotificacoes();
    }

    function renderNotificacoes() {
        const container = $("notificationsList");
        if (!container) return;

        const activeFilter = document.querySelector(".notif-filter.active")?.dataset.filter || "all";

        const filtradas = state.notificacoes.filter(notificacao => {
            if (activeFilter === "all") return true;
            if (activeFilter === "nao-lidas") return !notificacao.lida;
            return notificacao.status === activeFilter;
        });

        const naoLidas = state.notificacoes.filter(n => !n.lida).length;
        const hoje = new Date();
        const hojeCount = state.notificacoes.filter(n => {
            if (!n.dataEnvio) return false;
            const d = new Date(n.dataEnvio);
            return d.getFullYear() === hoje.getFullYear()
                && d.getMonth() === hoje.getMonth()
                && d.getDate() === hoje.getDate();
        }).length;

        setText("notifUnreadCount", naoLidas);
        setText("notifTotalCount", state.notificacoes.length);
        setText("notifTodayCount", hojeCount);

        const badge = $("badgeNotifCount");
        if (badge) {
            badge.textContent = String(naoLidas);
            badge.style.display = naoLidas > 0 ? "flex" : "none";
        }

        if (!filtradas.length) {
            container.innerHTML = `
                <div class="notifications-empty">
                    <i class="fa-regular fa-bell-slash"></i>
                    <strong>Nenhuma notificação neste filtro</strong>
                    <span>Quando houver novidades, elas aparecerão aqui.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = filtradas.map(notificacao => {
            const unread = !notificacao.lida;
            const status = notificacao.status || "PENDENTE";
            const canal = notificacao.canal || "Sistema";
            const icon = notificationIcon(canal, status);

            return `
                <article class="notification-item ${unread ? "unread" : ""}"
                         data-notification-id="${notificacao.idNotificacao}">
                    <div class="notif-accent"></div>
                    <div class="notif-symbol ${notificationClass(canal, status)}">
                        <i class="${icon}"></i>
                    </div>
                    <div class="notif-main">
                        <div class="notif-heading-row">
                            <span class="notif-category">${escapeHtml(canal)}</span>
                            ${unread ? '<span class="notif-unread-dot" title="Não lida"></span>' : ""}
                        </div>
                        <h3>${escapeHtml(notificationTitle(notificacao))}</h3>
                        <p>${escapeHtml(notificacao.mensagem || "Sem detalhes.")}</p>
                        <div class="notif-meta">
                            <span><i class="fa-regular fa-clock"></i> ${escapeHtml(formatDateTime(notificacao.dataEnvio))}</span>
                            <span>${escapeHtml(translateNotificationStatus(status))}</span>
                        </div>
                    </div>
                    <div class="notif-actions">
                        <button class="notif-action" type="button"
                                data-notification-view="${notificacao.idNotificacao}">
                            Ver detalhes
                        </button>
                        ${unread ? `
                            <button class="notif-icon-btn" type="button"
                                    data-notification-read="${notificacao.idNotificacao}"
                                    title="Marcar como lida">
                                <i class="fa-regular fa-circle-check"></i>
                            </button>
                        ` : ""}
                    </div>
                </article>
            `;
        }).join("");
    }

    document.querySelectorAll(".notif-filter").forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            document.querySelectorAll(".notif-filter")
                .forEach(item => item.classList.remove("active"));
            button.classList.add("active");
            renderNotificacoes();
        }, true);
    });

    $("btnMarcarTodasLidas")?.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();

        try {
            await api("/notificacoes/minhas/lidas", {
                method: "PATCH"
            });

            state.notificacoes.forEach(n => n.lida = true);
            renderNotificacoes();
        } catch (error) {
            alertModal("Falha ao atualizar notificações", error.message);
        }
    }, true);

    $("notificationsList")?.addEventListener("click", async event => {
        const readButton = event.target.closest("[data-notification-read]");
        const viewButton = event.target.closest("[data-notification-view]");

        if (readButton) {
            const id = Number(readButton.dataset.notificationRead);

            try {
                const atualizada = await api(`/notificacoes/${id}/lida`, {
                    method: "PATCH"
                });

                const index = state.notificacoes.findIndex(n => n.idNotificacao === id);
                if (index >= 0) state.notificacoes[index] = atualizada;
                renderNotificacoes();
            } catch (error) {
                alertModal("Falha ao atualizar notificação", error.message);
            }

            return;
        }

        if (viewButton) {
            const id = Number(viewButton.dataset.notificationView);
            const notificacao = state.notificacoes.find(n => n.idNotificacao === id);
            if (!notificacao) return;

            $("detalhesTitulo").innerHTML = '<i class="fa-regular fa-bell"></i> Notificação';
            $("detalhesConteudo").innerHTML =
                detail("Canal", notificacao.canal) +
                detail("Status", translateNotificationStatus(notificacao.status)) +
                detail("Data", formatDateTime(notificacao.dataEnvio)) +
                detail("Mensagem", notificacao.mensagem);

            openModal("modalDetalhesRegistro");

            if (!notificacao.lida) {
                try {
                    const atualizada = await api(`/notificacoes/${id}/lida`, {
                        method: "PATCH"
                    });
                    const index = state.notificacoes.findIndex(n => n.idNotificacao === id);
                    if (index >= 0) state.notificacoes[index] = atualizada;
                    renderNotificacoes();
                } catch (_) {}
            }
        }
    });

    function notificationTitle(notificacao) {
        const mensagem = (notificacao.mensagem || "").trim();
        if (!mensagem) return "Nova notificação";

        const primeiraFrase = mensagem.split(/[.!?]/)[0].trim();
        return primeiraFrase.length > 70
            ? primeiraFrase.slice(0, 67) + "..."
            : primeiraFrase;
    }

    function notificationIcon(canal, status) {
        const texto = `${canal} ${status}`.toLowerCase();

        if (texto.includes("prazo")) return "fa-regular fa-calendar";
        if (texto.includes("tarefa")) return "fa-solid fa-list-check";
        if (texto.includes("process")) return "fa-solid fa-scale-balanced";
        if (texto.includes("document")) return "fa-solid fa-file-lines";
        if (status === "CANCELADA") return "fa-solid fa-ban";
        return "fa-regular fa-bell";
    }

    function notificationClass(canal, status) {
        if (status === "CANCELADA") return "danger";
        const texto = (canal || "").toLowerCase();
        if (texto.includes("tarefa")) return "task";
        if (texto.includes("process")) return "process";
        if (texto.includes("document")) return "document";
        return status === "ENVIADA" ? "success" : "";
    }

    function translateNotificationStatus(status) {
        return ({
            PENDENTE: "Pendente",
            ENVIADA: "Enviada",
            CANCELADA: "Cancelada"
        })[status] || status || "—";
    }

    function atualizarHome() {
        setText("homeProcessosCount", state.processos.length);
        setText("homeClientesCount", state.clientes.length);
        setText(
            "homeTarefasCount",
            state.tarefas.filter(t => t.status !== "CONCLUIDA").length
        );

        const naoLidas = state.notificacoes.filter(n => !n.lida).length;
        setText("homeNotifCount", naoLidas);

        const preview = $("homeNotificationsPreview");
        if (!preview) return;

        const ultimas = state.notificacoes.slice(0, 3);

        preview.innerHTML = ultimas.length
            ? ultimas.map(n => `
                <div class="home-notif-item">
                    <i class="fa-regular fa-bell"></i>
                    <div>
                        <strong>${escapeHtml(n.canal || "Sistema")}</strong>
                        <span>${escapeHtml(n.mensagem || "Nova notificação")}</span>
                    </div>
                </div>
            `).join("")
            : '<div class="home-empty">Nenhuma notificação disponível.</div>';
    }

    const temaSalvo = localStorage.getItem("vixlegen_theme") || "light";
    aplicarTema(temaSalvo);

    function alternarTema() {
        const proximo = document.body.dataset.theme === "dark"
            ? "light"
            : "dark";

        aplicarTema(proximo);
    }

    $("btnTema")?.addEventListener("click", alternarTema);
    $("btnTemaAuth")?.addEventListener("click", alternarTema);

    $("btnTema")?.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            alternarTema();
        }
    });

    function aplicarTema(tema) {
        document.body.dataset.theme = tema;
        localStorage.setItem("vixlegen_theme", tema);

        ["iconeTema", "iconeTemaAuth"].forEach(id => {
            const icon = $(id);
            if (icon) {
                icon.className = tema === "dark"
                    ? "fa-solid fa-sun"
                    : "fa-solid fa-moon";
            }
        });

        const label = tema === "dark"
            ? "Usar tema claro"
            : "Usar tema escuro";

        const btnApp = $("btnTema");
        if (btnApp) {
            btnApp.dataset.tooltip = label;
            btnApp.setAttribute("aria-label", label);
        }

        const btnAuth = $("btnTemaAuth");
        if (btnAuth) {
            btnAuth.setAttribute("aria-label", label);
            const span = btnAuth.querySelector("span");
            if (span) span.textContent = tema === "dark" ? "Claro" : "Escuro";
        }
    }

    $("btnAnexarIa")?.addEventListener("click", () => {
        $("aiFileInput")?.click();
    });

    $("aiFileInput")?.addEventListener("change", event => {
        const novos = Array.from(event.target.files || []);

        novos.forEach(file => {
            const key = `${file.name}-${file.size}-${file.lastModified}`;

            if (!state.aiFiles.some(item => item.key === key)) {
                state.aiFiles.push({ key, file });
            }
        });

        event.target.value = "";
        renderIaFiles();
    });

    $("aiFilesList")?.addEventListener("click", event => {
        const remove = event.target.closest("[data-ai-file-remove]");
        if (!remove) return;

        state.aiFiles = state.aiFiles.filter(
            item => item.key !== remove.dataset.aiFileRemove
        );

        renderIaFiles();
    });

    function renderIaFiles() {
        const list = $("aiFilesList");
        const summary = $("aiAttachedSummary");
        if (!list) return;

        if (!state.aiFiles.length) {
            list.innerHTML = '<div class="ai-file-empty">Nenhum arquivo anexado.</div>';
            if (summary) {
                summary.hidden = true;
                summary.textContent = "";
            }
            return;
        }

        list.innerHTML = state.aiFiles.map(item => `
            <div class="ai-file-item">
                <i class="fa-regular fa-file-lines"></i>
                <div>
                    <strong>${escapeHtml(item.file.name)}</strong>
                    <span>${formatFileSize(item.file.size)}</span>
                </div>
                <button class="ai-file-remove"
                        type="button"
                        data-ai-file-remove="${escapeHtml(item.key)}"
                        title="Remover arquivo">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `).join("");

        if (summary) {
            summary.hidden = false;
            summary.textContent =
                `${state.aiFiles.length} arquivo(s) anexado(s) à conversa.`;
        }
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    $("btnEnviarChat")?.addEventListener("click", enviarMensagemIa);

    $("chatInput")?.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            enviarMensagemIa();
        }
    });

    function enviarMensagemIa() {
        const input = $("chatInput");
        const mensagens = $("chatMessages");
        const texto = input?.value.trim();

        if (!texto && !state.aiFiles.length) return;

        const anexos = state.aiFiles.length
            ? `<div class="chat-attachments">${state.aiFiles.map(item =>
                `<span><i class="fa-regular fa-file"></i> ${escapeHtml(item.file.name)}</span>`
              ).join("")}</div>`
            : "";

        mensagens?.insertAdjacentHTML(
            "beforeend",
            `
                <div class="chat-msg user">
                    <div>
                        ${texto ? `<p>${escapeHtml(texto)}</p>` : ""}
                        ${anexos}
                    </div>
                </div>
                <div class="chat-msg ai">
                    <i class="fa-solid fa-robot"></i>
                    <p>Contexto recebido. A análise automática dos arquivos será executada quando o provedor de IA estiver conectado ao backend.</p>
                </div>
            `
        );

        if (input) input.value = "";
        mensagens?.scrollTo({
            top: mensagens.scrollHeight,
            behavior: "smooth"
        });
    }

    async function loadCategoriasDocumento() {
        if (!state.token) return;
        state.categoriasDocumento = await api("/categorias-documento");

        const select = $("selectMinutaCategoria");
        if (!select) return;

        select.innerHTML = '<option value="">Categoria...</option>' +
            state.categoriasDocumento
                .map(c => `<option value="${c.codigoCategoriaDocumento}">${escapeHtml(c.descricao)}</option>`)
                .join("");

        if (!state.categoriasDocumento.length) {
            select.innerHTML = '<option value="">Nenhuma categoria cadastrada</option>';
            select.disabled = true;
            return;
        }

        select.disabled = false;

        const preferida = state.categoriasDocumento.find(c =>
            /peti[cç][aã]o inicial/i.test(c.descricao || "")
        );

        if (preferida) {
            select.value = String(preferida.codigoCategoriaDocumento);
        } else {
            select.value = String(state.categoriasDocumento[0].codigoCategoriaDocumento);
        }
    }

    function fillProcessoSelect() {
        const select = $("selectMinutaProcesso");
        if (!select) return;

        const previous = select.value;
        select.innerHTML = '<option value="">Processo...</option>' +
            state.processos.map(p =>
                `<option value="${p.idProcesso}">${escapeHtml(p.numeroProcesso)}${p.cliente?.nomeCompleto ? " — " + escapeHtml(p.cliente.nomeCompleto) : ""}</option>`
            ).join("");

        if ([...select.options].some(o => o.value === previous)) {
            select.value = previous;
        }
    }

    $("selectMinutaProcesso")?.addEventListener("change", async event => {
        const idProcesso = Number(event.target.value);

        if (!idProcesso) {
            state.documentoAtualId = null;
            return;
        }

        await abrirProcessoNoEditor(idProcesso);
    });

    async function abrirProcessoNoEditor(idProcesso) {
        if (!idProcesso) return;

        try {
            const documentos = await api(`/documentos/processo/${idProcesso}`);

            const documento = [...documentos]
                .sort((a, b) =>
                    new Date(b.dataCadastro || 0) - new Date(a.dataCadastro || 0)
                )[0];

            if (documento) {
                state.documentoAtualId = documento.idDocumento;
                $("docTitle").value = documento.nome || `Minuta_Processo_${idProcesso}`;
                $("paperEditor").innerHTML = documento.conteudo || "<p><br></p>";

                if (documento.categoriaDocumento?.codigoCategoriaDocumento) {
                    $("selectMinutaCategoria").value =
                        String(documento.categoriaDocumento.codigoCategoriaDocumento);
                }
            } else {
                state.documentoAtualId = null;
                $("docTitle").value = `Minuta_Processo_${idProcesso}`;

                const processo = state.processos.find(
                    p => p.idProcesso === idProcesso
                );

                $("paperEditor").innerHTML = `
                    <h2 style="text-align:center; font-weight:bold; margin-bottom:25px;">
                        MINUTA DO PROCESSO
                    </h2>
                    <p><strong>Processo:</strong> ${escapeHtml(
                        processo?.numeroProcesso || String(idProcesso)
                    )}</p>
                    <p><br></p>
                `;
            }

            $("paperEditor").dispatchEvent(new Event("input"));
            scheduleEditorPagination(0);
        } catch (error) {
            alertModal(
                "Não foi possível abrir a minuta",
                error.message
            );
        }
    }

    // Paginação visual no estilo Word. Os separadores são apenas de interface
    // e são removidos antes de persistir a minuta no backend.
    let paginationTimer = null;
    let isPaginatingEditor = false;

    function getEditorCleanHtml() {
        const editor = $("paperEditor");
        if (!editor) return "";

        const clone = editor.cloneNode(true);
        clone.querySelectorAll(".editor-page-break").forEach(node => node.remove());

        return clone.innerHTML;
    }

    function scheduleEditorPagination(delay = 220) {
        clearTimeout(paginationTimer);
        paginationTimer = setTimeout(paginateEditor, delay);
    }

    function paginateEditor() {
        const editor = $("paperEditor");
        if (!editor || isPaginatingEditor) return;

        isPaginatingEditor = true;

        try {
            editor.querySelectorAll(".editor-page-break").forEach(node => node.remove());

            const PAGE_CONTENT_HEIGHT = 980;
            const children = Array.from(editor.children)
                .filter(node => !node.classList.contains("editor-page-break"));

            let usedHeight = 0;
            let pages = 1;

            children.forEach(child => {
                const style = getComputedStyle(child);
                const marginTop = parseFloat(style.marginTop) || 0;
                const marginBottom = parseFloat(style.marginBottom) || 0;
                const height = Math.max(
                    child.getBoundingClientRect().height + marginTop + marginBottom,
                    1
                );

                if (usedHeight > 0 && usedHeight + height > PAGE_CONTENT_HEIGHT) {
                    pages += 1;

                    const separator = document.createElement("div");
                    separator.className = "editor-page-break";
                    separator.setAttribute("contenteditable", "false");
                    separator.setAttribute("aria-hidden", "true");
                    separator.dataset.page = String(pages);

                    editor.insertBefore(separator, child);
                    usedHeight = height;
                } else {
                    usedHeight += height;
                }
            });

            const pageCount = $("pageCount");
            if (pageCount) {
                pageCount.textContent = `Página 1 de ${pages}`;
            }
        } finally {
            isPaginatingEditor = false;
        }
    }

    const editorEl = $("paperEditor");

    editorEl?.addEventListener("input", () => {
        scheduleEditorPagination();
    });

    document.querySelector(".editor-toolbar")?.addEventListener("click", () => {
        scheduleEditorPagination(120);
    });

    document.querySelector(".editor-toolbar")?.addEventListener("change", () => {
        scheduleEditorPagination(120);
    });

    document.addEventListener("click", event => {
        if (event.target.closest(".btn-template")) {
            setTimeout(() => scheduleEditorPagination(0), 0);
        }
    });

    window.addEventListener("resize", () => {
        scheduleEditorPagination(120);
    });

    scheduleEditorPagination(0);

    async function saveMinuta() {
        const idProcesso = Number($("selectMinutaProcesso")?.value);
        const idCategoria = Number($("selectMinutaCategoria")?.value);
        const nome = $("docTitle")?.value.trim();
        const conteudo = getEditorCleanHtml();

        if (!idProcesso || !idCategoria || !nome) {
            return alertModal(
                "Vinculação necessária",
                "Selecione o processo, a categoria e informe o nome da minuta."
            );
        }

        const payload = {
            nome,
            conteudo,
            tipoArquivo: "text/html",
            tamanhoArquivo: new Blob([conteudo]).size,
            processoId: idProcesso,
            categoriaDocumentoId: idCategoria
        };

        try {
            const documento = await saveMinutaSilenciosa();
            alertModal(
                "Minuta guardada",
                `Documento #${documento.idDocumento} salvo com a formatação editável.`
            );
        } catch (error) {
            alertModal("Falha ao salvar minuta", error.message);
        }
    }

    async function exportarPdfMinuta() {
        try {
            await saveMinutaSilenciosa();

            if (!state.documentoAtualId) {
                throw new Error("Salve a minuta antes de exportar o PDF.");
            }

            const response = await fetch(
                `${API_BASE}/documentos/${state.documentoAtualId}/pdf`,
                {
                    headers: {
                        Authorization: `Bearer ${state.token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Erro HTTP ${response.status} ao gerar PDF`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const nomeBase = ($("docTitle")?.value || "minuta")
                .trim()
                .replace(/[^a-zA-Z0-9._-]+/g, "_");

            const link = document.createElement("a");
            link.href = url;
            link.download = `${nomeBase}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(url), 1500);
        } catch (error) {
            alertModal("Falha ao exportar PDF", error.message);
        }
    }

    async function saveMinutaSilenciosa() {
        const idProcesso = Number($("selectMinutaProcesso")?.value);
        const idCategoria = Number($("selectMinutaCategoria")?.value);
        const nome = $("docTitle")?.value.trim();
        const conteudo = getEditorCleanHtml();

        if (!idProcesso || !idCategoria || !nome) {
            throw new Error(
                "Selecione processo, categoria e informe o nome da minuta."
            );
        }

        const payload = {
            nome,
            conteudo,
            tipoArquivo: "text/html",
            tamanhoArquivo: new Blob([conteudo]).size,
            processoId: idProcesso,
            categoriaDocumentoId: idCategoria
        };

        const documento = state.documentoAtualId
            ? await api(`/documentos/${state.documentoAtualId}`, {
                method: "PUT",
                body: JSON.stringify(payload)
            })
            : await api("/documentos", {
                method: "POST",
                body: JSON.stringify(payload)
            });

        state.documentoAtualId = documento.idDocumento;

        return documento;
    }

    // Captura antes do listener antigo que apenas exibia sucesso sem persistir.
    document.addEventListener("click", (event) => {
        if (event.target.closest("#btnSalvarMinuta")) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            saveMinuta();
            return;
        }

        if (event.target.closest("#btnExportPDF")) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            exportarPdfMinuta();
            return;
        }

        if (event.target.closest(".modal-close") ||
            event.target.closest("#btnFecharDetalhes") ||
            event.target.closest("#btnFecharAlerta")) {

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            closeModals();
            return;
        }

        if (event.target.closest("#btnConfirmarSair")) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            clearSession();
            closeModals();
            showAuth("login");
        }
    }, true);

    async function loadAll() {
        const results = await Promise.allSettled([
            loadPerfil(),
            loadClientes(),
            loadProcessos(),
            loadTarefas(),
            loadNotificacoes(),
            loadCategoriasDocumento()
        ]);

        atualizarHome();

        const unauthorized = results.some(r => r.status === "rejected" && r.reason?.status === 401);
        if (unauthorized) {
            clearSession();
            showAuth("login");
        }
    }

    function translateStatus(status) {
        return ({
            EM_ANDAMENTO: "Em andamento",
            SUSPENSO: "Suspenso",
            ENCERRADO: "Encerrado",
            AGUARDANDO_DECISAO: "Aguardando decisão"
        })[status] || status || "Sem classificação";
    }

    function statusPill(status) {
        if (!status) return '<span class="status-pill encerrado">Sem classificação</span>';
        const css = status.toLowerCase().replaceAll("_", "-");
        return `<span class="status-pill ${css}">${escapeHtml(translateStatus(status))}</span>`;
    }

    function formatDate(value) {
        if (!value) return "—";
        const parts = String(value).split("-");
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
    }

    function detail(label, value) {
        return `<div class="detail-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "—")}</strong></div>`;
    }

    if (state.token && state.usuario) {
        showApp();
        loadAll();
    } else {
        showAuth("login");
    }
});
