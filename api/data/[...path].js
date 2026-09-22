// api/data/[...path].js — Proxy same-origin para a Neon Data API.
// Mesma razão do api/auth/[...path].js (ver comentário lá): precisa ser uma
// requisição nova de verdade (fetch), não um "rewrite" simples, senão o
// Neon rejeita pelo cabeçalho Host vir do domínio da Vercel.

const BASE_NEON_DATA_API = 'https://ep-cold-salad-acpa0axd.apirest.sa-east-1.aws.neon.tech/financeiro/rest/v1';

module.exports = async function handler(req, res) {
    // A Vercel usa literalmente "...path" (com reticências) como chave da
    // query para o segmento catch-all de api/data/[...path].js — não "path"
    // simples. Ver comentário equivalente em api/neonauth/[...path].js.
    const valorPath = req.query['...path'];
    const partesCaminho = Array.isArray(valorPath) ? valorPath : (valorPath ? [valorPath] : []);
    const destino = new URL(`${BASE_NEON_DATA_API}/${partesCaminho.join('/')}`);

    for (const [chave, valor] of Object.entries(req.query)) {
        if (chave === '...path') continue;
        for (const v of Array.isArray(valor) ? valor : [valor]) {
            destino.searchParams.append(chave, v);
        }
    }

    const cabecalhosEnvio = {};
    if (req.headers['content-type']) cabecalhosEnvio['content-type'] = req.headers['content-type'];
    if (req.headers['cookie']) cabecalhosEnvio['cookie'] = req.headers['cookie'];
    if (req.headers['authorization']) cabecalhosEnvio['authorization'] = req.headers['authorization'];
    if (req.headers['prefer']) cabecalhosEnvio['prefer'] = req.headers['prefer'];
    if (req.headers['range']) cabecalhosEnvio['range'] = req.headers['range'];
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

        const tipoConteudo = respostaNeon.headers.get('content-type');
        if (tipoConteudo) res.setHeader('content-type', tipoConteudo);
        const contentRange = respostaNeon.headers.get('content-range');
        if (contentRange) res.setHeader('content-range', contentRange);

        const textoResposta = await respostaNeon.text();
        res.status(respostaNeon.status).send(textoResposta);
    } catch (err) {
        console.error('Erro no proxy da Data API:', err);
        res.status(502).json({ error: 'Não foi possível falar com o banco de dados agora.' });
    }
};
