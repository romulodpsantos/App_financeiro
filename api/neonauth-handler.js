// api/neonauth-handler.js — Proxy same-origin para o Neon Auth.
//
// Por que existe: o Safari (e todo navegador no iPhone, que usa o mesmo
// motor) bloqueia o cookie de sessão do Neon Auth por ele vir de um domínio
// diferente do site (neon.tech vs. vercel.app). A primeira tentativa de
// corrigir isso foi um "rewrite" simples e EXTERNO no vercel.json, mas o
// Neon Auth rejeitava com "Invalid hostname header" — porque esse tipo de
// rewrite só repassa a requisição original, mantendo o cabeçalho Host do
// navegador (vercel.app), e o Neon Auth valida esse cabeçalho.
//
// Esta function resolve isso de verdade: faz uma requisição NOVA ao Neon
// (com fetch), então o cabeçalho Host da conexão de saída é automaticamente
// o do próprio Neon. A resposta (incluindo o Set-Cookie) é repassada de
// volta como se tivesse vindo do nosso próprio domínio — por isso o
// navegador passa a tratar o cookie como "primeira parte".
//
// Este arquivo é "achatado" (sem [...path] na pasta) e alcançado via um
// rewrite INTERNO no vercel.json (/api/neonauth/(.*) -> /api/neonauth-
// handler?path=$1). Duas descobertas ao longo do caminho: (1) a Vercel
// trata "/api/auth/*" como caminho reservado do seu próprio recurso de
// autenticação e devolve 404 antes de chegar em qualquer function nossa —
// por isso o nome é "neonauth", não "auth"; (2) o catch-all de arquivo
// ([...path].js) só casa UM segmento de caminho fora de projetos Next.js —
// "sign-up/email" (dois segmentos) dava 404 direto na Vercel, sem nem
// invocar a function. O rewrite com regex e "$1" no vercel.json não tem
// essa limitação.

const BASE_NEON_AUTH = 'https://ep-cold-salad-acpa0axd.neonauth.sa-east-1.aws.neon.tech/financeiro/auth';

module.exports = async function handler(req, res) {
    const resto = typeof req.query.path === 'string' ? req.query.path : '';
    const destino = new URL(`${BASE_NEON_AUTH}/${resto}`);

    for (const [chave, valor] of Object.entries(req.query)) {
        if (chave === 'path') continue;
        for (const v of Array.isArray(valor) ? valor : [valor]) {
            destino.searchParams.append(chave, v);
        }
    }

    const cabecalhosEnvio = {};
    if (req.headers['content-type']) cabecalhosEnvio['content-type'] = req.headers['content-type'];
    if (req.headers['cookie']) cabecalhosEnvio['cookie'] = req.headers['cookie'];
    if (req.headers['authorization']) cabecalhosEnvio['authorization'] = req.headers['authorization'];
    if (req.headers['origin']) cabecalhosEnvio['origin'] = req.headers['origin'];
    cabecalhosEnvio['accept'] = 'application/json';

    const metodo = req.method || 'GET';
    let corpo;
    if (metodo !== 'GET' && metodo !== 'HEAD') {
        corpo = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    }

    try {
        const respostaNeon = await fetch(destino, {
            method: metodo,
            headers: cabecalhosEnvio,
            body: corpo,
            redirect: 'manual'
        });

        const cookiesDefinidos = typeof respostaNeon.headers.getSetCookie === 'function'
            ? respostaNeon.headers.getSetCookie()
            : (respostaNeon.headers.get('set-cookie') ? [respostaNeon.headers.get('set-cookie')] : []);
        if (cookiesDefinidos.length > 0) {
            res.setHeader('set-cookie', cookiesDefinidos);
        }

        const tipoConteudo = respostaNeon.headers.get('content-type');
        if (tipoConteudo) res.setHeader('content-type', tipoConteudo);

        const textoResposta = await respostaNeon.text();
        res.status(respostaNeon.status).send(textoResposta);
    } catch (err) {
        console.error('Erro no proxy de auth:', err);
        res.status(502).json({ error: 'Não foi possível falar com o serviço de autenticação agora.' });
    }
};
