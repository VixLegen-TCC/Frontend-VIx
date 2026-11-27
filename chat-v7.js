/* VixLegen V7.4: SSE real com histórico, anexo e processo privado. */
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
        let epoch = 0, sequence = 0, active = null, conversations = [], busy = false, request = null, listReady = false;
        const el = (tag, cls, value) => {
            const node = document.createElement(tag);
            if (cls) node.className = cls;
            if (value != null) node.textContent = String(value);
            return node;
        };
        const reloadButton=el('button','', 'Recarregar histórico');reloadButton.type='button';reloadButton.id='v71Reload';
        const renameButton=el('button','', 'Renomear conversa');renameButton.type='button';renameButton.id='v71Rename';
        closeButton.before(reloadButton,renameButton);
        closeButton.textContent='Excluir conversa';
        const privacy=document.querySelector('#sec-ia .v7-privacy');
        if(privacy) privacy.textContent='Histórico e texto extraído vinculados à sua conversa no MySQL. Não envie dados sigilosos até validar segurança e retenção. Análise por trechos, não substitui revisão profissional.';
        const attachmentPanel=el('div','v72-attachment');
        const attachmentLabel=el('div','v7-note','Nenhum anexo ativo.');
        const attachmentButton=el('button','','Anexar documento');attachmentButton.type='button';attachmentButton.id='v72Attach';
        const removeButton=el('button','','Remover anexo');removeButton.type='button';removeButton.id='v72Remove';
        const fileInput=el('input');fileInput.type='file';fileInput.accept='.pdf,.docx,.txt';fileInput.hidden=true;
        attachmentPanel.append(el('strong','','Documento da conversa'),attachmentLabel,attachmentButton,removeButton,fileInput,el('small','v7-note','PDF pesquisável, DOCX ou TXT · até 5 MB · um por conversa.'));
        const anchor=privacy||list;anchor.after(attachmentPanel);
        const processPanel=el('div','v73-process');
        const processLabel=el('div','v7-note','Nenhum processo vinculado.');
        const processButton=el('button','','Carregar processos');processButton.type='button';processButton.id='v73Load';
        const processSelect=el('select','v73-select');processSelect.id='v73Select';processSelect.setAttribute('aria-label','Processo jurídico');
        processSelect.append(el('option','','Selecione um processo'));processSelect.options[0].value='';
        const bindButton=el('button','','Vincular processo');bindButton.type='button';bindButton.id='v73Bind';
        processPanel.append(el('strong','','Processo da conversa'),processLabel,processButton,processSelect,bindButton,el('small','v7-note','Use uma conversa nova e sem anexo. Dados cadastrados, não andamento oficial. Processos em segredo de justiça indisponíveis.'));
        attachmentPanel.after(processPanel);
        const current = () => conversations.find(c => c.key === active);
        const valid = (e,c) => e === epoch && conversations.includes(c);
        const notify = text => {status.textContent = text;};
        const make = () => {
            const c = {key: ++sequence, id: null, title:'Nova conversa', entries:[], expired:false, attachment:null, process:null};
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
                if(data.tipo==='processo') body.append(el('small','v7-note',`Processo ${data.processo_numero||''} · registros do MySQL · consulta: ${data.processo_consultado_em||'não informada'}`));
                if(data.tipo==='documento') body.append(el('small','v7-note',`Análise privada: ${data.anexo_arquivo||'documento'} · evidências textuais, não parecer jurídico.`));
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
            attachmentLabel.textContent=c?.attachment ? `${c.attachment.arquivo} · ${c.attachment.trechos} trechos. As perguntas serão respondidas usando este documento.`:'Nenhum anexo ativo. Perguntas usam o modo normal.';
            attachmentButton.disabled=busy||!listReady||!!c?.expired||!!c?.attachment||!!c?.process;
            removeButton.disabled=busy||!listReady||!c?.attachment||!!c?.expired;
            processLabel.textContent=c?.process ? `Processo ${c.process.numero} · perguntas consultam os registros atuais.`:'Nenhum processo vinculado.';
            const canBind=!!c&&!c.process&&!c.attachment&&!c.entries.length&&!c.expired&&listReady&&!busy;
            processButton.disabled=!canBind;processSelect.disabled=!canBind;bindButton.disabled=!canBind||!processSelect.value;
            input.maxLength=c?.attachment||c?.process?1800:4000;
            input.placeholder=c?.process?'Pergunte sobre o processo cadastrado…':c?.attachment?'Pergunte sobre o documento anexado…':'Pergunte sobre a base jurídica…';
            list.replaceChildren();
            for (const item of conversations) {
                const b = el('button','v7-conversation',item.title+(item.expired?' (expirada)':''));
                b.type='button'; b.disabled=busy; b.setAttribute('aria-pressed',String(item===c));
                b.addEventListener('click',()=>select(item));
                list.append(b);
            }
            messages.replaceChildren();
            if (!c?.entries.length) messages.append(bubble('ai','Olá! Sou a IA VixLegen. Pergunte sobre a base jurídica ou converse comigo. As respostas devem ser conferidas por um profissional.'));
            for (const entry of c?.entries || []) messages.append(bubble(entry.role,entry.text,entry.data));
            if (busy && request?.kind==='send') { const live=bubble('ai',request.preview||'Processando sua mensagem…'); live.id='v74Live'; messages.append(live); }
            messages.scrollTop=messages.scrollHeight;
            newButton.disabled=busy||!listReady; closeButton.disabled=busy||!c||!listReady;
            renameButton.disabled=busy||!c?.id||!listReady; reloadButton.disabled=busy;
            healthButton.disabled=busy; sendButton.disabled=busy||!listReady||!!c?.expired; input.disabled=busy||!listReady||!!c?.expired;
        }
        function reset() {
            epoch++; request?.controller.abort(); request=null; busy=false;
            conversations=[]; active=null; listReady=false; input.value=''; processSelect.replaceChildren(el('option','','Selecione um processo'));processSelect.options[0].value=''; make(); notify('Abra a seção IA ou clique em Recarregar histórico.'); render();
        }
        function start(kind) {
            busy=true; request={controller:new AbortController(),kind}; return request.controller.signal;
        }
        function finish(e) { if(e===epoch) {busy=false; request=null;render();} }
        function errorMessage(err) {
            const s=err?.status;
            if(s===401)return 'Sessão de login expirada. Entre novamente.';
            if(s===403)return 'Seu perfil não possui permissão para conversar com a IA.';
            if(s===404||s===410)return 'Conversa não encontrada. Recarregue o histórico.';
            if(s===409||s===429)return err?.message && err.message !== 'fake' ? err.message : 'IA ou conversa ocupada. Aguarde e tente novamente.';
            if(s===400||s===422)return 'Mensagem ou parâmetros inválidos.';
            if(s===503)return 'IA indisponível. Verifique o FastAPI e o Ollama.';
            if(s===504)return 'Tempo limite excedido. A entrega da resposta não foi confirmada.';
            return 'Não foi possível confirmar a resposta do servidor. Não houve reenvio automático.';
        }
        const uuid = v => typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
        async function read(c,e,signal){
            if(!c.id)return;
            const r=await api(`/chat/ia/sessoes/${encodeURIComponent(c.id)}`,{signal});
            if(!valid(e,c))return;
            if(r?.conversa_id!==c.id||!Array.isArray(r.turnos))throw new Error('Histórico inválido');
            const entries=[];
            for(const t of r.turnos){
                if(typeof t?.pergunta!=='string'||typeof t?.resultado?.resposta!=='string')throw new Error('Turno inválido');
                entries.push({role:'user',text:t.pergunta},{role:'ai',text:t.resultado.resposta,data:t.resultado});
            }
            c.entries=entries;c.title=r.titulo||'Nova conversa';c.expired=false;c.attachment=r.anexo||null;c.process=r.processo||null;
        }
        async function loadList(){
            if(busy)return;
            if(!authenticated()){notify('Faça login para acessar suas conversas.');return;}
            const e=epoch, signal=start('load');listReady=false;notify('Carregando histórico…');render();
            const selected=current()?.id;
            try{
                const rows=await api('/chat/ia/sessoes',{signal});
                if(e!==epoch)return;
                if(!Array.isArray(rows)||rows.some(r=>!uuid(r?.conversa_id)))throw new Error('Lista inválida');
                conversations=rows.map(r=>({key:++sequence,id:r.conversa_id,title:r.titulo||'Nova conversa',entries:[],expired:false,attachment:null,process:null}));
                active=conversations.find(c=>c.id===selected)?.key??conversations[0]?.key??null;
                if(!current())make();
                await read(current(),e,signal);
                if(e!==epoch)return;
                listReady=true;notify('Histórico carregado.');
            }catch(err){if(e===epoch)notify(errorMessage(err)+' Clique em Recarregar histórico.');}
            finally{finish(e);}
        }
        async function select(c){
            if(busy||!listReady)return;
            active=c.key;input.value='';notify('');
            if(!c.id){render();return;}
            const e=epoch,signal=start('load');render();
            try{await read(c,e,signal);if(valid(e,c))notify('Conversa carregada.');}
            catch(err){if(valid(e,c)){c.expired=true;c.entries=[];c.attachment=null;c.process=null;notify(errorMessage(err));}}
            finally{finish(e);}
        }
        async function rename(){
            const c=current();if(busy||!c?.id||!listReady)return;
            const title=W.prompt('Novo título da conversa:',c.title)?.trim();
            if(!title)return;if(title.length>120){notify('Título de até 120 caracteres.');return;}
            const e=epoch,signal=start('rename');render();
            try{const r=await api(`/chat/ia/sessoes/${encodeURIComponent(c.id)}/titulo`,{method:'POST',body:JSON.stringify({titulo:title}),signal});if(valid(e,c)){c.title=r?.titulo||title;notify('Conversa renomeada.');}}
            catch(err){if(valid(e,c))notify(errorMessage(err));}finally{finish(e);}
        }
        async function consumeStream(response, signal, onEvent) {
            if (!response?.body || !response.headers?.get('content-type')?.includes('text/event-stream')) throw new Error('Formato de streaming inválido. Confira a instalação V7.4.');
            const reader=response.body.getReader(), decoder=new TextDecoder('utf-8',{fatal:true});
            let buffer='',event='',data=[],size=0,result=null;
            try {
                while(true){
                    if(signal.aborted)throw new DOMException('Cancelado','AbortError');
                    const chunk=await reader.read();
                    if(chunk.done)break;
                    buffer+=decoder.decode(chunk.value,{stream:true});
                    if(buffer.length>2_000_000)throw new Error('Evento acima do limite');
                    let n;
                    while((n=buffer.indexOf('\n'))>=0){
                        let line=buffer.slice(0,n);buffer=buffer.slice(n+1);if(line.endsWith('\r'))line=line.slice(0,-1);
                        if(line===''){
                            if(event&&data.length){
                                const obj=JSON.parse(data.join('\n'));
                                if(event==='resultado'){result=obj;return result;}
                                if(event==='erro')throw Object.assign(new Error('Resposta não confirmada.'),{status:Number(obj.status)||503});
                                onEvent(event,obj);
                            }
                            event='';data=[];size=0;
                        }else if(line.startsWith('event:'))event=line.slice(6).trim();
                        else if(line.startsWith('data:')){const v=line.slice(5).replace(/^ /,'');size+=v.length;if(size>2_000_000)throw new Error('Evento acima do limite');data.push(v);}
                    }
                }
                throw new Error('Stream encerrado sem resultado confirmado.');
            }finally{try{await reader.cancel();}catch(_){}reader.releaseLock();}
        }
        function showDelta(piece,e,c){
            if(!valid(e,c)||!request||typeof piece!=='string'||!piece)return;
            const preview=(request.preview||'')+piece;
            if(preview.length>120000)throw new Error('Resposta acima do limite');
            request.preview=preview;
            const live=$('v74Live');
            if(live){const body=live.querySelector('.v7-body');body.replaceChildren(el('div','v7-text',preview));messages.scrollTop=messages.scrollHeight;}
            notify('Recebendo resposta…');
        }
        async function send() {
            const text=input.value.trim();
            if(busy||!text||!listReady)return;
            if(!authenticated()){notify('Entre com uma conta real do VixLegen para usar a IA.');return;}
            if(text.length>((current()?.attachment||current()?.process)?1800:4000)){notify('Pergunta acima do limite permitido.');return;}
            const c=current()||make(); if(c.expired){notify('Crie uma nova conversa.');return;}
            const e=epoch, signal=start('send');
            if(!c.entries.length&&c.title==='Nova conversa')c.title=text.replace(/\s+/g,' ').slice(0,55);
            c.entries.push({role:'user',text}); input.value='';notify('Processando…');render();
            try {
                if(!c.id){
                    const created=await api('/chat/ia/sessoes',{method:'POST',signal});
                    if(!valid(e,c))return;
                    if(typeof created?.conversa_id!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(created.conversa_id)))throw new Error('Contrato de sessão inválido');
                    c.id=created.conversa_id;
                }
                const response=await api(`/chat/ia/sessoes/${encodeURIComponent(c.id)}/mensagens/stream`,{method:'POST',body:JSON.stringify({mensagem:text}),headers:{Accept:'text/event-stream, application/json'},signal,v74Stream:true});
                if(!valid(e,c)){await response?.body?.cancel();return;}
                const result=await consumeStream(response,signal,(event,obj)=>{
                    if(!valid(e,c))throw new DOMException('Sessão alterada','AbortError');
                    if(event==='inicio'&&obj.conversa_id!==c.id)throw new Error('Sessão de stream inválida');
                    if(event==='delta')showDelta(obj.texto,e,c);
                    if(event==='progresso')notify('Analisando e validando as fontes…');
                });
                if(!valid(e,c))return;
                if(result?.conversa_id!==c.id||typeof result?.resposta!=='string')throw new Error('Contrato de resposta inválido');
                c.entries.push({role:'ai',text:result.resposta,data:result});notify('Resposta salva no histórico.');
            } catch(err){
                if(!valid(e,c))return;
                if((err?.status===404||err?.status===410)&&c.id){c.expired=true;c.entries=[];c.attachment=null;c.process=null;}
                const msg=errorMessage(err); c.entries.push({role:'error',text:msg});notify(msg+' Recarregue o histórico antes de reenviar se a entrega for incerta.');
            } finally {finish(e);}
        }
        async function close() {
            const c=current();if(busy||!c||!W.confirm('Excluir definitivamente esta conversa, seu anexo e suas mensagens do histórico?'))return;
            if(!authenticated()){reset();return;}
            const e=epoch, signal=start('close');render();
            try {
                if(c.id){try{await api(`/chat/ia/sessoes/${encodeURIComponent(c.id)}/encerrar`,{method:'POST',signal});}catch(err){if(![404,410].includes(err?.status))throw err;}}
                if(!valid(e,c))return;
                conversations=conversations.filter(x=>x!==c);active=conversations[0]?.key??null;
                if(!current())make();input.value='';await read(current(),e,signal);if(e===epoch)notify('Conversa excluída.');
            } catch(err){if(valid(e,c))notify(errorMessage(err));}finally{finish(e);}
        }
        async function health(){
            if(busy)return;if(!authenticated()){notify('Faça login para verificar a IA.');return;}
            const e=epoch,signal=start('health');notify('Verificando conexão…');render();
            try{const r=await api('/chat/ia/health',{signal});if(e===epoch)notify(r?.status==='ok'&&r?.ollama?.disponivel&&r?.base_juridica_pronta?`IA online · ${r.modelo} · ${r.unidades_indexadas} unidades`:'IA não está totalmente disponível. Verifique os serviços.');}
            catch(err){if(e===epoch)notify(errorMessage(err));}finally{finish(e);}
        }
        function asBase64(file){return new Promise((resolve,reject)=>{
            const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Arquivo ilegível'));reader.readAsDataURL(file);
        });}
        async function attach(file){
            const c=current();if(!file||busy||!listReady||!authenticated()||!c||c.attachment||c.process||c.expired)return;
            if(!/\.(pdf|docx|txt)$/i.test(file.name)||file.name.length>240||file.size<1||file.size>5*1024*1024){notify('Use PDF pesquisável, DOCX ou TXT de até 5 MB.');return;}
            const e=epoch,signal=start('attach');notify('Extraindo texto do documento…');render();
            try{
                const encoded=await asBase64(file);if(!valid(e,c))return;
                if(!c.id){const r=await api('/chat/ia/sessoes',{method:'POST',signal});if(!valid(e,c))return;if(!uuid(r?.conversa_id))throw new Error('Sessão inválida');c.id=r.conversa_id;}
                const doc=await api(`/chat/ia/sessoes/${encodeURIComponent(c.id)}/anexo`,{method:'POST',body:JSON.stringify({arquivo:file.name,conteudo_base64:encoded}),signal});
                if(!valid(e,c))return;if(!uuid(doc?.id)||typeof doc.arquivo!=='string')throw new Error('Anexo inválido');c.attachment=doc;notify('Documento anexado. Faça uma pergunta sobre ele.');
            }catch(err){if(valid(e,c))notify([400,413,415,422].includes(err?.status)?'Arquivo inválido, sem texto extraível, protegido ou acima dos limites.':errorMessage(err)+' Recarregue o histórico se a entrega for incerta.');}
            finally{finish(e);}
        }
        async function detach(){
            const c=current();if(busy||!c?.attachment||!authenticated()||!W.confirm('Remover o texto do anexo ativo? As respostas e fontes antigas permanecem no histórico. Exclua a conversa para remover tudo.'))return;
            const e=epoch,signal=start('detach');render();
            try{await api(`/chat/ia/sessoes/${encodeURIComponent(c.id)}/anexo/remover`,{method:'POST',signal});if(valid(e,c)){c.attachment=null;notify('Anexo removido. O chat voltou ao modo normal.');}}
            catch(err){if(valid(e,c))notify(errorMessage(err));}finally{finish(e);}
        }
        async function loadProcesses(){
            const c=current();if(busy||!listReady||!authenticated()||!c||c.process||c.attachment||c.entries.length||c.expired)return;
            const e=epoch,signal=start('process-list');render();notify('Carregando processos autorizados…');
            try{
                const rows=await api('/chat/ia/processos',{signal});if(!valid(e,c))return;
                if(!Array.isArray(rows)||rows.some(x=>typeof x.numero!=='string'||!(/^[1-9][0-9]{0,18}$/).test(x.processo_id)))throw new Error('Lista de processos inválida');
                const first=el('option','','Selecione um processo');first.value='';processSelect.replaceChildren(first);
                for(const x of rows){const o=el('option','',x.numero);o.value=x.processo_id;processSelect.append(o);}
                notify(rows.length?`${rows.length} processo(s) disponível(is), até 200.`:'Nenhum processo disponível para a IA.');
            }catch(err){if(valid(e,c))notify(errorMessage(err));}finally{finish(e);}
        }
        async function bindProcess(){
            const c=current(),pid=processSelect.value;
            if(busy||!listReady||!authenticated()||!c||c.process||c.attachment||c.entries.length||c.expired||!pid)return;
            const e=epoch,signal=start('process-bind');render();notify('Vinculando processo…');
            try{
                if(!c.id){const r=await api('/chat/ia/sessoes',{method:'POST',signal});if(!valid(e,c))return;if(!uuid(r?.conversa_id))throw new Error('Sessão inválida');c.id=r.conversa_id;}
                const r=await api(`/chat/ia/sessoes/${encodeURIComponent(c.id)}/processo`,{method:'POST',body:JSON.stringify({processo_id:pid}),signal});
                if(!valid(e,c))return;if(r?.processo_id!==pid||typeof r.numero!=='string')throw new Error('Processo inválido');
                c.process=r;notify('Processo vinculado. Pergunte sobre os registros cadastrados.');
            }catch(err){if(valid(e,c))notify(errorMessage(err)+' Recarregue o histórico se a entrega for incerta.');}finally{finish(e);}
        }
        processButton.addEventListener('click',loadProcesses);
        processSelect.addEventListener('change',()=>{bindButton.disabled=busy||!processSelect.value||!!current()?.process;});
        bindButton.addEventListener('click',bindProcess);
        attachmentButton.addEventListener('click',()=>fileInput.click());
        fileInput.addEventListener('change',()=>{const f=fileInput.files?.[0];fileInput.value='';attach(f);});
        removeButton.addEventListener('click',detach);
        newButton.addEventListener('click',()=>{if(busy)return;if(!authenticated()){notify('Faça login para criar conversas.');return;}if(!listReady)return;if(conversations.filter(c=>c.id).length>=100){notify('Limite de 100 conversas. Exclua uma conversa.');return;}if(current()&&!current().entries.length&&!current().id)return;make();input.value='';notify('Nova conversa.');render();});
        closeButton.addEventListener('click',close);healthButton.addEventListener('click',health);
        reloadButton.addEventListener('click',loadList);renameButton.addEventListener('click',rename);
        document.addEventListener('click',e=>{
            if(e.target.closest?.('[data-target="sec-ia"], [data-go-section="sec-ia"]')&&!listReady&&!busy&&authenticated())loadList();
        });
        reset();
        return Object.freeze({send,reset});
    }
    W.VixChatV7=Object.freeze({create});
})();
