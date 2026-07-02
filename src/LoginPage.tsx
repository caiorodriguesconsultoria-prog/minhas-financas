import { useState } from "react";
import { supabase } from "./supabase";

const S = `
  .lp-root { min-height: 100svh; background: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; padding-bottom: calc(40px + env(safe-area-inset-bottom)); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif; }
  .lp-icon-wrap { width: 84px; height: 84px; border-radius: 22px; background: linear-gradient(145deg,#007AFF,#0040CC); display: flex; align-items: center; justify-content: center; font-size: 40px; box-shadow: 0 12px 40px rgba(0,122,255,0.35); margin-bottom: 28px; animation: lpIconPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
  @keyframes lpIconPop { from { opacity:0; transform:scale(0.6); } to { opacity:1; transform:scale(1); } }
  .lp-title { font-size: 32px; font-weight: 700; letter-spacing: -0.8px; color: #1D1D1F; margin-bottom: 8px; animation: lpFadeUp 0.4s ease 0.1s both; }
  .lp-subtitle { font-size: 16px; color: #6E6E73; text-align: center; line-height: 1.4; margin-bottom: 44px; animation: lpFadeUp 0.4s ease 0.18s both; max-width: 280px; }
  @keyframes lpFadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .lp-form { width: 100%; max-width: 360px; animation: lpFadeUp 0.4s ease 0.26s both; }
  .lp-input { width: 100%; padding: 15px 18px; border: 1.5px solid #E5E5EA; border-radius: 14px; font-size: 16px; color: #1D1D1F; outline: none; background: #FAFAFA; margin-bottom: 12px; -webkit-appearance: none; transition: border-color 0.2s, background 0.2s; font-family: inherit; box-sizing: border-box; }
  .lp-input:focus { border-color: #007AFF; background: #FFF; }
  .lp-btn-primary { width: 100%; padding: 15px; background: #007AFF; color: #FFF; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; margin-bottom: 16px; font-family: inherit; transition: opacity 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .lp-btn-primary:disabled { opacity: 0.5; }
  .lp-btn-google { width: 100%; padding: 15px; background: #FFF; color: #1D1D1F; border: 1.5px solid #E5E5EA; border-radius: 14px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .lp-error { background: rgba(255,59,48,0.08); border: 1px solid rgba(255,59,48,0.18); border-radius: 12px; padding: 12px 16px; font-size: 14px; color: #C9352B; margin-bottom: 16px; }
  .lp-footer { margin-top: 32px; font-size: 12px; color: #AEAEB2; text-align: center; line-height: 1.5; }
  .lp-footer a { color: #007AFF; text-decoration: none; }
  .lp-sent-icon { width: 76px; height: 76px; border-radius: 50%; background: rgba(52,199,89,0.12); display: flex; align-items: center; justify-content: center; font-size: 36px; margin-bottom: 24px; }
  .lp-sent-title { font-size: 26px; font-weight: 700; color: #1D1D1F; margin-bottom: 10px; }
  .lp-sent-desc { font-size: 15px; color: #6E6E73; text-align: center; line-height: 1.5; max-width: 290px; margin-bottom: 36px; }
  .lp-sent-email { color: #1D1D1F; font-weight: 600; }
  .lp-spinner { width: 20px; height: 20px; border: 2.5px solid rgba(255,255,255,0.4); border-top-color: #FFF; border-radius: 50%; animation: lpSpin 0.8s linear infinite; }
  @keyframes lpSpin { to { transform: rotate(360deg); } }
  .lp-divider { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .lp-divider-line { flex: 1; height: 1px; background: #E5E5EA; }
  .lp-divider-text { font-size: 13px; color: #AEAEB2; font-weight: 500; }
  .lp-google-icon { width: 20px; height: 20px; flex-shrink: 0; }
`;

type Step = "form" | "sent";

export function LoginPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [step,    setStep]    = useState<Step>("form");
  const [error,   setError]   = useState<string | null>(null);

  async function handleMagicLink() {
    if (!email.trim()) { setError("Por favor, insira seu endereço de email."); return; }
    setLoading(true); setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (e) setError("Erro ao enviar o email. Tente novamente.");
    else setStep("sent");
  }

  async function handleGoogle() {
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (e) setError("Erro ao conectar com Google.");
  }

  if (step === "sent") return (
    <>
      <style>{S}</style>
      <div className="lp-root">
        <div className="lp-sent-icon">✉️</div>
        <div className="lp-sent-title">Email enviado!</div>
        <div className="lp-sent-desc">
          Clique no link enviado para <span
