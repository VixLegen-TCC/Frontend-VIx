import importlib.util, tempfile, unittest, pathlib, os, threading, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('installer',ROOT/'instalar-v7.py'); installer=importlib.util.module_from_spec(spec);spec.loader.exec_module(installer)
# Fixture com as âncoras reais conferidas no GitHub; não é o frontend completo.
HTML='''<!doctype html><html><head><meta charset="utf-8"></head><body>
            <!-- SEÇÃO 5: ASSISTENTE IA -->
            <section id="sec-ia">Chat antigo</section>
            <!-- SEÇÃO 6: PERFIL -->
            <section id="sec-perfil">Preservar perfil</section>
    <script src="script.js"></script>
    <script src="integration.js"></script>
</body></html>'''
JS='''document.addEventListener("DOMContentLoaded", () => {
    const state = { token: "test", localAdmin: false, aiFiles: [] };
    const $ = (id) => document.getElementById(id);
    const validacaoModal = window.VixLegenModalValidation;
    async function api(path, options = {}) { return window.mockApi(path,options); }
    function resetarChatSessao() {
        state.aiFiles = [];
        renderIaFiles();
    }
    function saveSession(data) { resetarChatSessao(); state.token=data.token; }
    $("btnAnexarIa")?.addEventListener("click", () => {
        $("aiFileInput")?.click();
    });
    function renderIaFiles() {}
    function formatFileSize(bytes) { return bytes+" B"; }
    $("btnEnviarChat")?.addEventListener("click", enviarMensagemIa);
    $("chatInput")?.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); enviarMensagemIa(); }
    });
    function enviarMensagemIa() {
        console.log("simulacao antiga");
    }
    async function loadCategoriasDocumento() { return 1; }
    window.testReset=()=>{state.token="";resetarChatSessao();};
    window.testLogin=()=>saveSession({token:"new"});
    document.getElementById('sec-ia').style.display='block';
});'''
MOCK='''window.calls=[];window.seq=0;window.fail=null;window.delay=false;window.pending=null;
window.mockApi=async(path,opts)=>{calls.push({path,method:opts.method||'GET',body:opts.body});
if(path.endsWith('/health'))return {status:'ok',ollama:{disponivel:true},base_juridica_pronta:true,modelo:'qwen2.5:7b',unidades_indexadas:3330};
if(path.endsWith('/sessoes'))return {conversa_id:'00000000-0000-4000-8000-'+String(++seq).padStart(12,'0')};
if(path.endsWith('/encerrar'))return null;
if(fail){const s=fail;fail=null;throw Object.assign(new Error('fake'),{status:s});}
const id=path.split('/')[4], msg=JSON.parse(opts.body).mensagem;
const result={conversa_id:id,resposta:'Resposta: '+msg+'\\n```java\\nfor (;;) {}\\n```\\n<img src=x onerror=alert(1)>',tipo:'juridico',fontes:[{id:1,arquivo:'cf.pdf',pagina:14,artigo:'5',inciso:'II',trecho:'ninguém será obrigado',citada:true}],avisos:['Confira o excerto'],validacao:'evidencias_textuais_validas',tempos_s:{total:3}};
if(delay)return new Promise(resolve=>{pending=()=>resolve(result);});return result;
};'''
def fixture(root):
    for n,c in {'index.html':HTML,'integration.js':JS,'style.css':'/* keep */','script.js':''}.items():(root/n).write_text(c,encoding='utf-8')
class InstallerTests(unittest.TestCase):
    def test_patch_and_backup(self):
        with tempfile.TemporaryDirectory() as t:
            p=pathlib.Path(t);fixture(p);b=installer.install(p)
            self.assertEqual((b/'integration.js').read_text(),JS)
            self.assertIn('Preservar perfil',(p/'index.html').read_text());self.assertIn('chatV7.send()',(p/'integration.js').read_text());self.assertNotIn('simulacao antiga',(p/'integration.js').read_text());self.assertEqual((p/'style.css').read_text(),'/* keep */')
            self.assertTrue((p/'chat-v7.js').exists());self.assertTrue((p/'chat-v7.css').exists())
            with self.assertRaises(ValueError):installer.install(p)
    def test_incompatible_no_changes(self):
        with tempfile.TemporaryDirectory() as t:
            p=pathlib.Path(t);fixture(p);(p/'integration.js').write_text('incompatível');before={x.name:x.read_bytes() for x in p.iterdir()}
            with self.assertRaises(ValueError):installer.install(p)
            self.assertEqual(before,{x.name:x.read_bytes() for x in p.iterdir()})
class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();cls.root=pathlib.Path(cls.tmp.name);fixture(cls.root);installer.install(cls.root)
        cls.http=ThreadingHTTPServer(("127.0.0.1",0),functools.partial(SimpleHTTPRequestHandler,directory=str(cls.root))); threading.Thread(target=cls.http.serve_forever,daemon=True).start()
        cls.pw=sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.pw.stop();cls.http.shutdown();cls.http.server_close();cls.tmp.cleanup()
    def setUp(self):
        self.page=self.browser.new_page();self.page.on('dialog',lambda d:d.accept())
        html=(self.root/'index.html').read_text();html=html.replace('<link rel="stylesheet" href="chat-v7.css">','<style>'+ (self.root/'chat-v7.css').read_text()+'</style>')
        html=html.replace('<script src="script.js"></script>','<script>'+MOCK+'</script>')
        for name in ['chat-v7.js','integration.js']:html=html.replace(f'<script src="{name}"></script>','<script>'+(self.root/name).read_text()+'</script>')
        self.page.set_content(html);self.page.wait_for_selector('#chatInput')
    def tearDown(self): self.page.close()
    def send(self,text):
        self.page.fill('#chatInput',text);self.page.click('#btnEnviarChat');self.page.wait_for_function("!document.querySelector('#btnEnviarChat').disabled || document.querySelector('#v7Status').textContent.includes('expirada')")
    def test_health(self):
        self.page.click('#v7Health');self.page.wait_for_function("document.querySelector('#v7Status').textContent.includes('3330')")
    def test_memory_and_sources(self):
        self.send('Artigo 5º');self.send('E o inciso II?');calls=self.page.evaluate('calls');self.assertEqual(len(calls),3);self.assertEqual(calls[1]['path'],calls[2]['path']);self.assertIn('inciso II',self.page.locator('#chatMessages').inner_text());self.page.locator('summary').first.click();self.assertIn('ninguém será obrigado',self.page.locator('details[open]').inner_text());self.assertEqual(self.page.locator('#chatMessages img').count(),0);self.assertEqual(self.page.locator('#chatMessages pre code').count(),2)
    def test_independent_and_close(self):
        self.send('Constituição');self.page.click('#v7New');self.send('Java');calls=self.page.evaluate('calls');self.assertNotEqual(calls[1]['path'],calls[3]['path']);self.page.locator('.v7-conversation').last.click();self.assertIn('Constituição',self.page.locator('#chatMessages').inner_text());self.assertNotIn('Resposta: Java',self.page.locator('#chatMessages').inner_text());self.page.click('#v7Close');self.page.wait_for_function("document.querySelector('#v7Status').textContent.includes('encerrada')");self.assertEqual(self.page.locator('.v7-conversation').count(),1)
    def test_expired(self):
        self.send('Teste');self.page.evaluate('fail=410');self.send('continua');self.assertTrue(self.page.locator('#btnEnviarChat').is_disabled());self.page.click('#v7New');self.assertTrue(self.page.locator('#btnEnviarChat').is_enabled())
    def test_busy(self):
        self.page.evaluate('delay=true');self.page.fill('#chatInput','Aguarde');self.page.click('#btnEnviarChat');self.page.wait_for_function('pending!==null');self.assertTrue(self.page.locator('#v7New').is_disabled());self.assertTrue(self.page.locator('#btnEnviarChat').is_disabled());self.page.evaluate('pending()');self.page.wait_for_function("!document.querySelector('#btnEnviarChat').disabled")
    def test_logout_late(self):
        self.page.evaluate('delay=true');self.page.fill('#chatInput','sigiloso');self.page.click('#btnEnviarChat');self.page.wait_for_function('pending!==null');self.page.evaluate('testReset();testLogin();pending()');self.page.wait_for_timeout(120);self.assertNotIn('sigiloso',self.page.locator('#chatMessages').inner_text());self.assertEqual(self.page.locator('.v7-conversation').count(),1)
    def test_forbidden_and_no_auth(self):
        self.page.evaluate('fail=403');self.send('teste');self.assertIn('não possui permissão',self.page.locator('#v7Status').inner_text());self.page.evaluate('testReset()');self.page.fill('#chatInput','teste');before=self.page.evaluate('calls.length');self.page.click('#btnEnviarChat');self.assertEqual(before,self.page.evaluate('calls.length'))
if __name__=='__main__':unittest.main(verbosity=2)
