import { useState } from "react";
import { supabase } from "./supabase";

const S = `
  @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&display=swap');
  .lp-root { min-height: 100svh; background: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; padding-bottom: calc(40px + env(safe-area-inset-bottom)); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif; }
  .lp-icon-wrap { width: 84px; height: 84px; border-radius: 22px; background: linear-gradient(145deg,#007AFF,#0040CC); display: flex; align-items: center; justify-content: center; font-size: 40px; box-shadow: 0 12px 40px rgba(0,122,255,0.35); margin-bottom: 28px; animation: lpIconPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
  @keyframes lpIconPop { from { opacity:0; transform:scale(0.6); } to { opacity:1; transform:scale(1); } }
  .lp-title { font-size: 32px; font-weight: 700; letter-spacing: -0.8px; color: #1D1D1F; margin-bottom: 8px; animation: lpFadeUp 0.4s ease 0.1s both; }
  .lp-subtitle { font-size: 16px; color: #6E6E73; text-align: center; line-height: 1.4; margin-bottom: 44px; animation: lpFadeUp 0.4s ease 0.18s both; max-width: 280px; }
  @keyframes lpFadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  .lp-form { width: 100%; max-width: 360px; animation: lpFadeUp 0.4s ease 0.26s both; }
  .lp-input { width: 100%; padding: 15px 18px; border: 1.5px solid #E5E5EA; border-radius: 14px; font-size: 16px; color: #1D1D1F; outline: none; background: #FAFAFA; margin-bottom: 12px; -webkit-appearance: none; transition: border-color 0.2s, background 0.2s; font-family: inherit; }
  .lp-input:focus { border-color: #007AFF; background: #FFF; }
  .lp-input::placeholder { color: #AEAEB2; }
  .lp-btn-primary { width: 100%; padding: 15px; background: #007AFF; color: #FFF; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; margin-bottom: 16px; font-family: inherit; transition: opacity 0.15s, transform 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .lp-btn-primary:disabled { opacity: 0.5; }
  .lp-btn-primary:not(:disabled):active { opacity: 0.82; transform: scale(0.99); }
  .lp-divider { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .lp-divider-line { flex: 1; height: 1px; background: #E5E5EA; }
  .lp-divider-text { font-size: 13px; color: #AEAEB2; font-weight: 500; white-space: nowrap; }
  .lp-btn-google { width: 100%; padding: 15px; background: #FFF; color: #1D1D1F; border: 1.5px solid #E5E5EA; border-radius: 14px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s, transform 0.15s; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .lp-btn-google:active { background: #F5F5F7; transform: scale(0.99); }
  .lp-google-icon { width: 20px; height: 20px; flex-shrink: 0; }
  .lp-error { background: rgba(255,59,48,0.08); border: 1px solid rgba(255,59,48,0.18); border-radius: 12px; padding: 12px 16px; font-size: 14px; color: #C9352B; margin-bottom: 16px; line-height: 1.4; animation: lpFadeUp 0.2s ease both; }
  .lp-footer { margin-top: 32px; font-size: 12px; color: #AEAEB2; text-align: center; line-height: 1.5; max-width: 300px; }
  .lp-footer a { color: #007AFF; text-decoration: none; }

  /* Sent screen */
  .lp-sent-icon { width: 76px; height: 76px; border-radius: 50%; background: rgba(52,199,89,0.12); display: flex; align-items: center; justify-content: center; font-size: 36px; margin-bottom: 24px; animation: lpIconPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
  .lp-sent-title { font-size: 26px; font-weight: 700; color: #1D1D1F; margin-bottom: 10px; }
  .lp-sent-desc { font-size: 15px; color: #6E6E73; text-align: center; line-height: 1.5; max-width: 290px; margin-bottom: 36px; }
  .lp-sent-email { color: #1D1D1F; font-weight: 600; }
  .lp-btn-secondary { background: transparent; border: none; color: #007AFF; font-size: 15px; font-weight: 600; cursor: pointer; padding: 12px; font-family: inherit; }
  .lp-spinner { width: 20px; height: 20px; border: 2.5px solid rgba(255,255,255,0.4); border-top-color: #FFF; border-radius: 50%; animation: lpSpin 0.8s linear infinite; flex-shrink: 0; }
  @keyframes lpSpin { to { transform: rotate(360deg); } }

  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`;

type Step = "form" | "sent";

export function LoginPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [step,    setStep]    = useState<Step>("form");
  const [error,   setError]   = useState<string | null>(null);

  async function handleMagicLink() {
    if (!email.trim()) { setError("Por favor, insira seu endereço de email."); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError("Email inválido. Tente novamente."); return; }
    setLoading(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    setLoading(false);
    if (e) {
      setError("Erro ao enviar o email. Verifique o endereço e tente novamente.");
    } else {
      setStep("sent");
    }
  }

  async function handleGoogle() {
    setGLoading(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (e) {
      setError("Erro ao conectar com o Google. Tente novamente.");
      setGLoading(false);
    }
    // On success the browser navigates away — no need to reset gLoading
  }

  if (step === "sent") {
    return (
      <>
        <style>{S}</style>
        <div className="lp-root">
          <div className="lp-sent-icon">✉️</div>
          <div className="lp-sent-title">Email enviado!</div>
          <div className="lp-sent-desc">
            Clique no link que enviamos para{" "}
            <span className="lp-sent-email">{email}</span>{" "}
            para entrar no app.
          </div>
          <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, color: "#6E6E73", textAlign: "center", padding: "0 16px", lineHeight: 1.5 }}>
              Não recebeu? Verifique a pasta de spam ou reenvie o link.
            </div>
            <button
              className="lp-btn-primary"
              style={{ marginTop: 8 }}
              onClick={() => { setStep("form"); setLoading(false); }}
              disabled={false}
            >
              Reenviar ou usar outro email
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{S}</style>
      <div className="lp-root">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{marginBottom:20}}>
          <rect width="64" height="64" rx="16" fill="#1D1D1F"/>
          <path d="M17 40L25 31L32 37L46 21" stroke="#34C759" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M38 21H46V29" stroke="#34C759" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div className="lp-title" style={{fontFamily:"'Quicksand', -apple-system, sans-serif",fontWeight:500}}>
          Minhas <strong style={{fontWeight:700}}>Finanças</strong>
        </div>
        <div className="lp-subtitle">Controle seus gastos com <strong style={{fontWeight:600,color:"#1D1D1F"}}>inteligência</strong> e simplicidade.</div>

        <div className="lp-form">
          {error && <div className="lp-error">{error}</div>}

          <input
            className="lp-input"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null); }}
            onKeyDown={e => e.key === "Enter" && handleMagicLink()}
          />

          <button className="lp-btn-primary" onClick={handleMagicLink} disabled={loading || gLoading}>
            {loading ? <><div className="lp-spinner" /> Enviando link…</> : "✉️  Entrar com Magic Link"}
          </button>

          <div className="lp-divider">
            <div className="lp-divider-line" />
            <div className="lp-divider-text">ou continue com</div>
            <div className="lp-divider-line" />
          </div>

          <button className="lp-btn-google" onClick={handleGoogle} disabled={loading || gLoading}>
            {gLoading ? (
              <><div className="lp-spinner" style={{ borderColor: "rgba(0,0,0,0.15)", borderTopColor: "#1D1D1F" }} /> Aguarde…</>
            ) : (
              <>
                <svg className="lp-google-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar com Google
              </>
            )}
          </button>
        </div>

        <div className="lp-footer">
          Ao entrar, você concorda com os nossos{" "}
          <a href="#">Termos de Uso</a> e{" "}
          <a href="#">Política de Privacidade</a>.
        </div>
      </div>
    </>
  );
}
