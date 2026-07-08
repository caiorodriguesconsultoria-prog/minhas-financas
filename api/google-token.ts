// Função de servidor (Vercel Serverless Function) para trocar/renovar tokens do Google.
// O client_secret NUNCA fica exposto no navegador — só existe aqui, do lado do servidor.

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const CLIENT_ID = "794940285763-a6c68p8dtv3v4n2htkb1tdua1hme6c8h.apps.googleusercontent.com";
  const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  if (!CLIENT_SECRET) {
    res.status(500).json({ error: "GOOGLE_CLIENT_SECRET não configurado no servidor" });
    return;
  }

  const { code, refresh_token } = req.body ?? {};

  try {
    let body: Record<string, string>;
    if (code) {
      // Primeira conexão: troca o "code" (do popup) por access_token + refresh_token
      body = {
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: "postmessage",
        grant_type: "authorization_code",
      };
    } else if (refresh_token) {
      // Renovação silenciosa: usa o refresh_token para pegar um novo access_token
      body = {
        refresh_token,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "refresh_token",
      };
    } else {
      res.status(400).json({ error: "Envie 'code' (primeira conexão) ou 'refresh_token' (renovação)" });
      return;
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });

    const data = await tokenRes.json();
    if (!tokenRes.ok) {
      res.status(tokenRes.status).json({ error: data.error_description ?? data.error ?? "Erro ao trocar token" });
      return;
    }

    res.status(200).json({
      access_token: data.access_token,
      refresh_token: data.refresh_token, // só vem na primeira troca (com 'code')
      expires_in: data.expires_in,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Erro desconhecido" });
  }
}
