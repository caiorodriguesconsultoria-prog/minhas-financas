import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface Transaction {
  id: string; user_id?: string; account_id?: string;
  data_transacao?: string; valor?: number; descricao?: string;
  tipo?: string; categoria?: string; beneficiario_real?: string;
  meio_pagamento?: string; tipo_escopo?: string; created_at?: string;
}
export interface Account {
  id: string; user_id?: string; nome?: string; tipo?: string;
  saldo_inicial?: number; ativo?: boolean; created_at?: string;
}
export interface BillToPay {
  id: string; user_id?: string; account_id?: string; nome?: string;
  data_vencimento?: string; status?: string; valor_base?: number;
  juros_atraso?: number; encargos_cartao?: number; created_at?: string;
  categoria?: string; dia_vencimento?: number; recorrente?: boolean; template_id?: string | null;
}
export interface Couple {
  id: string; user_id_1: string; user_id_2?: string | null;
  invited_email?: string | null; status: string;
  invite_token: string; created_at?: string;
}
export function normaliseTx(t: Transaction) {
  const isIncome = t.tipo === "receita" || t.tipo === "income" || t.tipo === "entrada";
  return {
    id: t.id, user_id: t.user_id ?? null, account_id: t.account_id ?? null,
    name: t.descricao ?? "Sem descrição", category: t.categoria ?? "Outros",
    value: t.valor ?? 0, type: isIncome ? "income" : "expense",
    date: t.data_transacao ?? t.created_at?.slice(0, 10) ?? "",
    beneficiario_real: t.beneficiario_real ?? null,
    meio_pagamento: t.meio_pagamento ?? null,
    tipo_escopo: t.tipo_escopo ?? null,
  } as const;
}
export function normaliseAccount(a: Account) {
  return {
    id: a.id, user_id: a.user_id ?? null, name: a.nome ?? "Conta",
    balance: a.saldo_inicial ?? 0, type: a.tipo ?? "corrente", active: a.ativo ?? true,
  } as const;
}
