from pathlib import Path
from datetime import datetime
import shutil
root=Path(__file__).resolve().parent
p=root/'integration.js'
if not p.is_file() or not (root/'index.html').is_file():
    raise SystemExit('Execute na pasta do frontend que contém index.html e integration.js.')
s=p.read_bytes().decode('utf-8-sig')
newline='\r\n' if '\r\n' in s else '\n'
anchor='        const type = response.headers.get("content-type") || "";'
marker='// V7.4: resposta SSE não deve ser lida como JSON inteiro.'
if marker in s:
    print('Integração SSE já instalada.'); raise SystemExit(0)
if s.count(anchor)!=1 or 'const tokenDaRequisicao = state.token;' not in s or 'window.VixChatV7.create' not in s:
    raise SystemExit('integration.js incompatível com V7.3: nenhum arquivo alterado.')
patch="""        // V7.4: resposta SSE não deve ser lida como JSON inteiro.
        if (options.v74Stream === true && response.ok) {
            if (tokenDaRequisicao !== state.token) {
                await response.body?.cancel();
                const erro = new Error("Sessão alterada durante a requisição");
                erro.status = 401;
                throw erro;
            }
            if (!type.includes("text/event-stream")) {
                await response.body?.cancel();
                throw new Error("Formato de streaming inesperado");
            }
            return response;
        }""".replace('\n',newline)
backup=root/('integration.js.v74-backup-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
shutil.copy2(p,backup)
# Preserve UTF-8 BOM if one existed.
encoding='utf-8-sig' if p.read_bytes().startswith(b'\xef\xbb\xbf') else 'utf-8'
tmp=p.with_suffix('.js.v74-tmp');tmp.write_bytes(s.replace(anchor,anchor+newline+patch).encode(encoding));tmp.replace(p)
print('Streaming instalado; backup:',backup.name)
