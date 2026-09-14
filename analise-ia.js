// analise-ia.js — Botão "Pedir análise e sugestões" na aba Relatórios.
// Monta um RESUMO agregado (não a lista crua de transações) e manda pra
// função serverless /api/analise-financeira, que chama a Claude API com a
// chave guardada no servidor (nunca no navegador). Só funciona depois do
// deploy na Vercel com a variável ANTHROPIC_API_KEY configurada — em
// localhost/servidor estático simples, essa rota não existe.

window.construirResumoFinanceiro = function construirResumoFinanceiro(app) {
    const hoje = new Date();

    const mesesConsiderados = 3;
    let somaGanhos = 0;
    for (let i = 0; i < mesesConsiderados; i++) {
        const mesData = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        somaGanhos += app.ganhos
            .filter((g) => {
                const d = app.parseDataLocal(g.data);
                return d.getMonth() === mesData.getMonth() && d.getFullYear() === mesData.getFullYear();
            })
            .reduce((soma, g) => soma + g.valor, 0);
    }
    const rendaMediaMensalEstimada = Math.round((somaGanhos / mesesConsiderados) * 100) / 100;

    const gastosFixosMensais = Math.round(
        app.recorrentes
            .filter((r) => r.tipo === 'fixo' && r.ativo && r.responsavel === 'Eu')
            .reduce((soma, r) => soma + r.valor, 0) * 100
    ) / 100;

    const dividasCartao = app.cartoes.map((cartao) => ({
        cartao: cartao.nome,
        limiteTotal: cartao.limite,
        faturaAtual: app.calcularFaturaAtual(cartao.id),
        faturaProxima: app.calcularFaturaProxima(cartao.id),
        limiteDisponivel: cartao.limite - app.calcularTotalGastoCartao(cartao.id)
    }));

    const dividasParceladas = app.recorrentes
        .filter((r) => r.tipo === 'parcelado' && r.ativo && r.responsavel === 'Eu')
        .map((r) => ({
            descricao: r.descricao,
            valorParcela: r.valor,
            parcelasRestantes: r.parcelas - r.parcelasPagas,
            valorRestanteTotal: Math.round(r.valor * (r.parcelas - r.parcelasPagas) * 100) / 100
        }));

    const aReceberPorPessoa = {};
    app.gastos
        .filter((g) => g.responsavel !== 'Eu' && !g.pago)
        .forEach((g) => { aReceberPorPessoa[g.responsavel] = (aReceberPorPessoa[g.responsavel] || 0) + g.valor; });

    return {
        saldoAtual: Math.round(app.calcularSaldoTotal() * 100) / 100,
        rendaMediaMensalEstimada,
        gastosFixosMensais,
        dividasCartao,
        dividasParceladas,
        valoresAReceberDePessoas: aReceberPorPessoa
    };
};

function formatarMarkdownSimples(texto) {
    return texto
        .split(/\n{2,}/)
        .map((paragrafo) => {
            if (/^##\s+/.test(paragrafo)) {
                return `<h4 style="margin:16px 0 8px; color:#1c1e2e;">${paragrafo.replace(/^##\s+/, '')}</h4>`;
            }
            const comNegrito = paragrafo.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            const comQuebras = comNegrito.replace(/\n/g, '<br>');
            return `<p style="margin-bottom:10px; line-height:1.5; color:#333;">${comQuebras}</p>`;
        })
        .join('');
}

window.pedirAnaliseIA = async function pedirAnaliseIA() {
    const app = window.app;
    const container = document.getElementById('analiseIAResultado');
    const botao = document.getElementById('btnPedirAnaliseIA');
    if (!app || !container || !botao) return;

    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Analisando...';
    container.style.display = 'block';
    container.innerHTML = '<p style="color:#777;">Pedindo pra Claude analisar sua situação financeira...</p>';

    try {
        const resumo = window.construirResumoFinanceiro(app);
        const resposta = await fetch('/api/analise-financeira', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resumo)
        });

        let dados;
        try {
            dados = await resposta.json();
        } catch {
            container.innerHTML = '<p style="color:#e11d48;">Essa função só funciona depois do deploy na Vercel, com a variável ANTHROPIC_API_KEY configurada. Em localhost/servidor estático simples ela não existe.</p>';
            return;
        }

        if (!resposta.ok) {
            container.innerHTML = `<p style="color:#e11d48;">${dados.error || 'Não foi possível gerar a análise.'}</p>`;
            return;
        }

        container.innerHTML = formatarMarkdownSimples(dados.analise || 'Sem resposta.');
    } catch (err) {
        container.innerHTML = `<p style="color:#e11d48;">Erro de conexão: ${err.message}</p>`;
    } finally {
        botao.disabled = false;
        botao.textContent = textoOriginal;
    }
};
