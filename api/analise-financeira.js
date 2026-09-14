// api/analise-financeira.js — Function serverless (Vercel, runtime Node.js).
//
// Recebe um RESUMO financeiro já agregado pelo cliente (nunca a lista crua de
// transações — menos dado sensível trafegando e menos tokens) e pede pra
// Claude uma análise de dívidas com sugestões e projeção de quitação.
//
// Exige a variável de ambiente ANTHROPIC_API_KEY configurada no projeto da
// Vercel (Project Settings > Environment Variables). A chave nunca é enviada
// ao navegador — só este código, rodando no servidor da Vercel, a usa.

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

const SYSTEM_PROMPT = `Você é um consultor financeiro brasileiro, especializado em ajudar pessoas físicas a sair de dívidas de cartão de crédito e empréstimos pessoais.

Você vai receber um resumo (em JSON) da situação financeira de uma pessoa: saldo atual, renda média mensal, dívidas em aberto (cartões, parcelamentos, valores devidos a/por outras pessoas) e gastos fixos.

Responda em português do Brasil, em texto corrido com títulos curtos usando markdown simples (## e **negrito**), sem inventar números que não estejam no resumo. Estruture a resposta assim:

## Diagnóstico rápido
Um parágrafo curto resumindo a situação (nível de comprometimento da renda com dívidas, se há sinais de alerta como uso de rotativo/juros altos).

## Prioridade de quitação
Liste as dívidas em ordem de prioridade para atacar primeiro, explicando o critério (normalmente: maior taxa de juros primeiro — método avalanche — mas considere também dívidas pequenas que dão alívio psicológico rápido — método bola de neve — se fizer sentido pro caso).

## Projeção
Com base na renda disponível informada, estime (de forma aproximada, deixando claro que é uma estimativa) em quantos meses a pessoa consegue quitar as dívidas se destinar um valor mensal extra a elas, e o que muda se destinar mais ou menos.

## Ações concretas
3 a 5 sugestões práticas e específicas (não genéricas como "gaste menos") baseadas nos números reais do resumo.

Seja direto, empático e realista — não minimize a gravidade se a situação for séria, mas também não seja alarmista à toa.`;

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método não permitido.' });
        return;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
        res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada neste ambiente. Configure em Vercel > Project Settings > Environment Variables.' });
        return;
    }

    try {
        const resumo = req.body;
        if (!resumo || typeof resumo !== 'object') {
            res.status(400).json({ error: 'Corpo da requisição inválido.' });
            return;
        }

        const response = await client.messages.create({
            model: 'claude-opus-5',
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: [
                { role: 'user', content: `Aqui está meu resumo financeiro:\n\n${JSON.stringify(resumo, null, 2)}` }
            ]
        });

        const textoResposta = response.content.find((bloco) => bloco.type === 'text');
        res.status(200).json({ analise: textoResposta ? textoResposta.text : '' });
    } catch (err) {
        console.error('Erro ao chamar a API da Anthropic:', err);
        res.status(502).json({ error: 'Não foi possível gerar a análise agora. Tente novamente em instantes.' });
    }
};
