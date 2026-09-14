// migracao.js — Leva os dados que já existem no localStorage deste
// navegador (da versão 100% local do app) para a nuvem, na primeira vez que
// o usuário loga e a conta ainda não tem nada salvo. Não apaga o
// localStorage — ele fica como backup local.

const CHAVES_LOCAIS = ['gastos', 'ganhos', 'pessoas', 'recorrentes', 'cartoes', 'comprasCartao'];

function lerChaveLocal(chave) {
    try {
        const dados = JSON.parse(localStorage.getItem(`finance_${chave}`));
        return Array.isArray(dados) ? dados : [];
    } catch {
        return [];
    }
}

window.MigracaoLocalStorage = {
    temDadosLocais() {
        return CHAVES_LOCAIS.some((chave) => lerChaveLocal(chave).length > 0);
    },

    lerDadosLocais() {
        const dados = {};
        CHAVES_LOCAIS.forEach((chave) => { dados[chave] = lerChaveLocal(chave); });
        return dados;
    },

    contarRegistros(dadosLocais) {
        return CHAVES_LOCAIS.reduce((soma, chave) => soma + dadosLocais[chave].length, 0);
    },

    async importar(datastore, dadosLocais, onProgresso) {
        const mapaIdCartao = new Map();
        const mapaIdRecorrente = new Map();
        const mapaIdCompraCartao = new Map();
        const relatorio = { pessoas: 0, cartoes: 0, recorrentes: 0, comprasCartao: 0, gastos: 0, ganhos: 0 };

        const nomes = new Set(dadosLocais.pessoas || []);
        (dadosLocais.gastos || []).forEach((g) => { if (g.responsavel && g.responsavel !== 'Eu') nomes.add(g.responsavel); });
        (dadosLocais.recorrentes || []).forEach((r) => { if (r.responsavel && r.responsavel !== 'Eu') nomes.add(r.responsavel); });
        (dadosLocais.ganhos || []).forEach((g) => { if (g.pessoaOrigem) nomes.add(g.pessoaOrigem); });
        for (const nome of nomes) {
            try {
                await datastore.pessoaCriar(nome);
                relatorio.pessoas++;
            } catch (err) {
                console.warn('Pessoa não importada (provável duplicata):', nome, err.message);
            }
        }
        onProgresso && onProgresso('pessoas', relatorio.pessoas, nomes.size);

        for (const cartao of dadosLocais.cartoes || []) {
            const novo = await datastore.criar('cartoes', cartao);
            mapaIdCartao.set(cartao.id, novo.id);
            relatorio.cartoes++;
        }
        onProgresso && onProgresso('cartoes', relatorio.cartoes, (dadosLocais.cartoes || []).length);

        for (const recorrente of dadosLocais.recorrentes || []) {
            const novo = await datastore.criar('recorrentes', recorrente);
            mapaIdRecorrente.set(recorrente.id, novo.id);
            relatorio.recorrentes++;
        }
        onProgresso && onProgresso('recorrentes', relatorio.recorrentes, (dadosLocais.recorrentes || []).length);

        for (const compra of dadosLocais.comprasCartao || []) {
            const traduzida = { ...compra, cartaoId: mapaIdCartao.get(compra.cartaoId) ?? compra.cartaoId };
            const nova = await datastore.criar('comprasCartao', traduzida);
            mapaIdCompraCartao.set(compra.id, nova.id);
            relatorio.comprasCartao++;
        }
        onProgresso && onProgresso('comprasCartao', relatorio.comprasCartao, (dadosLocais.comprasCartao || []).length);

        for (const gasto of dadosLocais.gastos || []) {
            const traduzido = {
                ...gasto,
                recorrenteId: gasto.recorrenteId ? (mapaIdRecorrente.get(gasto.recorrenteId) ?? null) : null,
                cartaoId: gasto.cartaoId ? (mapaIdCartao.get(gasto.cartaoId) ?? null) : null,
                compraCartaoId: gasto.compraCartaoId ? (mapaIdCompraCartao.get(gasto.compraCartaoId) ?? null) : null
            };
            await datastore.criar('gastos', traduzido);
            relatorio.gastos++;
        }
        onProgresso && onProgresso('gastos', relatorio.gastos, (dadosLocais.gastos || []).length);

        for (const ganho of dadosLocais.ganhos || []) {
            await datastore.criar('ganhos', ganho);
            relatorio.ganhos++;
        }
        onProgresso && onProgresso('ganhos', relatorio.ganhos, (dadosLocais.ganhos || []).length);

        return relatorio;
    },

    marcarMigrado() {
        localStorage.setItem('finance_migrado_em', new Date().toISOString());
    },

    jaMigrouNesteNavegador() {
        return !!localStorage.getItem('finance_migrado_em');
    }
};

// ---- Modal de migração (criado dinamicamente, no mesmo estilo dos outros
// modais montados via JS em app.js, ex.: mostrarModalPagamentoParcial) ----
window.mostrarPromptMigracao = function mostrarPromptMigracao(app) {
    const dadosLocais = window.MigracaoLocalStorage.lerDadosLocais();
    const total = window.MigracaoLocalStorage.contarRegistros(dadosLocais);

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center;
        justify-content: center; z-index: 2000; padding: 20px;
    `;

    overlay.innerHTML = `
        <div style="background: white; padding: 24px; border-radius: 15px; max-width: 420px; width: 100%;">
            <h3 style="margin: 0 0 12px;">📦 Dados encontrados neste navegador</h3>
            <p style="color:#555; margin-bottom: 16px;">
                Encontramos <strong>${total} registro(s)</strong> salvos localmente (da versão antiga do app):
                ${dadosLocais.gastos.length} gastos, ${dadosLocais.ganhos.length} ganhos,
                ${dadosLocais.cartoes.length} cartões, ${dadosLocais.comprasCartao.length} compras no cartão,
                ${dadosLocais.recorrentes.length} recorrentes e ${dadosLocais.pessoas.length} pessoas.
            </p>
            <p style="color:#555; margin-bottom: 16px;">Quer importar tudo para a sua conta na nuvem agora? O que já está salvo neste navegador não será apagado.</p>
            <div id="migracaoProgresso" style="display:none; margin-bottom: 16px; color:#555; font-size: 0.9em;"></div>
            <div id="migracaoBotoes" style="display: flex; gap: 10px;">
                <button id="migracaoIgnorar" style="flex: 1; padding: 12px; background: #6c757d; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Começar do zero
                </button>
                <button id="migracaoImportar" style="flex: 1; padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Importar para a nuvem
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#migracaoIgnorar').addEventListener('click', () => {
        window.MigracaoLocalStorage.marcarMigrado();
        overlay.remove();
    });

    overlay.querySelector('#migracaoImportar').addEventListener('click', async () => {
        const botoes = overlay.querySelector('#migracaoBotoes');
        const progresso = overlay.querySelector('#migracaoProgresso');
        botoes.style.display = 'none';
        progresso.style.display = 'block';
        progresso.textContent = 'Importando... isso pode levar alguns segundos.';

        const nomesEtapa = {
            pessoas: 'pessoas', cartoes: 'cartões', recorrentes: 'recorrentes',
            comprasCartao: 'compras no cartão', gastos: 'gastos', ganhos: 'ganhos'
        };

        try {
            await window.MigracaoLocalStorage.importar(app.datastore, dadosLocais, (etapa, feito, doTotal) => {
                progresso.textContent = `Importando ${nomesEtapa[etapa]}... (${feito}/${doTotal})`;
            });
            window.MigracaoLocalStorage.marcarMigrado();
            progresso.textContent = 'Concluído! Atualizando o app...';
            await app.carregarTudoDaNuvem();
            app.refreshCompleto();
            app.carregarSelectPessoas();
            app.carregarSelectCartoes();
            overlay.remove();
            app.mostrarToast('Dados importados para a nuvem com sucesso!', 'success');
        } catch (err) {
            console.error('Erro na migração:', err);
            progresso.textContent = `Erro ao importar: ${err.message}. Parte dos dados pode já ter sido importada — recarregue a página para ver o que já entrou antes de tentar de novo.`;
            botoes.style.display = 'none';
        }
    });
};
