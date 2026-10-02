document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = window.VIXLEGEN_API_URL || "http://localhost:8080";

    const state = {
        token: localStorage.getItem("vixlegen_token") || "",
        usuario: JSON.parse(localStorage.getItem("vixlegen_usuario") || "null"),
        clientes: [],
        processos: [],
        status: new Map(),
        categoriasDocumento: [],
        documentoAtualId: null,
        usuarioDetalhado: null
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

    function openModal(id) {
        document.querySelectorAll(".modal-card").forEach(m => m.classList.remove("active"));
        $("modalOverlay")?.classList.add("active");
        $(id)?.classList.add("active");
    }

    function closeModals() {
        $("modalOverlay")?.classList.remove("active");
        document.querySelectorAll(".modal-card").forEach(m => m.classList.remove("active"));
    }

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
                        <button class="record-icon-btn" data-cliente-view="${c.idCliente}" title="Ver detalhes"><i class="fa-regular fa-eye"></i></button>
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
            if (!confirm("Excluir este cliente?")) return;
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
                    <td><div class="record-main"><strong>${escapeHtml(p.numeroProcesso)}</strong><span>ID #${p.idProcesso}${p.segredoJustica ? " • Segredo de justiça" : ""}</span></div></td>
                    <td>${escapeHtml(p.cliente?.nomeCompleto || "—")}</td>
                    <td>${escapeHtml(p.tribunal || "—")}</td>
                    <td>${escapeHtml(p.comarca || "—")}</td>
                    <td>${statusPill(state.status.get(p.idProcesso))}</td>
                    <td>${formatDate(p.dataAbertura)}</td>
                    <td><div class="record-actions">
                        <button class="record-icon-btn" data-processo-view="${p.idProcesso}" title="Ver detalhes"><i class="fa-regular fa-eye"></i></button>
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
            $("selectMinutaProcesso").value = String(editor.dataset.processoEditor);
            state.documentoAtualId = null;
            document.querySelector('[data-target="sec-editor"]')?.click();
        }

        if (remove) {
            const id = Number(remove.dataset.processoDelete);
            if (!confirm("Excluir este processo?")) return;
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

    async function loadCategoriasDocumento() {
        if (!state.token) return;
        state.categoriasDocumento = await api("/categorias-documento");

        const select = $("selectMinutaCategoria");
        if (!select) return;

        select.innerHTML = '<option value="">Categoria...</option>' +
            state.categoriasDocumento
                .map(c => `<option value="${c.codigoCategoriaDocumento}">${escapeHtml(c.descricao)}</option>`)
                .join("");

        if (state.categoriasDocumento.length === 1) {
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

    $("selectMinutaProcesso")?.addEventListener("change", () => {
        state.documentoAtualId = null;
    });

    async function saveMinuta() {
        const idProcesso = Number($("selectMinutaProcesso")?.value);
        const idCategoria = Number($("selectMinutaCategoria")?.value);
        const nome = $("docTitle")?.value.trim();
        const conteudo = $("paperEditor")?.innerHTML || "";

        if (!idProcesso || !idCategoria || !nome) {
            return alertModal(
                "Vinculação necessária",
                "Selecione o processo, a categoria e informe o nome da minuta."
            );
        }

        const payload = {
            nome,
            conteudo,
            arquivo: null,
            tipoArquivo: "text/html",
            tamanhoArquivo: new Blob([conteudo]).size,
            processo: { idProcesso },
            categoriaDocumento: { codigoCategoriaDocumento: idCategoria }
        };

        try {
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
            alertModal("Minuta guardada", `Documento #${documento.idDocumento} salvo no banco.`);
        } catch (error) {
            alertModal("Falha ao salvar minuta", error.message);
        }
    }

    // Captura antes do listener antigo que apenas exibia sucesso sem persistir.
    document.addEventListener("click", (event) => {
        if (event.target.closest("#btnSalvarMinuta")) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            saveMinuta();
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
            loadCategoriasDocumento()
        ]);

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
