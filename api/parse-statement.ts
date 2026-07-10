// Função de servidor (Vercel Serverless Function) que envia um extrato/fatura (PDF ou imagem)
// para a API da Anthropic (Claude) e pede de volta uma lista estruturada de lançamentos.
// A chave da API fica só aqui no servidor, nunca exposta no navegador.

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada no servidor" });
    return;
  }

  const { fileBase64, mimeType } = req.body ?? {};
  if (!fileBase64 || !mimeType) {
    res.status(400).json({ error: "Envie fileBase64 e mimeType" });
    return;
  }

  const isPdf = mimeType === "application/pdf";
  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileBase64 } }
    : { type: "image", source: { type: "base64", media_type: mimeType, data: fileBase64 } };

  const prompt = `Você está analisando um extrato de conta corrente OU uma fatura de cartão de crédito de um banco brasileiro (pode ser print de tela, foto ou PDF).

Primeiro, identifique o NOME DO TITULAR da conta (geralmente aparece no cabeçalho do documento, ex: "CAIO CARVALHAES RODRIGUES").

Extraia TODOS os lançamentos visíveis e devolva SOMENTE um JSON válido (sem markdown, sem texto antes ou depois), no formato exato:

{
  "tipo_documento": "extrato" ou "fatura",
  "banco_detectado": "nome do banco, ex: Nubank, Banco do Brasil, C6 Bank, Bradesco, Santander, Caixa, Inter (ou null se não identificar)",
  "cartao_final": "últimos 4 dígitos do cartão, se for fatura (ou null)",
  "titular": "nome do titular identificado no documento, ou null",
  "saldo_final": 1234.56 ou null (o saldo final/saldo do dia mais recente mostrado no documento, se houver — só faz sentido para extrato de conta corrente),
  "transacoes": [
    {
      "data": "YYYY-MM-DD",
      "descricao": "nome do estabelecimento ou descrição do lançamento",
      "valor": 123.45,
      "tipo": "despesa", "receita" ou "transferencia",
      "meio_pagamento": "pix", "debito", "credito", "dinheiro" ou "ted_doc" (use "ted_doc" para transferências/TED/DOC, e "debito" para boletos ou débito automático)
    }
  ]
}

Regras importantes:
- Valores sempre positivos (o campo "tipo" já indica a direção).
- Se o documento for uma FATURA de cartão de crédito, todos os lançamentos têm meio_pagamento "credito" e tipo "despesa" (a menos que seja estorno/crédito, aí é "receita").
- Se for EXTRATO de conta corrente, identifique cada lançamento pelo tipo real (Pix enviado = despesa/pix, Pix recebido = receita/pix, compra com cartão de débito = despesa/debito, etc).
- MUITO IMPORTANTE — Transferências entre contas do próprio titular: se um Pix, TED ou transferência foi enviado OU recebido tendo como remetente/destinatário o MESMO NOME do titular da conta (ex: "Pix recebido de CAIO CARVALHAES RODRIGUES" numa conta que também é do CAIO CARVALHAES RODRIGUES), classifique como "tipo": "transferencia" — NÃO como receita nem despesa, já que não é dinheiro novo entrando nem saindo da família, só mudando de conta.
- Ignore completamente linhas que não são lançamentos reais: saldo do dia, saldo anterior, cabeçalhos, totais, "em processamento" sem valor definido, e também linhas de aplicação automática/rendimento diário tipo "Rende Fácil", "CDB [banco] LIM.GARANT", "Outros gastos" quando na verdade for aplicação automática de sobra de caixa, ou qualquer linha que represente apenas o dinheiro sendo automaticamente investido/resgatado dentro da mesma conta (isso não é um lançamento real, é só o saldo variando).
- Extraia o "saldo_final": procure a linha de saldo mais recente do extrato (geralmente "Saldo do dia" da última data, ou saldo no topo/rodapé do documento).
- Datas: se o ano não estiver explícito, assuma o ano atual (${new Date().getFullYear()}).
- Se não conseguir ler nada, devolva "transacoes": [].`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [contentBlock, { type: "text", text: prompt }],
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data.error?.message ?? "Erro ao chamar a API da Anthropic" });
      return;
    }

    const textBlock = data.content?.find((c: any) => c.type === "text");
    if (!textBlock) {
      res.status(500).json({ error: "Resposta da IA não contém texto" });
      return;
    }

    let cleaned = textBlock.text.trim();
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: "Não foi possível interpretar a resposta da IA como JSON", raw: cleaned });
      return;
    }

    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Erro desconhecido" });
  }
}
