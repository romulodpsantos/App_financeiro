// datastore.js — Camada de dados na nuvem (Fase 2). Troca o antigo
// localStorage por chamadas à Neon Data API, usando a mesma sessão que o
// auth.js já deixou disponível em window.neonClient.
//
// Mantém os objetos em memória no MESMO formato de sempre (camelCase, valores
// em reais/float) para não precisar reescrever a lógica de negócio de
// app.js — só a tradução de/para o formato do banco (snake_case, centavos
// inteiros) acontece aqui.

function paraCentavos(reais) {
    return Math.round(Number(reais) * 100);
}

function paraReais(centavos) {
    return centavos / 100;
}

// Descreve, campo a campo, como cada propriedade do objeto usado em app.js
// corresponde a uma coluna do banco. Uma string é o nome da coluna (sem
// conversão); um objeto {db, toDb, fromDb} indica uma conversão de valor
// (hoje só usado para dinheiro: reais <-> centavos).
const TABELAS = {
    gastos: {
        tabela: 'gastos',
        tipo: 'gasto',
        campos: {
            descricao: 'descricao',
            valor: { db: 'valor_centavos', toDb: paraCentavos, fromDb: paraReais },
            categoria: 'categoria',
            responsavel: 'responsavel',
            data: 'data',
            pago: 'pago',
            dataPagamento: 'data_pagamento',
            recorrenteId: 'recorrente_id',
            cartaoId: 'cartao_id',
            compraCartaoId: 'compra_cartao_id',
            parcelaNumero: 'parcela_numero',
            totalParcelas: 'total_parcelas'
        }
    },
    ganhos: {
        tabela: 'ganhos',
        tipo: 'ganho',
        campos: {
            descricao: 'descricao',
            valor: { db: 'valor_centavos', toDb: paraCentavos, fromDb: paraReais },
            data: 'data',
            origem: 'origem',
            pessoaOrigem: 'pessoa_origem'
        }
    },
    cartoes: {
        tabela: 'cartoes',
        campos: {
            nome: 'nome',
            limite: { db: 'limite_centavos', toDb: paraCentavos, fromDb: paraReais },
            diaFechamento: 'dia_fechamento',
            diaVencimento: 'dia_vencimento'
        }
    },
    recorrentes: {
        tabela: 'recorrentes',
        campos: {
            descricao: 'descricao',
            valor: { db: 'valor_centavos', toDb: paraCentavos, fromDb: paraReais },
            categoria: 'categoria',
            tipo: 'tipo',
            parcelas: 'parcelas',
            parcelasPagas: 'parcelas_pagas',
            responsavel: 'responsavel',
            dataInicio: 'data_inicio',
            ativo: 'ativo'
        }
    },
    comprasCartao: {
        tabela: 'compras_cartao',
        // parcelasPagas nunca é incrementado em lugar nenhum do app (cada
        // parcela individual tem seu próprio "pago" no gasto gerado) — não
        // existe coluna no banco pra isso, só mantemos o campo sempre em 0
        // porque a lista de compras ainda exibe "X/Y parc.".
        extra: { parcelasPagas: 0 },
        campos: {
            cartaoId: 'cartao_id',
            descricao: 'descricao',
            valor: { db: 'valor_centavos', toDb: paraCentavos, fromDb: paraReais },
            categoria: 'categoria',
            parcelas: 'parcelas',
            dataCompra: 'data_compra',
            ativa: 'ativa',
            origemImport: 'origem_import',
            faturaStatus: 'fatura_status',
            hashDedupe: 'hash_dedupe'
        }
    }
};

function mapParaDb(chaveTabela, objApp) {
    const { campos } = TABELAS[chaveTabela];
    const linha = {};
    for (const [campoApp, destino] of Object.entries(campos)) {
        if (!(campoApp in objApp)) continue;
        const valor = objApp[campoApp];
        if (typeof destino === 'string') {
            linha[destino] = valor === undefined ? null : valor;
        } else {
            linha[destino.db] = valor === undefined || valor === null ? null : destino.toDb(valor);
        }
    }
    return linha;
}

function mapDeDb(chaveTabela, linhaDb) {
    const { campos, tipo, extra } = TABELAS[chaveTabela];
    const objApp = { id: linhaDb.id, timestamp: linhaDb.criado_em, ...(extra || {}) };
    if (tipo) objApp.tipo = tipo;
    for (const [campoApp, origem] of Object.entries(campos)) {
        if (typeof origem === 'string') {
            objApp[campoApp] = linhaDb[origem];
        } else {
            const bruto = linhaDb[origem.db];
            objApp[campoApp] = bruto === null || bruto === undefined ? null : origem.fromDb(bruto);
        }
    }
    return objApp;
}

class Datastore {
    constructor(client) {
        this.client = client;
    }

    async listarTudo(chaveTabela) {
        const { tabela } = TABELAS[chaveTabela];
        const { data, error } = await this.client.from(tabela).select('*');
        if (error) throw new Error(error.message || `Falha ao carregar ${chaveTabela}`);
        return (data || []).map((linha) => mapDeDb(chaveTabela, linha));
    }

    async criar(chaveTabela, objAppSemId) {
        const { tabela } = TABELAS[chaveTabela];
        const linha = mapParaDb(chaveTabela, objAppSemId);
        const { data, error } = await this.client.from(tabela).insert(linha).select();
        if (error) throw new Error(error.message || `Falha ao criar em ${chaveTabela}`);
        return mapDeDb(chaveTabela, data[0]);
    }

    async atualizar(chaveTabela, id, camposParciais) {
        const { tabela } = TABELAS[chaveTabela];
        const linha = mapParaDb(chaveTabela, camposParciais);
        const { data, error } = await this.client.from(tabela).update(linha).eq('id', id).select();
        if (error) throw new Error(error.message || `Falha ao atualizar ${chaveTabela}#${id}`);
        return data && data[0] ? mapDeDb(chaveTabela, data[0]) : null;
    }

    async remover(chaveTabela, id) {
        const { tabela } = TABELAS[chaveTabela];
        const { error } = await this.client.from(tabela).delete().eq('id', id);
        if (error) throw new Error(error.message || `Falha ao remover ${chaveTabela}#${id}`);
    }

    // ---- Pessoas: o app trata pessoas como uma lista de nomes (string),
    // não como objetos com id — por isso ganham métodos próprios em vez do
    // CRUD genérico acima.
    async pessoasListar() {
        const { data, error } = await this.client.from('pessoas').select('nome').order('nome');
        if (error) throw new Error(error.message || 'Falha ao carregar pessoas');
        return (data || []).map((linha) => linha.nome);
    }

    async pessoaCriar(nome) {
        const { data, error } = await this.client.from('pessoas').insert({ nome }).select();
        if (error) throw new Error(error.message || 'Falha ao criar pessoa');
        return data[0].nome;
    }

    async pessoaRenomear(nomeAntigo, nomeNovo) {
        const { error } = await this.client.from('pessoas').update({ nome: nomeNovo }).eq('nome', nomeAntigo);
        if (error) throw new Error(error.message || 'Falha ao renomear pessoa');
    }

    async pessoaRemover(nome) {
        const { error } = await this.client.from('pessoas').delete().eq('nome', nome);
        if (error) throw new Error(error.message || 'Falha ao remover pessoa');
    }
}

window.Datastore = Datastore;
