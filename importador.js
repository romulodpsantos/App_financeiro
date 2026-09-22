// importador.js — Importação de fatura de cartão (Fase 3).
// Hoje sabe ler dois formatos:
//  - CSV do Nubank (date,title,amount) — cada linha já é o valor de UMA
//    parcela daquele mês (ex. "Produto - Parcela 3/10" é só a parcela 3, não
//    o total), então cada linha vira um lançamento único.
//  - PDF de fatura do Inter — extraído com PDF.js, reconstruindo linhas por
//    posição (cada caractere vem como um item de texto separado no PDF) e
//    depois lendo a tabela "Despesas da fatura" com uma expressão regular.
//    O Inter mostra "Beneficiário: -" e valores de crédito com um "+" na
//    frente (ex. pagamento da fatura anterior) — igual ao Nubank, esses
//    créditos não são compra e ficam de fora do import.

// Lê um arquivo como ArrayBuffer via FileReader (mais compatível que
// File.arrayBuffer() em alguns navegadores mobile, principalmente Safari/iOS,
// que já teve bugs devolvendo o buffer incompleto/corrompido pra arquivos
// vindos do app Arquivos/iCloud).
function lerArquivoComoArrayBuffer(arquivo) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result);
        leitor.onerror = () => reject(leitor.error || new Error('Falha ao ler o arquivo.'));
        leitor.readAsArrayBuffer(arquivo);
    });
}

// ---- Parsing de CSV (com suporte a campos entre aspas) ----
function parseLinhaCSV(linha) {
    const campos = [];
    let atual = '';
    let dentroDeAspas = false;
    for (let i = 0; i < linha.length; i++) {
        const c = linha[i];
        if (c === '"') {
            if (dentroDeAspas && linha[i + 1] === '"') { atual += '"'; i++; }
            else dentroDeAspas = !dentroDeAspas;
        } else if (c === ',' && !dentroDeAspas) {
            campos.push(atual);
            atual = '';
        } else {
            atual += c;
        }
    }
    campos.push(atual);
    return campos;
}

// "100,00" -> 100; "- 4.891,70" -> -4891.70; "+ R$ 4.692,92" -> 4692.92 (crédito)
function paraValorBR(texto) {
    let t = texto.replace(/R\$\s*/i, '').trim();
    let credito = false;
    if (t.startsWith('+')) { credito = true; t = t.slice(1).trim(); }
    let negativo = false;
    if (t.startsWith('-')) { negativo = true; t = t.slice(1).trim(); }
    t = t.replace(/\./g, '').replace(',', '.');
    const valor = parseFloat(t);
    return { valor: negativo ? -valor : valor, credito };
}

const REGEX_PARCELA_NUBANK = /\s*-\s*Parcela\s+(\d+)\/(\d+)\s*$/i;

function parseNubankCSV(texto) {
    const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (linhas.length === 0) return { transacoes: [], dataVencimento: null };

    const cabecalho = parseLinhaCSV(linhas[0]).map((c) => c.trim().toLowerCase());
    const idxData = cabecalho.indexOf('date');
    const idxTitulo = cabecalho.indexOf('title');
    const idxValor = cabecalho.indexOf('amount');
    if (idxData === -1 || idxTitulo === -1 || idxValor === -1) {
        throw new Error('Formato de CSV não reconhecido (esperado cabeçalho "date,title,amount" do Nubank).');
    }

    const transacoes = linhas.slice(1).map((linha) => {
        const campos = parseLinhaCSV(linha);
        const data = campos[idxData].trim();
        const tituloOriginal = campos[idxTitulo].trim();
        const { valor, credito } = paraValorBR(campos[idxValor]);

        const matchParcela = tituloOriginal.match(REGEX_PARCELA_NUBANK);
        const descricao = matchParcela ? tituloOriginal.replace(REGEX_PARCELA_NUBANK, '') : tituloOriginal;

        return {
            data,
            descricao,
            descricaoOriginal: tituloOriginal,
            valor: Math.abs(valor),
            parcelaNumero: matchParcela ? parseInt(matchParcela[1]) : null,
            totalParcelas: matchParcela ? parseInt(matchParcela[2]) : null,
            // No CSV do Nubank, créditos vêm com valor negativo (sem "+").
            ehCompra: !credito && valor > 0
        };
    });

    return { transacoes, dataVencimento: null };
}

// ---- Parsing de PDF (fatura do Inter) ----
const MESES_PT = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const REGEX_LINHA_INTER = /^(\d{1,2}) de (\p{L}{3})\.?\s+(\d{4})\s+(.+?)\s+-\s+(\+?\s*R\$\s*[\d.,]+)\s*$/iu;
const REGEX_PARCELA_INTER = /\s*\(Parcela\s+(\d+)\s+de\s+(\d+)\)/i;
const REGEX_VENCIMENTO_INTER = /vencimento\D*(\d{2})\/(\d{2})\/(\d{4})/i;

// Reconstrói as linhas de texto de um PDF a partir dos itens posicionados que
// o PDF.js devolve (nesse tipo de fatura, cada CARACTERE vem como um item
// separado — por isso a lógica de juntar por proximidade horizontal, não só
// concatenar com espaço).
async function extrairLinhasDoPDF(arrayBuffer) {
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const linhasTotais = [];

    for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();

        const linhasMap = new Map();
        for (const item of content.items) {
            const y = Math.round(item.transform[5]);
            const x = item.transform[4];
            if (!linhasMap.has(y)) linhasMap.set(y, []);
            linhasMap.get(y).push({ x, largura: item.width || 0, texto: item.str });
        }

        const ys = [...linhasMap.keys()].sort((a, b) => b - a);
        for (const y of ys) {
            const itens = linhasMap.get(y).sort((a, b) => a.x - b.x);
            let linha = '';
            let fimAnterior = null;
            for (const item of itens) {
                if (fimAnterior !== null && item.x - fimAnterior > 1.5) linha += ' ';
                linha += item.texto;
                fimAnterior = item.x + item.largura;
            }
            linha = linha.replace(/\s+/g, ' ').trim();
            if (linha) linhasTotais.push(linha);
        }
    }

    return linhasTotais;
}

function parseInterPDFLinhas(linhasTexto) {
    const transacoes = [];
    for (const linhaBruta of linhasTexto) {
        const m = linhaBruta.trim().match(REGEX_LINHA_INTER);
        if (!m) continue;
        const [, dia, mesAbrev, ano, descBruta, valorTxt] = m;
        const mes = MESES_PT[mesAbrev.toLowerCase()];
        if (!mes) continue;

        const matchParcela = descBruta.match(REGEX_PARCELA_INTER);
        const descricao = (matchParcela ? descBruta.replace(REGEX_PARCELA_INTER, '') : descBruta).trim();
        const { valor, credito } = paraValorBR(valorTxt);

        transacoes.push({
            data: `${ano}-${String(mes).padStart(2, '0')}-${String(parseInt(dia)).padStart(2, '0')}`,
            descricao,
            descricaoOriginal: descBruta.trim(),
            valor: Math.abs(valor),
            parcelaNumero: matchParcela ? parseInt(matchParcela[1]) : null,
            totalParcelas: matchParcela ? parseInt(matchParcela[2]) : null,
            ehCompra: !credito
        });
    }

    let dataVencimento = null;
    for (const linha of linhasTexto) {
        const mv = linha.match(REGEX_VENCIMENTO_INTER);
        if (mv) { dataVencimento = `${mv[3]}-${mv[2]}-${mv[1]}`; break; }
    }

    return { transacoes, dataVencimento };
}

async function parseInterPDF(arrayBuffer) {
    const cabecalho = new Uint8Array(arrayBuffer.slice(0, 5));
    const assinatura = String.fromCharCode(...cabecalho);
    if (assinatura !== '%PDF-') {
        throw new Error(`O arquivo não chegou como um PDF válido (${arrayBuffer.byteLength} byte(s) lidos). Tente escolher o arquivo de novo — em alguns celulares, arquivos do iCloud/Arquivos falham na primeira tentativa.`);
    }

    const linhas = await extrairLinhasDoPDF(arrayBuffer);
    const resultado = parseInterPDFLinhas(linhas);
    if (resultado.transacoes.length === 0) {
        throw new Error('Não encontrei nenhum lançamento no PDF. O formato pode ter mudado — avise para eu ajustar o importador.');
    }
    return resultado;
}

// ---- Categorização automática por palavra-chave ----
const REGRAS_CATEGORIA = [
    [/uber|posto|combust|estacionamento|parking|pedagio|ped[áa]gio|oficina/i, 'transporte'],
    [/supermec|supermerc|mercearia|atacarejo|mini ?mercado|hortifruti|frutas|verdur|sacol[ãa]o|padaria|a[çc]ougue|mercasa/i, 'alimentação'],
    [/ifood|restaurante|lanchonete|pizzaria|burger|gelateria|coffee|cafe/i, 'alimentação'],
    [/farm[áa]cia|drogaria|pague menos|drogasil|clinica|cl[íi]nica|laborat[óo]rio|hospital|dental|pharma/i, 'saúde'],
    [/spotify|netflix|hbo|disney|cinema|ingresso|steam|playstation|xbox|apple\.com/i, 'lazer'],
    [/escola|faculdade|curso|udemy|alura/i, 'educação'],
    [/moveis|m[óo]veis|colch[ãa]o|constru|material el[ée]trico|tinta/i, 'moradia'],
    [/renner|riachuelo|c&a|marisa|calçados|cal[çc]ados|multimarcas/i, 'vestuário'],
    [/claro|vivo|tim|oi\s|telefonia|internet\s?fibra/i, 'moradia']
];

function categorizarPorDescricao(descricao) {
    const alvo = descricao || '';
    for (const [regex, categoria] of REGRAS_CATEGORIA) {
        if (regex.test(alvo)) return categoria;
    }
    return 'outros';
}

// ---- Hash simples e estável para deduplicação ----
function hashDedupe(partes) {
    const texto = partes.join('|').toLowerCase();
    let hash = 5381;
    for (let i = 0; i < texto.length; i++) {
        hash = ((hash << 5) + hash + texto.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16);
}

function calcularHashLinha(cartaoId, linha) {
    return hashDedupe([cartaoId, linha.data, linha.descricao.trim(), Math.round(linha.valor * 100)]);
}

function extrairDataDoNomeArquivo(nomeArquivo) {
    const m = nomeArquivo.match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
}

window.Importador = {
    parseNubankCSV,
    parseInterPDF,
    categorizarPorDescricao,
    calcularHashLinha,
    extrairDataDoNomeArquivo
};

// ---- Modal de importação ----
window.mostrarModalImportarFatura = function mostrarModalImportarFatura(app) {
    if (app.cartoes.length === 0) {
        app.mostrarToast('Cadastre um cartão antes de importar uma fatura.', 'warning');
        return;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(20,21,38,0.55); display: flex; align-items: center;
        justify-content: center; z-index: 2000; padding: 20px; backdrop-filter: blur(6px);
    `;

    const opcoesCartao = app.cartoes.map((c) => `<option value="${c.id}">💳 ${c.nome}</option>`).join('');
    const opcoesPessoas = ['Eu', ...app.pessoas].map((p) => `<option value="${p}">${p}</option>`).join('');

    overlay.innerHTML = `
        <div style="background: white; border-radius: 20px; max-width: 520px; width: 100%; max-height: 86vh; overflow-y: auto;">
            <div style="padding: 22px; border-bottom: 1px solid #e6e7f0;">
                <h3 style="margin:0;">📄 Importar fatura</h3>
            </div>
            <div id="importPasso1" style="padding: 22px;">
                <div class="input-group">
                    <label>Cartão</label>
                    <select id="importCartaoId">${opcoesCartao}</select>
                </div>
                <div class="input-group">
                    <label>Arquivo (CSV do Nubank ou PDF do Inter)</label>
                    <input type="file" id="importArquivo" accept=".csv,text/csv,.pdf,application/pdf">
                </div>
                <div class="input-group">
                    <label>Data de vencimento desta fatura</label>
                    <input type="date" id="importDataVencimento">
                </div>
                <div class="input-group" style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" id="importFaturaPaga" style="width:auto;">
                    <label for="importFaturaPaga" style="margin:0;">Esta fatura já foi paga</label>
                </div>
                <div id="importErro" style="display:none; color:#e11d48; margin-bottom:12px; font-size:0.9em;"></div>
                <button id="importAnalisar" class="btn-primary" style="width:100%;">Analisar arquivo</button>
            </div>
            <div id="importPasso2" style="display:none; padding: 0 22px 22px;">
                <div id="importResumo" style="margin-bottom:12px; font-size:0.9em; color:#555;"></div>
                <div class="input-group" style="margin-bottom:14px;">
                    <label>Atribuir toda a fatura a</label>
                    <select id="importResponsavelTodos">${opcoesPessoas}</select>
                </div>
                <div id="importTabela" style="display:grid; gap:8px; max-height:38vh; overflow-y:auto; margin-bottom:16px;"></div>
                <div id="importProgresso" style="display:none; margin-bottom:12px; color:#555; font-size:0.9em;"></div>
                <div style="display:flex; gap:10px;">
                    <button id="importCancelar" class="btn-outline" style="flex:1;">Cancelar</button>
                    <button id="importConfirmar" class="btn-primary" style="flex:1;">Importar selecionados</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    let linhasAnalisadas = [];

    const arquivoInput = overlay.querySelector('#importArquivo');
    arquivoInput.addEventListener('change', () => {
        const arquivo = arquivoInput.files[0];
        if (!arquivo) return;
        const dataDoNome = window.Importador.extrairDataDoNomeArquivo(arquivo.name);
        if (dataDoNome) overlay.querySelector('#importDataVencimento').value = dataDoNome;
    });

    overlay.querySelector('#importAnalisar').addEventListener('click', async () => {
        const erroEl = overlay.querySelector('#importErro');
        const botaoAnalisar = overlay.querySelector('#importAnalisar');
        erroEl.style.display = 'none';

        const arquivo = arquivoInput.files[0];
        const cartaoId = parseInt(overlay.querySelector('#importCartaoId').value);

        if (!arquivo) { erroEl.textContent = 'Escolha um arquivo.'; erroEl.style.display = 'block'; return; }

        botaoAnalisar.disabled = true;
        botaoAnalisar.textContent = 'Analisando...';
        try {
            let resultado;
            if (/\.pdf$/i.test(arquivo.name) || arquivo.type === 'application/pdf') {
                const buffer = await lerArquivoComoArrayBuffer(arquivo);
                resultado = await window.Importador.parseInterPDF(buffer);
            } else {
                const texto = await arquivo.text();
                resultado = window.Importador.parseNubankCSV(texto);
            }

            if (resultado.dataVencimento) {
                overlay.querySelector('#importDataVencimento').value = resultado.dataVencimento;
            }

            const dataVencimento = overlay.querySelector('#importDataVencimento').value;
            if (!dataVencimento) {
                erroEl.textContent = 'Não consegui identificar a data de vencimento — informe manualmente e analise de novo.';
                erroEl.style.display = 'block';
                return;
            }

            const hashesExistentes = new Set(
                app.comprasCartao.filter((c) => c.cartaoId === cartaoId).map((c) => c.hashDedupe).filter(Boolean)
            );

            linhasAnalisadas = resultado.transacoes.map((linha) => {
                const hash = window.Importador.calcularHashLinha(cartaoId, linha);
                return {
                    ...linha,
                    categoria: window.Importador.categorizarPorDescricao(linha.descricao),
                    responsavel: 'Eu',
                    hash,
                    duplicada: hashesExistentes.has(hash)
                };
            });

            renderizarRevisao();
            overlay.querySelector('#importPasso1').style.display = 'none';
            overlay.querySelector('#importPasso2').style.display = 'block';
        } catch (err) {
            erroEl.textContent = err.message;
            erroEl.style.display = 'block';
        } finally {
            botaoAnalisar.disabled = false;
            botaoAnalisar.textContent = 'Analisar arquivo';
        }
    });

    function renderizarRevisao() {
        const compras = linhasAnalisadas.filter((l) => l.ehCompra);
        const ignoradas = linhasAnalisadas.filter((l) => !l.ehCompra);
        const duplicadas = compras.filter((l) => l.duplicada).length;

        const resumoEl = overlay.querySelector('#importResumo');
        resumoEl.innerHTML = `${compras.length} lançamento(s) encontrado(s)` +
            (duplicadas > 0 ? `, ${duplicadas} já importado(s) anteriormente (desmarcados)` : '') +
            (ignoradas.length > 0 ? `. ${ignoradas.length} linha(s) ignorada(s) por serem pagamento/estorno, não uma compra.` : '.');

        const categoriasHtml = (categoriaAtual) => [
            'alimentação', 'transporte', 'lazer', 'saúde', 'educação', 'moradia', 'vestuário', 'outros'
        ].map((c) => `<option value="${c}" ${c === categoriaAtual ? 'selected' : ''}>${c}</option>`).join('');

        const pessoasHtml = (respAtual) => ['Eu', ...app.pessoas]
            .map((p) => `<option value="${p}" ${p === respAtual ? 'selected' : ''}>${p}</option>`).join('');

        const tabelaEl = overlay.querySelector('#importTabela');
        tabelaEl.innerHTML = compras.map((linha, i) => `
            <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:8px; border:1px solid #e6e7f0; border-radius:10px; ${linha.duplicada ? 'opacity:0.5;' : ''}">
                <input type="checkbox" data-idx="${i}" class="import-check" ${linha.duplicada ? '' : 'checked'} style="width:auto;">
                <div style="flex:1; min-width:120px;">
                    <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${linha.descricaoOriginal}${linha.duplicada ? ' <span style="color:#e11d48; font-size:0.75em;">(já importado)</span>' : ''}
                    </div>
                    <div style="font-size:0.8em; color:#777;">${app.formatarData(linha.data)}</div>
                </div>
                <select data-idx="${i}" class="import-categoria" style="width:auto; padding:6px;">${categoriasHtml(linha.categoria)}</select>
                <select data-idx="${i}" class="import-responsavel" style="width:auto; padding:6px;">${pessoasHtml(linha.responsavel)}</select>
                <div style="font-weight:700; white-space:nowrap;">${app.formatarMoeda(linha.valor)}</div>
            </div>
        `).join('');

        tabelaEl.querySelectorAll('.import-categoria').forEach((sel) => {
            sel.addEventListener('change', (e) => {
                compras[parseInt(e.target.dataset.idx)].categoria = e.target.value;
            });
        });
        tabelaEl.querySelectorAll('.import-responsavel').forEach((sel) => {
            sel.addEventListener('change', (e) => {
                compras[parseInt(e.target.dataset.idx)].responsavel = e.target.value;
            });
        });

        overlay._comprasRevisao = compras;
    }

    overlay.querySelector('#importResponsavelTodos').addEventListener('change', (e) => {
        const novoResp = e.target.value;
        (overlay._comprasRevisao || []).forEach((c) => { c.responsavel = novoResp; });
        overlay.querySelectorAll('.import-responsavel').forEach((sel) => { sel.value = novoResp; });
    });

    overlay.querySelector('#importCancelar').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#importConfirmar').addEventListener('click', async () => {
        const cartaoId = parseInt(overlay.querySelector('#importCartaoId').value);
        const dataVencimento = overlay.querySelector('#importDataVencimento').value;
        const faturaPaga = overlay.querySelector('#importFaturaPaga').checked;
        const compras = overlay._comprasRevisao || [];

        const marcados = [];
        overlay.querySelectorAll('.import-check').forEach((chk) => {
            if (chk.checked) marcados.push(compras[parseInt(chk.dataset.idx)]);
        });

        if (marcados.length === 0) {
            overlay.remove();
            return;
        }

        const progresso = overlay.querySelector('#importProgresso');
        const botaoConfirmar = overlay.querySelector('#importConfirmar');
        progresso.style.display = 'block';
        botaoConfirmar.disabled = true;
        overlay.querySelector('#importCancelar').disabled = true;

        let feitos = 0;
        try {
            for (const linha of marcados) {
                progresso.textContent = `Importando ${feitos + 1}/${marcados.length}...`;

                const novaCompra = await app.datastore.criar('comprasCartao', {
                    cartaoId,
                    descricao: linha.descricaoOriginal,
                    valor: linha.valor,
                    categoria: linha.categoria,
                    parcelas: 1,
                    dataCompra: linha.data,
                    ativa: true,
                    origemImport: 'import',
                    faturaStatus: faturaPaga ? 'fechada' : 'parcial',
                    hashDedupe: linha.hash
                });
                app.comprasCartao.push(novaCompra);

                const novoGasto = await app.datastore.criar('gastos', {
                    descricao: `💳 ${linha.descricaoOriginal}`,
                    valor: linha.valor,
                    categoria: linha.categoria,
                    responsavel: linha.responsavel || 'Eu',
                    data: dataVencimento,
                    pago: faturaPaga,
                    dataPagamento: faturaPaga ? dataVencimento : null,
                    cartaoId,
                    compraCartaoId: novaCompra.id,
                    parcelaNumero: linha.parcelaNumero,
                    totalParcelas: linha.totalParcelas
                });
                app.gastos.push(novoGasto);

                feitos++;
            }

            app.refreshCompleto();
            overlay.remove();
            app.mostrarToast(`${feitos} lançamento(s) importado(s) com sucesso!`, 'success');
        } catch (err) {
            progresso.textContent = `Erro ao importar (${feitos}/${marcados.length} concluídos): ${err.message}`;
            botaoConfirmar.disabled = false;
            overlay.querySelector('#importCancelar').disabled = false;
        }
    });
};
