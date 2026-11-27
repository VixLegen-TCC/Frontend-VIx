/* VixLegen V7: interface do chat, usando exclusivamente a API autenticada do Java. */
(() => {
    'use strict';
    const W = window;
    function create({api, authenticated}) {
        const $ = id => document.getElementById(id);
        const input = $('chatInput'), messages = $('chatMessages');
        const sendButton = $('btnEnviarChat'), list = $('v7Conversations');
        const newButton = $('v7New'), closeButton = $('v7Close'), healthButton = $('v7Health');
        const status = $('v7Status'), heading = $('v7Title');
        if (![input,messages,sendButton,list,newButton,closeButton,healthButton,status,heading].every(Boolean)) {
            throw new Error('V7: interface do chat incompleta. Execute o instalador.');
        }
        let epoch = 0, sequence = 0, active = null, conversations = [], busy = false, request = null;
        const el = (tag, cls, value) => {
            const node = document.createElement(tag);
            if (cls) node.className = cls;
            if (value != null) node.textContent = String(value);
            return node;
        };
        const current = () => conversations.find(c => c.key === active);
        const valid = (e,c) => e === epoch && conversations.includes(c);
        const notify = text => {status.textContent = text;};
        const make = () => {
            const c = {key: ++sequence, id: null, title:'Nova conversa', entries:[], expired:false};
            conversations.unshift(c); active = c.key; return c;
        };
        function formatted(node,text) {
            // Formatação deliberadamente limitada: HTML do usuário e do LLM nunca é interpretado.
            const parts = String(text ?? '').split(/(```[^\n`]*\n[\s\S]*?```)/g);
            for (const part of parts) {
                if (!part) continue;
                if (part.startsWith('```') && part.endsWith('```') && part.includes('\n')) {
                    const pos = part.indexOf('\n'), language = part.slice(3,pos).trim();
                    const pre = el('pre','v7-code');
                    if (language) pre.append(el('span','v7-lang',language));
                    pre.append(el('code','',part.slice(pos+1,-3).replace(/\n$/,''))); node.append(pre);
                } else node.append(el('div','v7-text',part));
            }
        }
        function sourceCards(node, sources) {
            if (!Array.isArray(sources) || !sources.length) return;
            const group = el('section','v7-sources');
            group.append(el('h4','', 'Fontes recuperadas'));
            for (const f of sources) {
                if (!f || typeof f !== 'object') continue;
                const d = el('details','v7-source');
                const label = [`[${f.id ?? '?'}] ${f.arquivo ?? 'Documento'}`, f.diploma || f.norma || f.secao,
                    f.pagina != null ? `p. ${f.pagina}${f.pagina_fim && f.pagina_fim !== f.pagina ? '–'+f.pagina_fim:''}` : '',
                    f.artigo ? `Art. ${f.artigo}`:'',f.paragrafo ? `§ ${f.paragrafo}`:'',f.inciso ? `inciso ${f.inciso}`:'',f.alinea ? `alínea ${f.alinea}`:''].filter(Boolean).join(' · ');
                d.append(el('summary','',label),el('small','',f.citada ? 'Citada na resposta' : 'Recuperada (não necessariamente citada)'),el('div','v7-text',f.trecho ?? 'Trecho não informado'));
                group.append(d);
            }
            node.append(group);
        }
        function bubble(role,text,data) {
            const box = el('div',`chat-msg ${role === 'user'?'user':'ai'}${role==='error'?' v7-error':''}`);
            if (role !== 'user') { const icon=el('i','fa-solid fa-robot'); icon.setAttribute('aria-hidden','true'); box.append(icon); }
            const body = el('div','v7-body'); formatted(body,text);
            if (data) {
                if (data.tipo === 'juridico') body.append(el('small','v7-note','Interpretação automatizada: confira os dispositivos e a atualização da legislação.'));
                if (Array.isArray(data.avisos)) for (const a of data.avisos) body.append(el('div','v7-note',a));
                if (data.validacao && data.tipo==='juridico') body.append(el('small','v7-meta',`Validação textual: ${data.validacao}`));
                sourceCards(body,data.fontes);
                if (data.tempos_s && Number.isFinite(data.tempos_s.total)) body.append(el('small','v7-meta',`Tempo: ${data.tempos_s.total.toFixed(2)} s`));
            }
            box.append(body); return box;
        }
        function render() {
            const c = current();
            heading.textContent = c?.title || 'Nova conversa';
            list.replaceChildren();
            for (const item of conversations) {
                const b = el('button','v7-conversation',item.title+(item.expired?' (expirada)':''));
                b.type='button'; b.disabled=busy; b.setAttribute('aria-pressed',String(item===c));
                b.addEventListener('click',()=>{if(!busy){active=item.key;input.value='';notify(item.expired?'Conversa expirada. Crie outra para continuar.':'');render();}});
                list.append(b);
            }
            messages.replaceChildren();
            if (!c?.entries.length) messages.append(bubble('ai','Olá! Sou a IA VixLegen. Pergunte sobre a base jurídica ou converse comigo. As respostas devem ser conferidas por um profissional.'));
            for (const entry of c?.entries || []) messages.append(bubble(entry.role,entry.text,entry.data));
            if (busy && request?.kind==='send') messages.append(bubble('ai','Processando sua mensagem…'));
            messages.scrollTop=messages.scrollHeight;
            newButton.disabled=busy; closeButton.disabled=busy||!c;
            healthButton.disabled=busy; sendButton.disabled=busy||!!c?.expired; input.disabled=busy||!!c?.expired;
        }
        function reset() {
            epoch++; request?.controller.abort(); request=null; busy=false;
            conversations=[]; active=null; input.value=''; make(); notify(''); render();
        }
        function start(kind) {
            busy=true; request={controller:new AbortController(),kind}; return request.controller.signal;
        }
        function finish(e) { if(e===epoch) {busy=false; request=null;render();} }
        function errorMessage(err) {
            const s=err?.status;
            if(s===401)return 'Sessão de login expirada. Entre novamente.';
            if(s===403)return 'Seu perfil não possui permissão para conversar com a IA.';
            if(s===404||s===410)return 'Conversa não encontrada ou expirada. Crie uma nova conversa.';
            if(s===409||s===429)return 'IA ou conversa ocupada. Aguarde e tente novamente.';
            if(s===400||s===422)return 'Mensagem ou parâmetros inválidos.';
            if(s===503)return 'IA indisponível. Verifique o FastAPI e o Ollama.';
            if(s===504)return 'Tempo limite excedido. A entrega da resposta não foi confirmada.';
            return 'Não foi possível confirmar a resposta do servidor. Não houve reenvio automático.';
        }
        async function send() {
            const text=input.value.trim();
            if(busy||!text)return;
            if(!authenticated()){notify('Entre com uma conta real do VixLegen para usar a IA.');return;}
            if(text.length>4000){notify('A pergunta deve ter até 4.000 caracteres.');return;}
            const c=current()||make(); if(c.expired){notify('Crie uma nova conversa.');return;}
            const e=epoch, signal=start('send');
            if(!c.entries.length)c.title=text.replace(/\s+/g,' ').slice(0,55);
            c.entries.push({role:'user',text}); input.value='';notify('Processando…');render();
            try {
                if(!c.id){
                    const created=await api('/chat/ia/sessoes',{method:'POST',signal});
                    if(!valid(e,c))return;
                    if(typeof created?.conversa_id!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(created.conversa_id)))throw new Error('Contrato de sessão inválido');
                    c.id=created.conversa_id;
                }
                const result=await api(`/chat/ia/sessoes/${encodeURIComponent(c.id)}/mensagens`,{method:'POST',body:JSON.stringify({mensagem:text}),signal});
                if(!valid(e,c))return;
                if(result?.conversa_id!==c.id||typeof result?.resposta!=='string')throw new Error('Contrato de resposta inválido');
                c.entries.push({role:'ai',text:result.resposta,data:result});notify('Resposta recebida.');
            } catch(err){
                if(!valid(e,c))return;
                if((err?.status===404||err?.status===410)&&c.id)c.expired=true;
                const msg=errorMessage(err); c.entries.push({role:'error',text:msg});notify(msg);
            } finally {finish(e);}
        }
        async function close() {
            const c=current();if(busy||!c||!W.confirm('Encerrar esta conversa e remover suas mensagens da tela?'))return;
            if(!authenticated()){reset();return;}
            const e=epoch, signal=start('close');render();
            try {
                if(c.id&&!c.expired){try{await api(`/chat/ia/sessoes/${encodeURIComponent(c.id)}/encerrar`,{method:'POST',signal});}catch(err){if(![404,410].includes(err?.status))throw err;}}
                if(!valid(e,c))return;
                conversations=conversations.filter(x=>x!==c);active=conversations[0]?.key??null;
                if(!current())make();input.value='';notify('Conversa encerrada.');
            } catch(err){if(valid(e,c))notify(errorMessage(err));}finally{finish(e);}
        }
        async function health(){
            if(busy)return;if(!authenticated()){notify('Faça login para verificar a IA.');return;}
            const e=epoch,signal=start('health');notify('Verificando conexão…');render();
            try{const r=await api('/chat/ia/health',{signal});if(e===epoch)notify(r?.status==='ok'&&r?.ollama?.disponivel&&r?.base_juridica_pronta?`IA online · ${r.modelo} · ${r.unidades_indexadas} unidades`:'IA não está totalmente disponível. Verifique os serviços.');}
            catch(err){if(e===epoch)notify(errorMessage(err));}finally{finish(e);}
        }
        newButton.addEventListener('click',()=>{if(busy)return;if(!authenticated()){notify('Faça login para criar conversas.');return;}if(conversations.length>=20){notify('Encerre uma conversa antes de abrir outra (limite de 20 nesta aba).');return;}if(current()&&!current().entries.length&&!current().id)return;make();input.value='';notify('Nova conversa.');render();});
        closeButton.addEventListener('click',close);healthButton.addEventListener('click',health);
        reset();
        return Object.freeze({send,reset});
    }
    W.VixChatV7=Object.freeze({create});
})();
