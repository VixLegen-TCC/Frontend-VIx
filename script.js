document.addEventListener("DOMContentLoaded", () => {

    // =========================================
    // ELEMENOS DOS MODAIS & FUNÇÕES GLOBAIS
    // =========================================
    const modalOverlay = document.getElementById("modalOverlay");
    const modais = document.querySelectorAll(".modal-card");

    function abrirModal(idModal) {
        modais.forEach(m => m.classList.remove("active"));
        const modalAlvo = document.getElementById(idModal);
        if (modalAlvo && modalOverlay) {
            modalOverlay.classList.add("active");
            modalAlvo.classList.add("active");
        }
    }

    function fecharModais() {
        if (modalOverlay) {
            modalOverlay.classList.remove("active");
            modais.forEach(m => m.classList.remove("active"));
        }
    }

    function mostrarAlerta(titulo, mensagem) {
        document.getElementById("alertaTitulo").innerHTML = `<i class="fa-solid fa-circle-check"></i> ${escapeHtml(titulo)}`;
        document.getElementById("alertaMensagem").innerText = mensagem;
        abrirModal("modalAlerta");
    }

    document.querySelectorAll(".modal-close, .modal-btn.cancel, #btnFecharAlerta").forEach(btn => {
        btn.addEventListener("click", fecharModais);
    });

    if (modalOverlay) {
        modalOverlay.addEventListener("click", (e) => {
            if (e.target === modalOverlay) fecharModais();
        });
    }

    // =========================================
    // 1. ALTERNAR BARRA LATERAL
    // =========================================
    const btnToggle = document.getElementById("btnToggle");
    const minhaSidebar = document.getElementById("minhaSidebar");

    if (btnToggle && minhaSidebar) {
        btnToggle.addEventListener("click", () => {
            minhaSidebar.classList.toggle("escondida");
        });
    }

    // =========================================
    // 2. NAVEGAÇÃO ENTRE SEÇÕES (SPA)
    // =========================================
    const navBtns = document.querySelectorAll(".nav-icons .icon-btn[data-target]");
    const appSections = document.querySelectorAll(".app-section");

    function navegarParaSecao(targetId) {
        const targetSec = document.getElementById(targetId);
        if (!targetSec) return;

        appSections.forEach(sec => {
            sec.style.display = "none";
            sec.classList.remove("active");
        });

        targetSec.style.display = targetId === "sec-editor" ? "flex" : "block";
        targetSec.classList.add("active");

        navBtns.forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-target") === targetId);
        });
    }

    navBtns.forEach(btn => {
        btn.addEventListener("click", () => navegarParaSecao(btn.getAttribute("data-target")));
    });

    document.addEventListener("click", (event) => {
        const shortcut = event.target.closest("[data-go-section]");
        if (!shortcut) return;
        navegarParaSecao(shortcut.getAttribute("data-go-section"));
    });

    // =========================================
    // 3. COMANDOS DO EDITOR DE TEXTO (WYSIWYG)
    // =========================================
    const paperEditor = document.getElementById("paperEditor");

    function execCmd(command, value = null) {
        document.execCommand(command, false, value);
        paperEditor.focus();
        atualizarMetricas();
    }

    document.getElementById("btnBold").addEventListener("click", () => execCmd("bold"));
    document.getElementById("btnItalic").addEventListener("click", () => execCmd("italic"));
    document.getElementById("btnUnderline").addEventListener("click", () => execCmd("underline"));
    document.getElementById("btnStrike").addEventListener("click", () => execCmd("strikeThrough"));

    document.getElementById("btnAlignLeft").addEventListener("click", () => execCmd("justifyLeft"));
    document.getElementById("btnAlignCenter").addEventListener("click", () => execCmd("justifyCenter"));
    document.getElementById("btnAlignRight").addEventListener("click", () => execCmd("justifyRight"));
    document.getElementById("btnAlignJustify").addEventListener("click", () => execCmd("justifyFull"));

    document.getElementById("btnUnorderedList").addEventListener("click", () => execCmd("insertUnorderedList"));
    document.getElementById("btnOrderedList").addEventListener("click", () => execCmd("insertOrderedList"));

    document.getElementById("btnUndo").addEventListener("click", () => execCmd("undo"));
    document.getElementById("btnRedo").addEventListener("click", () => execCmd("redo"));

    document.getElementById("fontFamilySelect").addEventListener("change", (e) => {
        execCmd("fontName", e.target.value);
    });

    document.getElementById("fontSizeSelect").addEventListener("change", (e) => {
        execCmd("fontSize", e.target.value);
    });

    document.getElementById("textColorPicker").addEventListener("input", (e) => {
        execCmd("foreColor", e.target.value);
    });

    document.getElementById("lineSpacingSelect").addEventListener("change", (e) => {
        paperEditor.style.lineHeight = e.target.value;
    });

    // Citação Jurisprudencial (4cm)
    document.getElementById("btnLegalQuote").addEventListener("click", () => {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const blockquote = document.createElement("blockquote");
            blockquote.style.marginLeft = "4cm";
            blockquote.style.fontSize = "10pt";
            blockquote.style.lineHeight = "1.2";
            blockquote.style.fontStyle = "italic";
            blockquote.style.borderLeft = "3px solid #883942";
            blockquote.style.paddingLeft = "10px";
            blockquote.style.margin = "15px 0 15px 4cm";
            
            blockquote.appendChild(range.extractContents());
            range.insertNode(blockquote);
        }
    });

    // Inserir Nota de Rodapé
    document.getElementById("btnFootnote").addEventListener("click", () => {
        const footnoteNum = prompt("Digite o número ou texto da nota de rodapé:", "1");
        if (footnoteNum) {
            execCmd("insertHTML", `<sup>[${footnoteNum}]</sup>`);
        }
    });

    // Inserir Link / Jurisprudência
    document.getElementById("btnInsertLink").addEventListener("click", () => {
        const url = prompt("Digite o link da Jurisprudência ou Documento:", "https://");
        if (url) {
            execCmd("createLink", url);
        }
    });

    // Carregar Modelos de Peças Prontas
    document.querySelectorAll(".btn-template").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            const tipo = btn.getAttribute("data-template");

            if (tipo === "peticao") {
                paperEditor.innerHTML = `
                    <h2 style="text-align: center; font-weight: bold;">EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA VARA CÍVEL</h2>
                    <br><p><strong>PROCESSO Nº:</strong> [Número do Processo]</p>
                    <p><strong>AUTOR:</strong> [Nome do Autor]</p>
                    <p><strong>RÉU:</strong> [Nome do Réu]</p><br>
                    <h3 style="text-align: center;">PETIÇÃO INICIAL</h3>
                    <br><p>Vem, respeitosamente, propor a presente AÇÃO...</p>
                `;
            } else if (tipo === "procuracao") {
                paperEditor.innerHTML = `
                    <h2 style="text-align: center; font-weight: bold;">PROCURAÇÃO AD JUDICIA</h2>
                    <br><p><strong>OUTORGANTE:</strong> [Nome do Cliente], [Nacionalidade], [Estado Civil], [Profissão], inscrito no CPF sob nº [CPF], residente e domiciliado em [Endereço].</p>
                    <br><p><strong>OUTORGADO:</strong> Dr. Mário Silva, OAB/SP 123.456...</p>
                    <br><p><strong>PODERES:</strong> Pelo presente instrumento, nomeia o outorgado para representá-lo em juízo...</p>
                `;
            } else if (tipo === "contestacao") {
                paperEditor.innerHTML = `
                    <h2 style="text-align: center; font-weight: bold;">EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO</h2>
                    <br><p><strong>CONTESTAÇÃO</strong> ao processo nº [Número]</p>
                    <br><p><strong>RÉU:</strong> [Nome do Réu], já qualificado nos autos...</p>
                    <br><h3>I. DAS PRELIMINARES</h3>
                    <p>Antes de adentrar ao mérito, cumpre salientar...</p>
                `;
            }
            atualizarMetricas();
        });
    });

    // Métricas do Texto (Palavras e Carateres)
    function atualizarMetricas() {
        const texto = paperEditor.innerText || "";
        const chars = texto.length;
        const words = texto.trim() === "" ? 0 : texto.trim().split(/\s+/).length;

        document.getElementById("wordCount").innerText = `Palavras: ${words}`;
        document.getElementById("charCount").innerText = `Carateres: ${chars}`;
    }

    paperEditor.addEventListener("input", atualizarMetricas);
    atualizarMetricas();

    // Guardar e Exportar
    document.getElementById("btnSalvarMinuta").addEventListener("click", () => {
        mostrarAlerta("Minuta Guardada", "As suas alterações no processo foram salvas com sucesso!");
    });

    document.getElementById("btnExportPDF").addEventListener("click", () => {
        window.print();
    });

    // =========================================
    // 4. KANBAN & OUTRAS FUNCIONALIDADES
    // =========================================
    const btnNovaTarefa = document.getElementById("btnNovaTarefa");
    const btnConfirmarTarefa = document.getElementById("btnConfirmarTarefa");

    if (btnNovaTarefa) {
        btnNovaTarefa.addEventListener("click", () => {
            document.getElementById("inputTituloTarefa").value = "";
            const hoje = new Date();
            document.getElementById("inputPrazoTarefa").value = `${hoje.getDate()}/${hoje.getMonth()+1}/${hoje.getFullYear()}`;
            abrirModal("modalNovaTarefa");
        });
    }

    if (btnConfirmarTarefa) {
        btnConfirmarTarefa.addEventListener("click", () => {
            const titulo = document.getElementById("inputTituloTarefa").value.trim();
            const prazo = document.getElementById("inputPrazoTarefa").value.trim();
            const colIndex = document.getElementById("selectColunaTarefa").value;

            if (!titulo) return;

            const colunas = document.querySelectorAll("#sec-tarefas .column .cards-container");
            const colunaAlvo = colunas[colIndex] || colunas[0];

            const novoCartao = document.createElement("div");
            novoCartao.classList.add("card");
            novoCartao.innerHTML = `
                <div class="card-content">
                    <h3>${escapeHtml(titulo)}</h3>
                    <p>Prazo: ${escapeHtml(prazo)}</p>
                    <span class="status-dot ${colIndex == 2 ? 'dot-green' : 'dot-yellow'}"></span>
                </div>
                <i class="fa-solid fa-chevron-down chevron" title="Mover tarefa"></i>
            `;

            colunaAlvo.prepend(novoCartao);
            fecharModais();
            mostrarAlerta("Sucesso", "Nova tarefa adicionada ao quadro!");
        });
    }

    const kanbanBoard = document.querySelector(".kanban-board");
    if (kanbanBoard) {
        kanbanBoard.addEventListener("click", (event) => {
            if (event.target.classList.contains("chevron")) {
                const cartao = event.target.closest(".card");
                const colunaAtual = cartao.closest(".column");
                const colunas = Array.from(document.querySelectorAll("#sec-tarefas .column"));
                const proximoIndice = (colunas.indexOf(colunaAtual) + 1) % colunas.length;

                colunas[proximoIndice].querySelector(".cards-container").appendChild(cartao);
            }
        });
    }

    // =========================================
    // 5. DADOS DA EMPRESA
    // =========================================
    const btnEditarEmpresa = document.getElementById("btnEditarEmpresa");
    const btnSalvarEmpresa = document.getElementById("btnSalvarEmpresa");
    const fieldEmail = document.getElementById("fieldEmail");
    const fieldTelefone = document.getElementById("fieldTelefone");
    const fieldEndereco = document.getElementById("fieldEndereco");
    const inputEmailEmpresa = document.getElementById("inputEmailEmpresa");
    const inputTelefoneEmpresa = document.getElementById("inputTelefoneEmpresa");
    const inputEnderecoEmpresa = document.getElementById("inputEnderecoEmpresa");

    btnEditarEmpresa?.addEventListener("click", () => {
        inputEmailEmpresa.value = fieldEmail?.textContent.trim() || "";
        inputTelefoneEmpresa.value = fieldTelefone?.textContent.trim() || "";
        inputEnderecoEmpresa.value = fieldEndereco?.innerText.trim() || "";
        abrirModal("modalEditarEmpresa");
    });

    btnSalvarEmpresa?.addEventListener("click", () => {
        const email = inputEmailEmpresa.value.trim();
        const telefone = inputTelefoneEmpresa.value.trim();
        const endereco = inputEnderecoEmpresa.value.trim();

        if (!email || !telefone || !endereco) {
            mostrarAlerta("Dados incompletos", "Preencha e-mail, telefone e endereço antes de salvar.");
            return;
        }

        fieldEmail.textContent = email;
        fieldTelefone.textContent = telefone;
        fieldEndereco.textContent = endereco;

        fecharModais();
        mostrarAlerta("Dados atualizados", "As informações da empresa foram atualizadas com sucesso.");
    });

    // =========================================
    // 6. CENTRAL DE NOTIFICAÇÕES
    // =========================================
    const notificationItems = Array.from(document.querySelectorAll("#notificationsList .notification-item"));
    const notifFilters = document.querySelectorAll(".notif-filter");
    const btnMarcarTodasLidas = document.getElementById("btnMarcarTodasLidas");
    const notifUnreadCount = document.getElementById("notifUnreadCount");
    const badgeNotifCount = document.getElementById("badgeNotifCount");
    const notificationsEmpty = document.getElementById("notificationsEmpty");

    function atualizarContadorNotificacoes() {
        const naoLidas = notificationItems.filter(item => item.classList.contains("unread")).length;
        if (notifUnreadCount) notifUnreadCount.textContent = naoLidas;
        if (badgeNotifCount) {
            badgeNotifCount.textContent = naoLidas;
            badgeNotifCount.style.display = naoLidas > 0 ? "flex" : "none";
        }
    }

    function atualizarEstadoVazio() {
        const visiveis = notificationItems.filter(item => !item.classList.contains("filtered-out"));
        if (notificationsEmpty) notificationsEmpty.hidden = visiveis.length > 0;
    }

    notifFilters.forEach(filterBtn => {
        filterBtn.addEventListener("click", () => {
            const filtro = filterBtn.dataset.filter;
            notifFilters.forEach(btn => btn.classList.remove("active"));
            filterBtn.classList.add("active");

            notificationItems.forEach(item => {
                const deveExibir = filtro === "all" || item.dataset.type === filtro;
                item.classList.toggle("filtered-out", !deveExibir);
            });

            atualizarEstadoVazio();
        });
    });

    document.getElementById("notificationsList")?.addEventListener("click", (event) => {
        const btnLida = event.target.closest(".mark-read");
        if (!btnLida) return;

        const item = btnLida.closest(".notification-item");
        item?.classList.remove("unread");
        item?.querySelector(".notif-unread-dot")?.remove();
        atualizarContadorNotificacoes();
    });

    btnMarcarTodasLidas?.addEventListener("click", () => {
        notificationItems.forEach(item => {
            item.classList.remove("unread");
            item.querySelector(".notif-unread-dot")?.remove();
        });
        atualizarContadorNotificacoes();
    });

    atualizarContadorNotificacoes();
    atualizarEstadoVazio();

    // Modal Sair
    const btnSair = document.getElementById("btnSair");
    if (btnSair) {
        btnSair.addEventListener("click", () => abrirModal("modalSair"));
    }

    document.getElementById("btnConfirmarSair").addEventListener("click", () => {
        fecharModais();
        mostrarAlerta("Sessão Encerrada", "Sessão encerrada com segurança.");
    });

    function escapeHtml(texto) {
        const div = document.createElement("div");
        div.textContent = texto;
        return div.innerHTML;
    }
});