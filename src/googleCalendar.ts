// Integração com Google Agenda (Google Calendar API).
// Usa o fluxo de "authorization code" do Google: ao conectar, trocamos um código por um
// access_token (curto, ~1h) E um refresh_token (de longa duração). O refresh_token fica
// guardado no Supabase, e sempre que o access_token expira, uma função de servidor
// (api/google-token.ts) o renova silenciosamente — sem precisar reconectar manualmente.

import { supabase } from "./supabase";

const CLIENT_ID = "794940285763-a6c68p8dtv3v4n2htkb1tdua1hme6c8h.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const STORAGE_KEY = "gcal_token_v1";

interface StoredToken {
  access_token: string;
  expires_at: number; // epoch ms
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

function getStoredLocal(): StoredToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (parsed.expires_at < Date.now()) return null;
    return parsed;
  } catch { return null; }
}

function saveLocal(access_token: string, expires_in: number) {
  const expires_at = Date.now() + expires_in * 1000 - 60000;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ access_token, expires_at }));
  return expires_at;
}

// Checagem rápida e local (sem chamada de rede) — útil para UI que não precisa ser 100% exata.
export function isGoogleCalendarConnected(): boolean {
  return !!getStoredLocal();
}

// Checagem "de verdade": existe um refresh_token salvo no Supabase? Se sim, o app consegue
// renovar sozinho sempre que precisar, mesmo que o token local tenha expirado ou sumido.
export async function hasGoogleCalendarRefreshToken(userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("gcal_refresh_token").eq("id", userId).maybeSingle();
  return !!data?.gcal_refresh_token;
}

export async function restoreGoogleCalendarFromServer(userId: string): Promise<void> {
  if (isGoogleCalendarConnected()) return;
  const { data } = await supabase.from("profiles").select("gcal_access_token, gcal_expires_at").eq("id", userId).maybeSingle();
  if (data?.gcal_access_token && data?.gcal_expires_at && data.gcal_expires_at > Date.now()) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ access_token: data.gcal_access_token, expires_at: data.gcal_expires_at }));
  }
}

export async function disconnectGoogleCalendar(userId?: string): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  if (userId) await supabase.from("profiles").update({ gcal_access_token: null, gcal_expires_at: null, gcal_refresh_token: null }).eq("id", userId);
}

export function connectGoogleCalendar(userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof google === "undefined" || !google.accounts?.oauth2) {
      reject(new Error("Google Identity Services ainda não carregou. Tente novamente em alguns segundos."));
      return;
    }
    const client = google.accounts.oauth2.initCodeClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      ux_mode: "popup",
      callback: async (resp: { code?: string; error?: string }) => {
        if (resp.error || !resp.code) { reject(new Error(resp.error || "Falha ao autorizar")); return; }
        try {
          const tokenRes = await fetch("/api/google-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: resp.code }),
          });
          const data = await tokenRes.json();
          if (!tokenRes.ok) { reject(new Error(data.error ?? "Erro ao trocar código por token")); return; }

          const expiresAt = saveLocal(data.access_token, data.expires_in ?? 3600);
          await supabase.from("profiles").update({
            gcal_access_token: data.access_token,
            gcal_expires_at: expiresAt,
            ...(data.refresh_token ? { gcal_refresh_token: data.refresh_token } : {}),
          }).eq("id", userId);
          resolve();
        } catch (e) {
          reject(e instanceof Error ? e : new Error("Erro ao conectar"));
        }
      },
    });
    client.requestCode();
  });
}

// Retorna um access_token válido, renovando silenciosamente via refresh_token se preciso.
// Retorna null se nunca foi conectado (não há refresh_token salvo).
async function getValidAccessToken(userId: string): Promise<string | null> {
  const local = getStoredLocal();
  if (local) return local.access_token;

  const { data } = await supabase.from("profiles").select("gcal_refresh_token").eq("id", userId).maybeSingle();
  const refreshToken = data?.gcal_refresh_token;
  if (!refreshToken) return null;

  const tokenRes = await fetch("/api/google-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) return null;

  const expiresAt = saveLocal(tokenData.access_token, tokenData.expires_in ?? 3600);
  await supabase.from("profiles").update({ gcal_access_token: tokenData.access_token, gcal_expires_at: expiresAt }).eq("id", userId);
  return tokenData.access_token;
}

export interface CalendarEventInput {
  billId: string;      // id único (usado para achar/atualizar o mesmo evento depois)
  title: string;       // ex: "Fatura Nubank"
  date: string;        // YYYY-MM-DD
  amount: number;
  notes?: string;
}

async function findExistingEvent(token: string, billId: string): Promise<string | null> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=${encodeURIComponent(`billId=${billId}`)}&maxResults=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.items?.[0]?.id ?? null;
}

export async function syncBillToCalendar(userId: string, input: CalendarEventInput): Promise<void> {
  const token = await getValidAccessToken(userId);
  if (!token) throw new Error("Google Agenda não conectado");

  const eventBody = {
    summary: `💰 ${input.title} — ${input.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
    description: input.notes ?? "Lançamento automático do app Minhas Finanças.",
    start: { date: input.date },
    end: { date: input.date },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 24 * 60 }] },
    extendedProperties: { private: { billId: input.billId } },
  };

  const existingId = await findExistingEvent(token, input.billId);
  const url = existingId
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingId}`
    : `https://www.googleapis.com/calendar/v3/calendars/primary/events`;

  const res = await fetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventBody),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao sincronizar com o Google Agenda: ${errText}`);
  }
}
