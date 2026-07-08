// Bloqueio local do app usando Face ID / Touch ID (via WebAuthn).
//
// IMPORTANTE: isso NÃO substitui o login do Supabase — é uma trava extra, só no dispositivo,
// que impede a tela de abrir sem a biometria. A sessão real continua sendo a do Supabase
// (Google/Magic Link). Não há verificação de assinatura no servidor; o navegador só libera
// o "unlock" depois de confirmar a biometria com o autenticador da plataforma (Face ID/Touch ID/
// Windows Hello), o que é suficiente para esse propósito de conveniência/privacidade local.
//
// Para sobreviver à limpeza de localStorage que o iOS às vezes faz em PWAs instalados na tela
// inicial, guardamos uma cópia do estado (id da credencial + se está ativado) no Supabase,
// e restauramos para o localStorage automaticamente quando o app carrega.

import { supabase } from "./supabase";

const CRED_ID_KEY = "faceid_cred_id_v1";
const ENABLED_KEY = "faceid_enabled_v1";

function bufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function isFaceIdSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export function isFaceIdEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === "1" && !!localStorage.getItem(CRED_ID_KEY);
}

// Chamar no carregamento do app: se o localStorage perdeu a informação mas o Supabase
// ainda tem, restaura localmente sem precisar configurar de novo.
export async function restoreFaceIdFromServer(userId: string): Promise<void> {
  if (isFaceIdEnabled()) return; // já está ok localmente, não precisa restaurar
  const { data } = await supabase.from("profiles").select("face_id_cred_id, face_id_enabled").eq("id", userId).maybeSingle();
  if (data?.face_id_enabled && data?.face_id_cred_id) {
    localStorage.setItem(CRED_ID_KEY, data.face_id_cred_id);
    localStorage.setItem(ENABLED_KEY, "1");
  }
}

export async function enableFaceId(userId: string, userEmail: string): Promise<void> {
  if (!isFaceIdSupported()) throw new Error("Este navegador/dispositivo não suporta Face ID / Touch ID.");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = crypto.getRandomValues(new Uint8Array(16));

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Minhas Finanças", id: window.location.hostname },
      user: { id: userIdBytes, name: userEmail, displayName: userEmail },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
    },
  }) as PublicKeyCredential | null;

  if (!credential) throw new Error("Não foi possível configurar o Face ID / Touch ID.");

  const credIdB64 = bufferToBase64(credential.rawId);
  localStorage.setItem(CRED_ID_KEY, credIdB64);
  localStorage.setItem(ENABLED_KEY, "1");

  // Backup no Supabase para sobreviver à limpeza de armazenamento local do iOS
  await supabase.from("profiles").update({ face_id_cred_id: credIdB64, face_id_enabled: true }).eq("id", userId);
}

export async function disableFaceId(userId: string): Promise<void> {
  localStorage.removeItem(CRED_ID_KEY);
  localStorage.removeItem(ENABLED_KEY);
  await supabase.from("profiles").update({ face_id_cred_id: null, face_id_enabled: false }).eq("id", userId);
}

export async function unlockWithFaceId(): Promise<boolean> {
  const credIdB64 = localStorage.getItem(CRED_ID_KEY);
  if (!credIdB64) return false;

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: base64ToBuffer(credIdB64), type: "public-key" }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}
