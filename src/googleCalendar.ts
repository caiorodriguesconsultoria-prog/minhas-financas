// Integração com Google Agenda (Google Calendar API) via Google Identity Services (GIS).
// Fluxo 100% client-side: o usuário autoriza uma vez, recebemos um access_token temporário
// (válido por ~1h) e usamos para criar/atualizar eventos. Sem backend, sem refresh token —
// se o token expirar, basta clicar em "Conectar" de novo.

const CLIENT_ID = "794940285763-a6c68p8dtv3v4n2htkb1tdua1hme6c8h.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const STORAGE_KEY = "gcal_token_v1";

interface StoredToken {
  access_token: string;
  expires_at: number; // epoch ms
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

function getStored(): StoredToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (parsed.expires_at < Date.now()) return null;
    return parsed;
  } catch { return null; }
}

export function isGoogleCalendarConnected(): boolean {
  return !!getStored();
}

export function disconnectGoogleCalendar(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function connectGoogleCalendar(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof google === "undefined" || !google.accounts?.oauth2) {
      reject(new Error("Google Identity Services ainda não carregou. Tente novamente em alguns segundos."));
      return;
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => {
        if (resp.error || !resp.access_token) { reject(new Error(resp.error || "Falha ao autorizar")); return; }
        const stored: StoredToken = {
          access_token: resp.access_token,
          expires_at: Date.now() + (resp.expires_in ?? 3600) * 1000 - 60000,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        resolve();
      },
    });
    client.requestAccessToken();
  });
}

export interface CalendarEventInput {
  billId: string;      // id único (usado para achar/atualizar o mesmo evento depois)
  title: string;       // ex: "Fatura Nubank"
  date: string;        // YYYY-MM-DD
  amount: number;
  notes?: string;
}

// Busca um evento já criado anteriormente para este billId (usando extendedProperties como marcador)
async function findExistingEvent(token: string, billId: string): Promise<string | null> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=${encodeURIComponent(`billId=${billId}`)}&maxResults=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.items?.[0]?.id ?? null;
}

export async function syncBillToCalendar(input: CalendarEventInput): Promise<void> {
  const stored = getStored();
  if (!stored) throw new Error("Google Agenda não conectado");

  const eventBody = {
    summary: `💰 ${input.title} — ${input.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
    description: input.notes ?? "Lançamento automático do app Minhas Finanças.",
    start: { date: input.date },
    end: { date: input.date },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 24 * 60 }] },
    extendedProperties: { private: { billId: input.billId } },
  };

  const existingId = await findExistingEvent(stored.access_token, input.billId);
  const url = existingId
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingId}`
    : `https://www.googleapis.com/calendar/v3/calendars/primary/events`;

  const res = await fetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${stored.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventBody),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao sincronizar com o Google Agenda: ${errText}`);
  }
}
