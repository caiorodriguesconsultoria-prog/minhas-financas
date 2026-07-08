// Bloqueio local do app usando Face ID / Touch ID (via WebAuthn).
//
// IMPORTANTE: isso NÃO substitui o login do Supabase — é uma trava extra, só no dispositivo,
// que impede a tela de abrir sem a biometria. A sessão real continua sendo a do Supabase
// (Google/Magic Link). Não há verificação de assinatura no servidor; o navegador só libera
// o "unlock" depois de confirmar a biometria com o autenticador da plataforma (Face ID/Touch ID/
// Windows Hello), o que é suficiente para esse propósito de conveniência/privacidade local.

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

export async function enableFaceId(userEmail: string): Promise<void> {
  if (!isFaceIdSupported()) throw new Error("Este navegador/dispositivo não suporta Face ID / Touch ID.");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Minhas Finanças", id: window.location.hostname },
      user: { id: userId, name: userEmail, displayName: userEmail },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
    },
  }) as PublicKeyCredential | null;

  if (!credential) throw new Error("Não foi possível configurar o Face ID / Touch ID.");

  localStorage.setItem(CRED_ID_KEY, bufferToBase64(credential.rawId));
  localStorage.setItem(ENABLED_KEY, "1");
}

export function disableFaceId(): void {
  localStorage.removeItem(CRED_ID_KEY);
  localStorage.removeItem(ENABLED_KEY);
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
