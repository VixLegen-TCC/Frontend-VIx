"""Instala a integração em uma cópia local do Frontend-VIx, com backup e âncoras verificadas."""
from pathlib import Path
from datetime import datetime
import os, re, shutil, sys
BASE=Path(__file__).resolve().parent
ASSETS=BASE/'v7_assets'

def single(s, old, new):
    if s.count(old)!=1: raise ValueError(f'Âncora ausente ou duplicada: {old[:100]}')
    return s.replace(old,new,1)

def between(s,start,end,replacement):
    if s.count(start)!=1 or s.count(end)!=1: raise ValueError(f'Âncoras incompatíveis: {start} / {end}')
    a=s.index(start); b=s.index(end,a+len(start)); return s[:a]+replacement+s[b:]

def plan(root):
    files=['index.html','integration.js','style.css','script.js']
    if any(not (root/n).is_file() for n in files): raise ValueError('Execute na pasta do frontend que contém index.html, integration.js, style.css e script.js.')
    if any((root/n).exists() for n in ['chat-v7.js','chat-v7.css']): raise ValueError('Arquivos V7 já existem. Não reaplique sem conferir o git diff.')
    html=(root/'index.html').read_text(encoding='utf-8-sig'); js=(root/'integration.js').read_text(encoding='utf-8-sig')
    if 'VixChatV7' in js or 'chat-v7.js' in html: raise ValueError('V7 já presente ou instalação parcial.')
    html=between(html,'            <!-- SEÇÃO 5: ASSISTENTE IA -->','            <!-- SEÇÃO 6: PERFIL -->',(ASSETS/'chat-section.html').read_text(encoding='utf-8'))
    html=single(html,'    <script src="integration.js"></script>','    <script src="chat-v7.js"></script>\n    <script src="integration.js"></script>')
    html=single(html,'</head>','    <link rel="stylesheet" href="chat-v7.css">\n</head>')
    js=single(js,'    const validacaoModal = window.VixLegenModalValidation;','    const validacaoModal = window.VixLegenModalValidation;\n    const chatV7 = window.VixChatV7.create({ api, authenticated: () => Boolean(state.token) && !state.localAdmin });')
    js=between(js,'    function resetarChatSessao() {','    function saveSession(data) {','    function resetarChatSessao() {\n        state.aiFiles = [];\n        chatV7.reset();\n    }\n\n')
    # Remove os handlers e a simulação antigos; mantém a função formatFileSize caso outra seção a use.
    js=between(js,'    $("btnAnexarIa")?.addEventListener("click", () => {','    function formatFileSize(bytes) {','')
    js=between(js,'    function enviarMensagemIa() {','    async function loadCategoriasDocumento() {','    function enviarMensagemIa() {\n        return chatV7.send();\n    }\n\n')
    if 'renderIaFiles(' in js: raise ValueError('Há referências adicionais aos anexos; instalação interrompida para revisão.')
    if js.count('addEventListener("click", enviarMensagemIa)')!=1: raise ValueError('Handler de envio inesperado.')
    return {'index.html':html,'integration.js':js,'chat-v7.js':(ASSETS/'chat-v7.js').read_text(encoding='utf-8'),'chat-v7.css':(ASSETS/'chat-v7.css').read_text(encoding='utf-8')}

def install(root):
    result=plan(root)
    backup=root/('backup-v7-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f')); backup.mkdir()
    for name in result:
        if (root/name).exists(): shutil.copy2(root/name,backup/name)
    changed=[]
    try:
        for name,content in result.items():
            temp=root/(name+'.v7.tmp'); temp.write_text(content,encoding='utf-8',newline='\n'); os.replace(temp,root/name);changed.append(name)
    except Exception:
        for name in changed:
            if (backup/name).exists(): shutil.copy2(backup/name,root/name)
            else:(root/name).unlink(missing_ok=True)
        for name in result:(root/(name+'.v7.tmp')).unlink(missing_ok=True)
        raise
    return backup

if __name__=='__main__':
    root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else BASE
    try:
        backup=install(root)
        print('V7 instalada. Backup:',backup)
        print('Recarregue o site com Ctrl+F5. Nenhum arquivo Java ou Python do RAG foi alterado.')
    except (ValueError,OSError) as e:
        print('Instalação não concluída:',e,file=sys.stderr);sys.exit(1)
