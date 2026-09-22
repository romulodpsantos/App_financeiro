// auth.js — Login/cadastro usando o Neon Auth (Better Auth gerenciado pela Neon).
// Carregado como <script type="module"> no index.html. Controla qual tela fica
// visível (login ou app) e só chama window.iniciarFinanceApp() (definida em
// app.js) depois de confirmar uma sessão válida.
//
// URLs públicas do projeto Neon "Controle Financeiro" (não são segredo — não
// incluem usuário/senha do banco, apenas os endpoints do Auth e da Data API).
//
// Em produção (Vercel), passamos por /api/auth e /api/data — dois "rewrites"
// definidos em vercel.json que fazem a Vercel repassar essas chamadas pro
// Neon nos bastidores. Isso é necessário porque o Safari (inclusive todo
// navegador no iPhone, já que todos usam o mesmo motor) bloqueia por padrão
// o cookie de sessão quando ele vem de um domínio diferente do site
// (neon.tech vs. vercel.app) — ao passar pelo mesmo domínio do site, o
// cookie vira "primeira parte" e o Safari não bloqueia mais. Em localhost
// (sem Vercel rodando) usamos as URLs diretas, que funcionam bem no Chrome
// usado pra desenvolvimento.
import { createClient } from 'https://esm.sh/@neondatabase/neon-js@0.7.0-beta';

const USANDO_PROXY_VERCEL = !['localhost', '127.0.0.1'].includes(location.hostname);

const AUTH_URL = USANDO_PROXY_VERCEL
    ? `${location.origin}/api/auth`
    : 'https://ep-cold-salad-acpa0axd.neonauth.sa-east-1.aws.neon.tech/financeiro/auth';
const DATA_API_URL = USANDO_PROXY_VERCEL
    ? `${location.origin}/api/data`
    : 'https://ep-cold-salad-acpa0axd.apirest.sa-east-1.aws.neon.tech/financeiro/rest/v1';

const client = createClient({
    auth: { url: AUTH_URL },
    dataApi: { url: DATA_API_URL }
});

// Exposto para a Fase 2 (camada de dados na nuvem) reaproveitar a mesma sessão.
window.neonClient = client;

function mostrarTelaLogin() {
    const authScreen = document.getElementById('authScreen');
    const app = document.querySelector('.app');
    if (authScreen) authScreen.style.display = 'flex';
    if (app) app.style.display = 'none';
}

function mostrarApp() {
    const authScreen = document.getElementById('authScreen');
    const app = document.querySelector('.app');
    if (authScreen) authScreen.style.display = 'none';
    if (app) app.style.display = '';
    if (!window.app && typeof window.iniciarFinanceApp === 'function') {
        window.iniciarFinanceApp();
    }
}

function mostrarErroAuth(mensagem) {
    const el = document.getElementById('authErro');
    if (!el) return;
    el.textContent = mensagem || '';
    el.style.display = mensagem ? 'block' : 'none';
}

function alternarAbaAuth(aba) {
    const formEntrar = document.getElementById('formEntrar');
    const formCriarConta = document.getElementById('formCriarConta');
    const tabEntrar = document.getElementById('tabEntrar');
    const tabCriarConta = document.getElementById('tabCriarConta');
    if (formEntrar) formEntrar.style.display = aba === 'entrar' ? 'block' : 'none';
    if (formCriarConta) formCriarConta.style.display = aba === 'criar' ? 'block' : 'none';
    if (tabEntrar) tabEntrar.classList.toggle('active', aba === 'entrar');
    if (tabCriarConta) tabCriarConta.classList.toggle('active', aba === 'criar');
    mostrarErroAuth('');
}
window.alternarAbaAuth = alternarAbaAuth;

// Traduz as mensagens mais comuns do Better Auth; para o resto, mostra a
// mensagem original em vez de esconder atrás de um erro genérico.
function traduzirErroAuth(mensagem) {
    const traducoes = {
        'Invalid email or password': 'E-mail ou senha inválidos.',
        'User already exists': 'Já existe uma conta com este e-mail.',
        'Failed to fetch': 'Erro de conexão. Verifique sua internet e tente novamente.'
    };
    return traducoes[mensagem] || mensagem || 'Não foi possível concluir. Tente novamente.';
}

async function tratarEnvioAuth(executar, botao) {
    mostrarErroAuth('');
    const textoOriginal = botao ? botao.textContent : '';
    if (botao) {
        botao.disabled = true;
        botao.textContent = 'Aguarde...';
    }
    try {
        const { error } = await executar();
        if (error) {
            mostrarErroAuth(traduzirErroAuth(error.message));
            return;
        }
        mostrarApp();
    } catch (err) {
        console.error('Erro de autenticação:', err);
        mostrarErroAuth(traduzirErroAuth(err && err.message));
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.textContent = textoOriginal;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const formEntrar = document.getElementById('formEntrar');
    const formCriarConta = document.getElementById('formCriarConta');
    const btnLogout = document.getElementById('btnLogout');

    if (formEntrar) {
        formEntrar.addEventListener('submit', (evento) => {
            evento.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const senha = document.getElementById('loginSenha').value;
            const botao = evento.submitter || formEntrar.querySelector('button[type="submit"]');
            tratarEnvioAuth(() => client.auth.signIn.email({ email, password: senha }), botao);
        });
    }

    if (formCriarConta) {
        formCriarConta.addEventListener('submit', (evento) => {
            evento.preventDefault();
            const nome = document.getElementById('cadastroNome').value.trim();
            const email = document.getElementById('cadastroEmail').value.trim();
            const senha = document.getElementById('cadastroSenha').value;
            if (senha.length < 8) {
                mostrarErroAuth('A senha precisa ter pelo menos 8 caracteres.');
                return;
            }
            const botao = evento.submitter || formCriarConta.querySelector('button[type="submit"]');
            tratarEnvioAuth(() => client.auth.signUp.email({ email, password: senha, name: nome }), botao);
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            btnLogout.disabled = true;
            try {
                await client.auth.signOut();
            } finally {
                window.location.reload();
            }
        });
    }

    client.auth.getSession()
        .then(({ data }) => {
            if (data && data.session) {
                mostrarApp();
            } else {
                mostrarTelaLogin();
            }
        })
        .catch((err) => {
            console.error('Erro ao verificar sessão:', err);
            mostrarTelaLogin();
        });
});
