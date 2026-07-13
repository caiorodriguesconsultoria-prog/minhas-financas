import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { User } from "@supabase/supabase-js";
import { supabase, normaliseTx, normaliseAccount } from "./supabase";
import type { Profile, Account, Transaction, BillToPay, Couple, Investimento, InvestimentoLancamento, SimulacaoCompra, PlanejamentoMensal } from "./supabase";
import { LoginPage } from "./LoginPage";
import { connectGoogleCalendar, disconnectGoogleCalendar, syncBillToCalendar, restoreGoogleCalendarFromServer, hasGoogleCalendarRefreshToken } from "./googleCalendar";
import { isFaceIdSupported, isFaceIdEnabled, enableFaceId, disableFaceId, unlockWithFaceId, restoreFaceIdFromServer } from "./faceIdLock";

// Atualiza os dados automaticamente sempre que o app volta a ficar visível
// (ex: trocou de app e voltou, destravou o celular, reabriu depois de um tempo).
function useRefetchOnFocus(callback: () => void) {
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") callback();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html { -webkit-text-size-adjust: 100%; }
  body { background: #F5F5F7; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif; color: #1D1D1F; overscroll-behavior: none; }
  .logo-header, .seg-title, .card-balance, .summary-value, .section-title { font-family: 'Quicksand', -apple-system, sans-serif; }
  .app { width: 100%; max-width: 430px; margin: 0 auto; min-height: 100svh; background: #FFFFFF; position: relative; overflow-x: hidden; }
  @media (min-width: 768px)  { .app { max-width: 768px; } }
  @media (min-width: 1024px) { .app { max-width: 1024px; } }

  /* Header */
  .seg-wrap { background: #FFFFFF; padding: 16px 16px 0; position: sticky; top: 0; z-index: 100; border-bottom: 1px solid rgba(0,0,0,0.06); }
  .seg-title { font-size: clamp(22px,6vw,28px); font-weight: 700; letter-spacing: -0.5px; margin-bottom: 12px; }
  .seg-ctrl { display: flex; background: #F5F5F7; border-radius: 10px; padding: 3px; gap: 2px; margin-bottom: 12px; }
  .seg-btn { flex: 1; padding: 7px 2px; border: none; background: transparent; border-radius: 8px; font-size: clamp(11px,3vw,13px); font-weight: 500; color: #6E6E73; cursor: pointer; transition: all 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .seg-btn.active { background: #FFF; color: #1D1D1F; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.12); }

  /* Summary bar */
  .summary-bar { display: flex; padding: 14px 12px; background: #FFF; border-bottom: 1px solid rgba(0,0,0,0.06); }
  .summary-item { flex: 1; text-align: center; min-width: 0; }
  .summary-item + .summary-item { border-left: 1px solid rgba(0,0,0,0.08); }
  .summary-label { font-size: 10px; color: #6E6E73; font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px; }
  .summary-value { font-size: clamp(13px,3.8vw,18px); font-weight: 700; letter-spacing: -0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .income { color: #34C759; }
  .expense { color: #FF3B30; }

  /* Page transition */
  .page-fade { animation: pageFadeIn 0.22s ease both; will-change: opacity,transform; }
  @keyframes pageFadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes modalBackdropIn { from { opacity:0; } to { opacity:1; } }
  @keyframes modalSheetIn { from { opacity:0; transform:scale(0.92) translateY(14px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .modal-backdrop { animation: modalBackdropIn 0.2s ease both; }
  .modal-sheet-center { animation: modalSheetIn 0.32s cubic-bezier(0.32,0.94,0.6,1) both; }

  /* Scroll area */
  .scroll-content { padding: 20px 16px; padding-bottom: calc(100px + env(safe-area-inset-bottom)); -webkit-overflow-scrolling: touch; }

  /* Sections */
  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; margin-top: 4px; }
  .section-title  { font-size: 17px; font-weight: 600; }
  .section-link   { font-size: 14px; color: #007AFF; font-weight: 500; cursor: pointer; }

  /* Account cards */
  .cards-scroll { display: flex; gap: 12px; overflow-x: auto; padding: 2px 4px 6px 2px; -webkit-overflow-scrolling: touch; scrollbar-width: none; scroll-snap-type: x proximity; touch-action: pan-x; }
  .cards-scroll::-webkit-scrollbar { display: none; }
  .account-card { min-width: 150px; flex-shrink: 0; border-radius: 20px; padding: 16px 14px; cursor: pointer; scroll-snap-align: start; transition: transform 0.18s cubic-bezier(0.34,1.2,0.64,1); }
  .account-card:active { transform: scale(0.96); }
  .card-nubank   { background: linear-gradient(135deg,#8A05BE,#6B21A8); color:#FFF; }
  .card-inter    { background: linear-gradient(135deg,#FF6B00,#E55100); color:#FFF; }
  .card-itau     { background: linear-gradient(135deg,#EC7000,#003087); color:#FFF; }
  .card-bradesco { background: linear-gradient(135deg,#CC092F,#8B0000); color:#FFF; }
  .card-caixa    { background: linear-gradient(135deg,#0066CC,#004999); color:#FFF; }
  .card-bb       { background: linear-gradient(135deg,#F7D117,#E5B800); color:#1D1D1F; }
  .card-total    { background: linear-gradient(135deg,#007AFF,#0055D4); color:#FFF; }
  .card-bank-name { font-size: 11px; font-weight: 600; opacity: 0.8; letter-spacing: 0.3px; margin-bottom: 10px; text-transform: uppercase; }
  .card-balance   { font-size: clamp(17px,4.5vw,22px); font-weight: 700; letter-spacing: -0.5px; margin-bottom: 6px; }
  .card-label     { font-size: 11px; opacity: 0.75; font-weight: 500; }
  .card-icon      { font-size: 22px; margin-bottom: 8px; }
  .card-enter { animation: cardSlideIn 0.38s cubic-bezier(0.34,1.2,0.64,1) both; will-change: transform,opacity; }
  @keyframes cardSlideIn { from { opacity:0; transform:translateX(20px) scale(0.95); } to { opacity:1; transform:translateX(0) scale(1); } }

  /* Bar chart */
  .summary-card { background: #F5F5F7; border-radius: 20px; padding: 18px 16px; margin-bottom: 22px; }
  .chart-bars { display: flex; align-items: flex-end; gap: 6px; height: 80px; margin: 14px 0 8px; }
  .chart-bar-wrap { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; height:100%; }
  .chart-month { font-size: 10px; color: #6E6E73; font-weight: 500; }
  .bar-income  { flex:1; border-radius:4px 4px 0 0; background:rgba(52,199,89,0.30); min-height:4px; transform-origin:bottom; }
  .bar-expense { flex:1; border-radius:4px 4px 0 0; background:#FF3B30; opacity:0.8; min-height:4px; transform-origin:bottom; }
  .bar-animate { animation: barGrow 0.55s cubic-bezier(0.34,1.1,0.64,1) both; will-change: transform; }
  @keyframes barGrow { from { transform:scaleY(0); opacity:0; } to { transform:scaleY(1); opacity:1; } }

  /* Transactions */
  .tx-group-header { font-size: 12px; font-weight: 600; color: #6E6E73; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  .tx-item { display:flex; align-items:center; gap:12px; padding:12px 14px; background:#FFF; border-radius:14px; margin-bottom:8px; box-shadow:0 1px 3px rgba(0,0,0,0.06); transition:transform 0.15s cubic-bezier(0.34,1.2,0.64,1); cursor:pointer; will-change:transform; }
  .tx-item:active { transform: scale(0.985); }
  .tx-icon  { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:19px; flex-shrink:0; }
  .tx-info  { flex:1; min-width:0; }
  .tx-name  { font-size:15px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .tx-category { font-size:12px; color:#6E6E73; margin-top:2px; }
  .tx-right { text-align:right; flex-shrink:0; }
  .tx-value { font-size:14px; font-weight:700; }
  .tx-date  { font-size:11px; color:#6E6E73; margin-top:2px; }
  .tx-enter { animation:txFadeUp 0.3s ease both; will-change:transform,opacity; }
  @keyframes txFadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }

  /* Bills */
  .bill-item { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:#FFF; border-radius:14px; margin-bottom:8px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
  .bill-name  { font-size:14px; font-weight:600; }
  .bill-date  { font-size:11px; color:#6E6E73; margin-top:2px; }
  .bill-amount { font-size:14px; font-weight:700; color:#FF3B30; }
  .bill-paid  { font-size:11px; color:#34C759; font-weight:600; }

  /* Empty state */
  .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; gap:10px; }
  .empty-icon  { font-size:44px; }
  .empty-title { font-size:16px; font-weight:600; }
  .empty-desc  { font-size:13px; color:#6E6E73; text-align:center; }

  /* Loading spinner */
  .spinner-wrap { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; gap:16px; }
  .spinner { width:36px; height:36px; border:3px solid #E5E5EA; border-top-color:#007AFF; border-radius:50%; animation:spin 0.8s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes modalOverlayFade { from { opacity:0; } to { opacity:1; } }
  @keyframes modalSheetPop { from { opacity:0; transform:scale(0.94) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
  .modal-overlay-anim { animation: modalOverlayFade 0.22s cubic-bezier(0.22,1,0.36,1) both; }
  .modal-sheet-anim { animation: modalSheetPop 0.28s cubic-bezier(0.22,1,0.36,1) both; }
  .spinner-text { font-size:14px; color:#6E6E73; }

  /* Toast / error banner */
  .toast { position:fixed; top:calc(80px + env(safe-area-inset-top)); left:50%; transform:translateX(-50%); z-index:400; background:#FF3B30; color:#FFF; padding:12px 20px; border-radius:14px; font-size:14px; font-weight:600; max-width:360px; text-align:center; box-shadow:0 4px 20px rgba(255,59,48,0.35); animation:toastIn 0.3s cubic-bezier(0.34,1.2,0.64,1) both; }
  .toast.success { background:#34C759; }
  @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(-12px) scale(0.94); } to { opacity:1; transform:translateX(-50%) translateY(0) scale(1); } }

  /* FAB */
  .fab-overlay { position:fixed; inset:0; z-index:199; background:rgba(0,0,0,0); pointer-events:none; transition:background 0.28s, backdrop-filter 0.28s; }
  .fab-overlay.open { background:rgba(0,0,0,0.38); pointer-events:all; backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }
  .fab-container { position:fixed; bottom:calc(88px + env(safe-area-inset-bottom)); right:22px; z-index:200; display:flex; flex-direction:column; align-items:flex-end; gap:12px; }
  .fab-actions { display:flex; flex-direction:column; gap:10px; align-items:flex-end; }
  .fab-action { display:flex; align-items:center; gap:10px; opacity:0; transform:translateY(16px) scale(0.82); transition:opacity 0.24s cubic-bezier(0.34,1.56,0.64,1), transform 0.24s cubic-bezier(0.34,1.56,0.64,1); pointer-events:none; will-change:transform,opacity; }
  .fab-action.visible { opacity:1; transform:translateY(0) scale(1); pointer-events:all; }
  .fab-action:nth-child(1).visible { transition-delay:0.06s; }
  .fab-action:nth-child(2).visible { transition-delay:0.03s; }
  .fab-action:nth-child(3).visible { transition-delay:0s; }
  .fab-action-label { background:#FFF; color:#1D1D1F; font-size:14px; font-weight:600; padding:8px 16px; border-radius:20px; box-shadow:0 4px 16px rgba(0,0,0,0.16); white-space:nowrap; cursor:pointer; }
  .fab-action-btn { width:44px; height:44px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:20px; box-shadow:0 4px 14px rgba(0,0,0,0.18); flex-shrink:0; transition:transform 0.15s cubic-bezier(0.34,1.56,0.64,1); }
  .fab-action-btn:active { transform:scale(0.9); }
  .fab-main { width:56px; height:56px; border-radius:50%; background:#007AFF; border:none; color:#FFF; font-size:26px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 22px rgba(0,122,255,0.42); transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1), background 0.22s; will-change:transform; }
  .fab-main.open { transform:rotate(45deg); background:#FF3B30; }
  .fab-main:active { transform:scale(0.93); }
  .fab-main.open:active { transform:rotate(45deg) scale(0.93); }

  /* Bottom nav */
  .bottom-nav { position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:430px; background:rgba(255,255,255,0.88); -webkit-backdrop-filter:blur(24px); backdrop-filter:blur(24px); border-top:1px solid rgba(0,0,0,0.08); display:flex; z-index:150; padding:10px 0; padding-bottom:calc(10px + env(safe-area-inset-bottom)); }
  @media (min-width:768px)  { .bottom-nav { max-width:768px; } }
  @media (min-width:1024px) { .bottom-nav { max-width:1024px; } }
  .nav-item { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; cursor:pointer; padding:4px 0; transition:opacity 0.15s; }
  .nav-item:active { opacity:0.55; }
  .nav-icon  { font-size:22px; }
  .nav-label { font-size:10px; font-weight:500; color:#6E6E73; transition:color 0.18s; }
  .nav-item.active .nav-label { color:#007AFF; }

  /* Badges */
  .badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:20px; font-size:11px; font-weight:600; }
  .badge-income   { background:rgba(52,199,89,0.12);  color:#1EA446; }
  .badge-expense  { background:rgba(255,59,48,0.10);  color:#C9352B; }
  .badge-pix      { background:rgba(0,199,190,0.13);  color:#007B75; }
  .badge-credito  { background:rgba(88,86,214,0.12);  color:#3D3BAD; }
  .badge-debito   { background:rgba(0,122,255,0.12);  color:#0055D4; }
  .badge-dinheiro { background:rgba(52,199,89,0.12);  color:#1EA446; }
  .badge-teddoc   { background:rgba(255,149,0,0.12);  color:#C97800; }
  .badge-escopo-familiar  { background:rgba(255,149,0,0.12);  color:#C97800; }
  .badge-escopo-lazer     { background:rgba(88,86,214,0.12);  color:#3D3BAD; }
  .badge-escopo-pessoal   { background:rgba(0,122,255,0.12);  color:#0055D4; }
  .badge-escopo-revenda   { background:rgba(52,199,89,0.12);  color:#1EA446; }

  /* Payment method segmented selector */
  .pay-seg { display:flex; gap:6px; overflow-x:auto; padding:2px 0 6px; scrollbar-width:none; }
  .pay-seg::-webkit-scrollbar { display:none; }
  .pay-seg-btn { flex-shrink:0; padding:7px 14px; border-radius:20px; border:1.5px solid #E5E5EA; background:transparent; font-size:13px; font-weight:600; color:#6E6E73; cursor:pointer; transition:all 0.18s; white-space:nowrap; }
  .pay-seg-btn.active { border-color:transparent; color:#FFF; }

  /* Modal */
  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.42); z-index:300; display:flex; align-items:flex-end; justify-content:center; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); animation:overlayFadeIn 0.2s ease both; }
  @keyframes overlayFadeIn { from { opacity:0; } to { opacity:1; } }
  .modal-sheet { background:#FFF; border-radius:24px 24px 0 0; padding:24px 20px; padding-bottom:calc(32px + env(safe-area-inset-bottom)); width:100%; max-width:430px; max-height:90svh; overflow-y:auto; animation:sheetSlideUp 0.32s cubic-bezier(0.32,1,0.64,1) both; will-change:transform; }
  @keyframes sheetSlideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
  .modal-handle { width:36px; height:4px; background:#E5E5EA; border-radius:2px; margin:0 auto 20px; }
  .modal-title  { font-size:20px; font-weight:700; margin-bottom:20px; }
  .form-field   { margin-bottom:16px; }
  .form-label   { font-size:12px; font-weight:600; color:#6E6E73; margin-bottom:6px; display:block; text-transform:uppercase; letter-spacing:0.4px; }
  .form-input   { width:100%; padding:12px 14px; border:1.5px solid #E5E5EA; border-radius:12px; font-size:15px; color:#1D1D1F; outline:none; transition:border-color 0.2s; background:#FAFAFA; -webkit-appearance:none; }
  .form-input:focus { border-color:#007AFF; background:#FFF; }
  .form-row     { display:flex; gap:10px; }
  .btn-primary  { width:100%; padding:14px; background:#007AFF; color:#FFF; border:none; border-radius:14px; font-size:16px; font-weight:700; cursor:pointer; margin-top:8px; transition:opacity 0.15s,transform 0.15s; }
  .btn-primary:disabled { opacity:0.55; }
  .btn-primary:not(:disabled):active { opacity:0.82; transform:scale(0.99); }
  .type-toggle  { display:flex; gap:10px; }
  .type-btn     { flex:1; padding:10px; border-radius:12px; border:2px solid #E5E5EA; background:transparent; font-size:14px; font-weight:600; cursor:pointer; transition:all 0.2s; color:#6E6E73; }
  .type-btn.income  { border-color:#34C759; background:rgba(52,199,89,0.08);  color:#1EA446; }
  .type-btn.expense { border-color:#FF3B30; background:rgba(255,59,48,0.08);  color:#C9352B; }

  /* Relatórios */
  .report-period-ctrl { display:flex; background:#F5F5F7; border-radius:10px; padding:3px; gap:2px; margin-bottom:22px; }
  .report-period-btn  { flex:1; padding:7px 4px; border:none; background:transparent; border-radius:8px; font-size:13px; font-weight:500; color:#6E6E73; cursor:pointer; transition:all 0.2s; }
  .report-period-btn.active { background:#FFF; color:#1D1D1F; font-weight:600; box-shadow:0 1px 3px rgba(0,0,0,0.12); }

  /* Donut */
  .legend-grid  { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:18px; }
  @media (max-width:360px) { .legend-grid { grid-template-columns:1fr; } }
  .legend-item  { display:flex; align-items:center; gap:8px; cursor:pointer; transition:opacity 0.2s; }
  .legend-dot   { width:10px; height:10px; border-radius:3px; flex-shrink:0; }
  .legend-label { font-size:12px; color:#6E6E73; font-weight:500; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .legend-pct   { font-size:12px; font-weight:700; }
  .seg-draw { animation:segDraw 0.6s cubic-bezier(0.34,1.1,0.64,1) both; will-change:opacity,transform; }
  @keyframes segDraw { from { opacity:0; transform-origin:90px 90px; transform:scale(0.7); } to { opacity:1; transform-origin:90px 90px; transform:scale(1); } }
  .donut-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; }
  .donut-center-value { font-size:16px; font-weight:700; letter-spacing:-0.3px; }
  .donut-center-label { font-size:11px; color:#6E6E73; font-weight:500; text-align:center; max-width:68px; }

  /* Hbar */
  .hbar-row    { margin-bottom:16px; }
  .hbar-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
  .hbar-name   { font-size:14px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .hbar-value  { font-size:13px; font-weight:700; color:#FF3B30; flex-shrink:0; margin-left:8px; }
  .hbar-track  { height:8px; background:#EBEBF0; border-radius:99px; overflow:hidden; }
  .hbar-fill   { height:100%; border-radius:99px; width:0; transition:width 0.65s cubic-bezier(0.34,1.1,0.64,1); will-change:width; }
  .hbar-sub    { font-size:11px; color:#6E6E73; margin-top:3px; }

  @media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:0.01ms !important; transition-duration:0.01ms !important; } }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: [string, { icon: string; bg: string }][] = [
  ["pix",          { icon: "💸", bg: "#E3F2FD" }],
  ["transferência",{ icon: "💸", bg: "#E3F2FD" }],
  ["transferencia",{ icon: "💸", bg: "#E3F2FD" }],
  ["salário",      { icon: "💼", bg: "#E3F9E5" }],
  ["salario",      { icon: "💼", bg: "#E3F9E5" }],
  ["renda",        { icon: "💰", bg: "#E3F9E5" }],
  ["investimento", { icon: "📈", bg: "#E3F9E5" }],
  ["rendimento",   { icon: "📈", bg: "#E3F9E5" }],
  ["aliment",      { icon: "🛒", bg: "#FFF3E0" }],
  ["ifood",        { icon: "🍱", bg: "#FFF3E0" }],
  ["restaurante",  { icon: "🍽️", bg: "#FFF3E0" }],
  ["mercado",      { icon: "🛒", bg: "#FFF3E0" }],
  ["moradia",      { icon: "🏠", bg: "#E3F2FD" }],
  ["aluguel",      { icon: "🏠", bg: "#E3F2FD" }],
  ["luz",          { icon: "⚡️", bg: "#FFF9C4" }],
  ["energia",      { icon: "⚡️", bg: "#FFF9C4" }],
  ["água",         { icon: "💧", bg: "#E3F2FD" }],
  ["agua",         { icon: "💧", bg: "#E3F2FD" }],
  ["saúde",        { icon: "💊", bg: "#E8F5E9" }],
  ["saude",        { icon: "💊", bg: "#E8F5E9" }],
  ["farmácia",     { icon: "💊", bg: "#E8F5E9" }],
  ["farmacia",     { icon: "💊", bg: "#E8F5E9" }],
  ["academia",     { icon: "🏋️", bg: "#E8F5E9" }],
  ["plano",        { icon: "🏥", bg: "#FCE4EC" }],
  ["transporte",   { icon: "🚗", bg: "#EDE7F6" }],
  ["uber",         { icon: "🚗", bg: "#EDE7F6" }],
  ["streaming",    { icon: "🎬", bg: "#FCE4EC" }],
  ["netflix",      { icon: "🎬", bg: "#FCE4EC" }],
  ["spotify",      { icon: "🎵", bg: "#E8F5E9" }],
  ["beleza",       { icon: "💅", bg: "#FCE4EC" }],
  ["compras",      { icon: "🛍️", bg: "#EDE7F6" }],
  ["educação",     { icon: "📚", bg: "#E3F2FD" }],
  ["educacao",     { icon: "📚", bg: "#E3F2FD" }],
  ["lazer",        { icon: "🎮", bg: "#F3E5F5" }],
  ["viagem",       { icon: "✈️", bg: "#E1F5FE" }],
];

function getCategoryStyle(category: string): { icon: string; bg: string } {
  const key = (category ?? "").toLowerCase();
  for (const [k, v] of CATEGORY_ICONS) {
    if (key.includes(k)) return v;
  }
  return { icon: "💳", bg: "#F5F5F7" };
}

function getCardClass(name: string) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("nubank"))               return "card-nubank";
  if (n.includes("inter"))               return "card-inter";
  if (n.includes("itaú") || n.includes("itau")) return "card-itau";
  if (n.includes("bradesco"))            return "card-bradesco";
  if (n.includes("caixa"))               return "card-caixa";
  if (n.includes("brasil") || n.includes(" bb")) return "card-bb";
  return "card-total";
}

function getCardIcon(name: string) {
  const n = (name ?? "").toLowerCase();
  if (n.includes("nubank"))   return "💜";
  if (n.includes("inter"))   return "🟠";
  if (n.includes("itaú") || n.includes("itau")) return "🔵";
  if (n.includes("bradesco")) return "🔴";
  if (n.includes("caixa") || n.includes("cef")) return "🟦";
  if (n.includes("santander")) return "🔴";
  if (n.includes("c6"))       return "⚫";
  if (n.includes("xp"))       return "⬛";
  return "🏦";
}

function getCardInitials(name: string): string {
  const n = (name ?? "").trim();
  if (!n) return "?";
  const clean = n.toLowerCase();
  if (clean.includes("nubank")) return "Nu";
  if (clean.includes("itaú") || clean.includes("itau")) return "It";
  if (clean.includes("bradesco")) return "Bra";
  if (clean.includes("santander")) return "San";
  if (clean.includes("caixa") || clean.includes("cef")) return "CX";
  if (clean.includes("brasil") || clean === "bb" || clean.includes(" bb")) return "BB";
  if (clean.includes("inter")) return "In";
  if (clean.includes("c6")) return "C6";
  if (clean.includes("xp")) return "XP";
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

function getCardColor(name: string): string {
  const n = (name ?? "").toLowerCase();
  if (n.includes("nubank"))   return "#8A05BE";
  if (n.includes("inter"))    return "#FF6B00";
  if (n.includes("itaú") || n.includes("itau")) return "#EC7000";
  if (n.includes("bradesco")) return "#CC092F";
  if (n.includes("caixa") || n.includes("cef")) return "#0066CC";
  if (n.includes("brasil") || n.includes(" bb")) return "#F7D117";
  if (n.includes("santander")) return "#EC0000";
  if (n.includes("c6")) return "#1D1D1F";
  if (n.includes("xp")) return "#1D1D1F";
  const palette = ["#007AFF","#34C759","#FF9500","#AF52DE","#5AC8FA","#FF2D55"];
  let hash = 0;
  for (const c of n) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function getCardTextColor(name: string): string {
  const n = (name ?? "").toLowerCase();
  if (n.includes("brasil") || n.includes(" bb")) return "#1D1D1F";
  return "#FFFFFF";
}

const formatBRL = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatDatePT(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + (dateStr.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function groupByMonth(txs: ReturnType<typeof normaliseTx>[]) {
  const g: Record<string, typeof txs> = {};
  for (const t of txs) {
    const d = new Date(t.date + (t.date.length === 10 ? "T00:00:00" : ""));
    const key = isNaN(d.getTime())
      ? "Data desconhecida"
      : d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    if (!g[key]) g[key] = [];
    g[key].push(t);
  }
  return g;
}

const PIE_COLORS = ["#FF3B30","#FF9500","#FFCC00","#34C759","#007AFF","#5856D6","#AF52DE","#FF2D55","#00C7BE"];

function buildPieSegments(data: { label: string; value: number; color: string }[]) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = 70, cx = 90, cy = 90, circ = 2 * Math.PI * R;
  let cum = 0;
  return data.map((d) => {
    const pct = d.value / total;
    const len = pct * circ;
    const rotation = -90 + (cum / total) * 360;
    cum += d.value;
    return { ...d, pct, len, gap: circ - len, rotation, cx, cy, R, circ };
  });
}

// ─── Data hook ───────────────────────────────────────────────────────────────

type NormTx      = ReturnType<typeof normaliseTx>;
type NormAccount = ReturnType<typeof normaliseAccount>;

type ViewType = "geral" | "eu" | "esposa";

interface FinanceData {
  accounts: NormAccount[];
  transactions: NormTx[];
  bills: BillToPay[];
  profiles: Profile[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useFinanceData(view: ViewType, userId: string | null, partnerUserId: string | null): FinanceData {
  const [accounts,     setAccounts]     = useState<NormAccount[]>([]);
  const [transactions, setTransactions] = useState<NormTx[]>([]);
  const [bills,        setBills]        = useState<BillToPay[]>([]);
  const [profiles,     setProfiles]     = useState<Profile[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const tick = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const run = ++tick.current;

    try {
      // Build accounts query based on view
      let accQuery = supabase.from("accounts").select("*");
      if (view === "eu" && userId) {
        accQuery = accQuery.eq("user_id", userId);
      } else if (view === "esposa" && partnerUserId) {
        accQuery = accQuery.eq("user_id", partnerUserId);
      } else if (view === "geral" && userId && partnerUserId) {
        accQuery = accQuery.in("user_id", [userId, partnerUserId]);
      } else if (view === "geral" && userId) {
        accQuery = accQuery.eq("user_id", userId);
      }

      // Fetch profiles, accounts, bills in parallel
      const [profRes, accRes, billRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        accQuery,
        supabase.from("bills_to_pay").select("*").order("data_vencimento", { ascending: true }).limit(100),
      ]);

      if (run !== tick.current) return;

      if (profRes.error) throw new Error(profRes.error.message);
      if (accRes.error)  throw new Error(accRes.error.message);
      // bills errors are non-fatal
      const rawProfiles = (profRes.data ?? []) as Profile[];
      setProfiles(rawProfiles);
      setAccounts((accRes.data ?? []).map(a => normaliseAccount(a as Account)));
      setBills((billRes.data ?? []) as BillToPay[]);

      // Build transaction query with user filter
      let txQuery = supabase
        .from("transactions")
        .select("*")
        .order("data_transacao", { ascending: false })
        .order("created_at",     { ascending: false })
        .limit(200);

      if (view === "eu" && userId) {
        txQuery = txQuery.eq("user_id", userId);
      } else if (view === "esposa") {
        if (partnerUserId) {
          txQuery = txQuery.eq("user_id", partnerUserId);
        } else if (rawProfiles.length > 0) {
          const esposa = rawProfiles.find(p => (p.nome ?? "").toLowerCase().includes("esposa"));
          if (esposa) txQuery = txQuery.eq("user_id", esposa.id);
        }
      } else if (view === "geral" && userId && partnerUserId) {
        txQuery = txQuery.in("user_id", [userId, partnerUserId]);
      } else if (view === "geral" && userId) {
        txQuery = txQuery.eq("user_id", userId);
      }

      const txRes = await txQuery;
      if (run !== tick.current) return;
      if (txRes.error) throw new Error(txRes.error.message);

      setTransactions((txRes.data ?? []).map(t => normaliseTx(t as Transaction)));
    } catch (e: unknown) {
      if (run !== tick.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes("row-level security") || msg.includes("42501")) {
        setError("Acesso negado pelo banco de dados. Configure as políticas de segurança (RLS) no Supabase para permitir leitura.");
      } else if (msg.toLowerCase().includes("networkerror") || msg.toLowerCase().includes("failed to fetch")) {
        setError("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
      } else {
        setError(`Erro ao carregar dados: ${msg}`);
      }
    } finally {
      if (run === tick.current) setLoading(false);
    }
  }, [view, userId, partnerUserId]);

  useEffect(() => { load(); }, [load]);

  useRefetchOnFocus(load);

  return { accounts, transactions, bills, profiles, loading, error, refetch: load };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      <div className="spinner-text">{label}</div>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-desc">{desc}</div>
    </div>
  );
}

function Toast({ msg, type, onDone }: { msg: string; type: "error" | "success"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3600);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className={`toast${type === "success" ? " success" : ""}`}>{msg}</div>;
}

function DonutChart({ segments, selected, onSelect, total }: {
  segments: ReturnType<typeof buildPieSegments>;
  selected: number | null;
  onSelect: (i: number | null) => void;
  total: number;
}) {
  const sel = selected !== null ? segments[selected] : null;
  return (
    <div style={{ position: "relative", width: 180, height: 180, margin: "0 auto" }}>
      <svg width="180" height="180" viewBox="0 0 180 180" style={{ overflow: "visible" }}>
        {segments.map((seg, i) => (
          <circle
            key={i}
            className="seg-draw"
            cx={seg.cx} cy={seg.cy} r={seg.R}
            fill="none"
            stroke={seg.color}
            strokeWidth={selected === i ? 22 : 18}
            strokeDasharray={`${seg.len} ${seg.gap}`}
            transform={`rotate(${seg.rotation} ${seg.cx} ${seg.cy})`}
            style={{ cursor:"pointer", transition:"stroke-width 0.22s,opacity 0.22s", opacity: selected !== null && selected !== i ? 0.3 : 1, animationDelay:`${i * 0.07}s` }}
            onClick={() => onSelect(selected === i ? null : i)}
          />
        ))}
        <circle cx="90" cy="90" r="51" fill="#F5F5F7" />
      </svg>
      <div className="donut-center">
        {sel ? (
          <>
            <div className="donut-center-value">{Math.round(sel.pct * 100)}%</div>
            <div className="donut-center-label">{sel.label}</div>
          </>
        ) : (
          <>
            <div className="donut-center-value">{formatBRL(total)}</div>
            <div className="donut-center-label">Total Despesas</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Relatórios page ──────────────────────────────────────────────────────────

const CHART_DATA_FALLBACK = [
  { month: "Jan", income: 9200,  expense: 6800 },
  { month: "Fev", income: 8800,  expense: 7200 },
  { month: "Mar", income: 10500, expense: 6500 },
  { month: "Abr", income: 9100,  expense: 7800 },
  { month: "Mai", income: 9812,  expense: 7250 },
  { month: "Jun", income: 9700,  expense: 892  },
];

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function filterByPeriod(txs: NormTx[], period: "mes"|"trim"|"ano", refMonthKey?: string): NormTx[] {
  const now = refMonthKey ? new Date(refMonthKey + "-01T12:00:00") : new Date();
  return txs.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date + "T12:00:00");
    if (period === "mes")  return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
    if (period === "trim") {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth()-2, 1);
      return d >= threeMonthsAgo && d <= now;
    }
    return d.getFullYear() === now.getFullYear();
  });
}

function buildMonthlyFlow(txs: NormTx[]): {month:string;income:number;expense:number}[] {
  const now = new Date();
  return Array.from({length:6},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
    const m = d.getMonth(); const y = d.getFullYear();
    const slice = txs.filter(t=>{
      if (!t.date) return false;
      const td = new Date(t.date + "T12:00:00");
      return td.getMonth()===m && td.getFullYear()===y;
    });
    return {
      month: MONTH_NAMES[m],
      income:  slice.filter(t=>t.type==="income").reduce((s,t)=>s+t.value,0),
      expense: slice.filter(t=>t.type==="expense").reduce((s,t)=>s+t.value,0),
    };
  });
}

function RelatoriosPage({ transactions, bills, loading }: { transactions: NormTx[]; bills: BillToPay[]; loading: boolean }) {
  const [period, setPeriod] = useState<"mes"|"trim"|"ano">("mes");
  const [slice,  setSlice]  = useState<number|null>(null);
  const [ready,  setReady]  = useState(false);
  const [tab,    setTab]    = useState<"despesas"|"receitas"|"fluxo"|"pix">("despesas");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  useEffect(() => { const t = setTimeout(() => setReady(true), 80); return () => clearTimeout(t); }, []);

  const filtered     = filterByPeriod(transactions, period, period==="mes"?selectedMonth:undefined);
  const expenses     = filtered.filter(t=>t.type==="expense");
  const incomes      = filtered.filter(t=>t.type==="income");
  const totalExpense = expenses.reduce((s,t)=>s+t.value,0);
  const totalIncome  = incomes.reduce((s,t)=>s+t.value,0);
  const saldo        = totalIncome - totalExpense;

  // Mapa de categorias — despesas
  const catMapExp: Record<string,number> = {};
  for (const t of expenses) catMapExp[t.category] = (catMapExp[t.category]??0) + t.value;
  const catEntriesExp = Object.entries(catMapExp).sort((a,b)=>b[1]-a[1])
    .map(([label,value],i)=>({label,value,color:PIE_COLORS[i%PIE_COLORS.length]}));

  // Mapa de categorias — receitas
  const catMapInc: Record<string,number> = {};
  for (const t of incomes) catMapInc[t.category] = (catMapInc[t.category]??0) + t.value;
  const catEntriesInc = Object.entries(catMapInc).sort((a,b)=>b[1]-a[1])
    .map(([label,value],i)=>({label,value,color:PIE_COLORS[i%PIE_COLORS.length]}));

  const segExp = buildPieSegments(catEntriesExp);
  const segInc = buildPieSegments(catEntriesInc);

  // Top Pix
  const pixMap: Record<string,{total:number;count:number}> = {};
  for (const t of filtered) {
    if (t.beneficiario_real) {
      if (!pixMap[t.beneficiario_real]) pixMap[t.beneficiario_real]={total:0,count:0};
      pixMap[t.beneficiario_real].total += t.value;
      pixMap[t.beneficiario_real].count += 1;
    }
  }
  const top5   = Object.entries(pixMap).sort((a,b)=>b[1].total-a[1].total).slice(0,5);
  const maxPix = top5[0]?.[1].total ?? 1;

  // Fluxo mensal real
  const monthlyFlow = buildMonthlyFlow(transactions);
  const maxFlow = Math.max(...monthlyFlow.map(d=>Math.max(d.income,d.expense)), 1);

  const now = new Date();
  const [selYear, selMonthIdx] = selectedMonth.split("-").map(Number);
  const PERIOD_LABELS: Record<string,string> = {
    mes: `${MONTH_NAMES[selMonthIdx-1]} ${selYear}`,
    trim: `${MONTH_NAMES[Math.max(0,now.getMonth()-2)]}–${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
    ano: String(now.getFullYear()),
  };

  const catEntries = tab==="receitas" ? catEntriesInc : catEntriesExp;
  const segments   = tab==="receitas" ? segInc : segExp;
  const total      = tab==="receitas" ? totalIncome : totalExpense;

  // Despesas a pagar do mês seguinte
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth()+1, 1);
  const nextMonthLabel = `${MONTH_NAMES[nextMonthDate.getMonth()]} ${nextMonthDate.getFullYear()}`;
  const nextMonthBills = bills.filter(b => {
    if (!b.data_vencimento) return false;
    const d = new Date(b.data_vencimento + "T00:00:00");
    return d.getFullYear() === nextMonthDate.getFullYear() && d.getMonth() === nextMonthDate.getMonth();
  }).sort((a,b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""));
  const isCardBill = (b: BillToPay) => (b.categoria ?? "").toLowerCase() === "cartão de crédito" || !!b.encargos_cartao;
  const nextMonthCards = nextMonthBills.filter(isCardBill);
  const nextMonthOther = nextMonthBills.filter(b => !isCardBill(b));
  const billValor = (b: BillToPay) => (b.valor_base ?? 0) + (b.juros_atraso ?? 0) + (b.encargos_cartao ?? 0);
  const nextMonthTotal = nextMonthBills.reduce((s,b) => s + billValor(b), 0);
  const nextMonthCardsTotal = nextMonthCards.reduce((s,b) => s + billValor(b), 0);
  const nextMonthOtherTotal = nextMonthOther.reduce((s,b) => s + billValor(b), 0);

  const buildBillsShareText = () => {
    const fmtLines = (list: BillToPay[]) => list.map(b => {
      const venc = b.data_vencimento ? new Date(b.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "sem data";
      return `• ${b.nome ?? "Sem nome"} — ${formatBRL(billValor(b))} (venc. ${venc})`;
    }).join("\n");
    const parts: string[] = [];
    if (nextMonthOther.length) parts.push(`Contas fixas:\n${fmtLines(nextMonthOther)}\nSubtotal: ${formatBRL(nextMonthOtherTotal)}`);
    if (nextMonthCards.length) parts.push(`Faturas de cartão:\n${fmtLines(nextMonthCards)}\nSubtotal: ${formatBRL(nextMonthCardsTotal)}`);
    return `📋 Despesas a pagar — ${nextMonthLabel}\n\n${parts.join("\n\n")}\n\nTotal geral: ${formatBRL(nextMonthTotal)}`;
  };
  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(buildBillsShareText())}`, "_blank");
  const shareEmail = () => {
    const subject = `Despesas a pagar — ${nextMonthLabel}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildBillsShareText())}`;
  };

  const renderBillGroup = (title: string, list: BillToPay[], subtotal: number) => list.length > 0 && (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:600,color:"#86868B",textTransform:"uppercase",letterSpacing:0.3,marginBottom:6}}>{title}</div>
      <div style={{borderTop:"0.5px solid #E5E5E7"}}>
        {list.map(b => {
          const venc = b.data_vencimento ? new Date(b.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "—";
          return (
            <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"0.5px solid #E5E5E7"}}>
              <div>
                <div style={{fontSize:14,color:"#1D1D1F"}}>{b.nome ?? "Sem nome"}</div>
                <div style={{fontSize:12,color:"#86868B",marginTop:2}}>Vence em {venc}</div>
              </div>
              <div style={{fontSize:14,fontWeight:600,color:"#FF3B30"}}>{formatBRL(billValor(b))}</div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0 0"}}>
        <span style={{fontSize:12,color:"#86868B"}}>Subtotal</span>
        <span style={{fontSize:13,fontWeight:600,color:"#1D1D1F"}}>{formatBRL(subtotal)}</span>
      </div>
    </div>
  );

  return (
    <div className="scroll-content page-fade">
      <div className="section-title" style={{marginBottom:14}}>Relatórios</div>

      {/* Despesas a pagar — mês seguinte */}
      <div style={{background:"#F5F5F7",borderRadius:16,padding:16,marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:15,fontWeight:600,color:"#1D1D1F"}}>Despesas a pagar — {nextMonthLabel}</span>
          <span style={{fontSize:13,color:"#86868B"}}>{nextMonthBills.length} conta{nextMonthBills.length!==1?"s":""}</span>
        </div>
        {nextMonthBills.length === 0 ? (
          <div style={{fontSize:13,color:"#86868B",padding:"8px 0"}}>Nenhuma conta ou fatura cadastrada para {nextMonthLabel}.</div>
        ) : (
          <>
            {renderBillGroup("Contas fixas", nextMonthOther, nextMonthOtherTotal)}
            {renderBillGroup("Faturas de cartão", nextMonthCards, nextMonthCardsTotal)}
          </>
        )}
        {nextMonthBills.length > 0 && (
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{fontSize:13,fontWeight:600,color:"#86868B"}}>Total geral</span>
            <span style={{fontSize:16,fontWeight:700,color:"#1D1D1F"}}>{formatBRL(nextMonthTotal)}</span>
          </div>
        )}
        {nextMonthBills.length > 0 && (
          <div style={{display:"flex",gap:10}}>
            <button onClick={shareWhatsApp} style={{flex:1,padding:"10px",background:"#25D366",color:"#FFF",border:"none",borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Compartilhar no WhatsApp
            </button>
            <button onClick={shareEmail} style={{flex:1,padding:"10px",background:"#FFFFFF",color:"#1D1D1F",border:"1.5px solid #E5E5E7",borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Enviar por e-mail
            </button>
          </div>
        )}
      </div>

      {/* Período */}
      <div className="report-period-ctrl">
        {(["mes","trim","ano"] as const).map((p,i)=>(
          <button key={p} className={`report-period-btn${period===p?" active":""}`}
            onClick={()=>{
              if (p==="mes" && period==="mes") { setShowMonthPicker(v=>!v); }
              else { setPeriod(p); setSlice(null); if (p!=="mes") setShowMonthPicker(false); }
            }}>
            {p==="mes" && period==="mes" ? `${MONTH_NAMES[selMonthIdx-1].slice(0,3)} ${selYear} 📅` : ["Este Mês","Trimestre","Este Ano"][i]}
          </button>
        ))}
      </div>

      {showMonthPicker && period==="mes" && (
        <div style={{marginTop:-14,marginBottom:20}}>
          <input type="month" value={selectedMonth} max={new Date().toISOString().slice(0,7)}
            onChange={e=>{setSelectedMonth(e.target.value); setSlice(null); setShowMonthPicker(false);}}
            style={{width:"100%",padding:"10px 12px",border:"1.5px solid #E5E5EA",borderRadius:10,fontSize:14,fontFamily:"inherit"}} />
        </div>
      )}

      {/* Cards resumo */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
        {[
          {label:"Receitas", value:totalIncome,  color:"#34C759"},
          {label:"Despesas", value:totalExpense, color:"#FF3B30"},
          {label:"Saldo",    value:saldo,        color:saldo>=0?"#007AFF":"#FF3B30"},
        ].map(c=>(
          <div key={c.label} style={{background:"#F5F5F7",borderRadius:14,padding:"12px 10px",textAlign:"center"}}>
            <div style={{fontSize:10,color:"#6E6E73",fontWeight:600,marginBottom:4}}>{c.label}</div>
            <div style={{fontSize:13,fontWeight:700,color:c.color}}>{formatBRL(c.value)}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
        {([["despesas","🔴 Despesas"],["receitas","🟢 Receitas"],["fluxo","📊 Fluxo"],["pix","💸 Pix"]] as const).map(([t,l])=>(
          <button key={t} onClick={()=>{setTab(t);setSlice(null);}}
            style={{flexShrink:0,padding:"7px 16px",borderRadius:20,border:"none",background:tab===t?"#1D1D1F":"#F5F5F7",color:tab===t?"#FFF":"#6E6E73",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.18s"}}
          >{l}</button>
        ))}
      </div>

      {/* Gráfico de categorias */}
      {(tab==="despesas"||tab==="receitas") && (
        <div className="summary-card" style={{marginBottom:22}}>
          <div style={{fontSize:13,color:"#6E6E73",marginBottom:12}}>{PERIOD_LABELS[period]}</div>
          {loading ? <Spinner label="Calculando…" /> : catEntries.length===0 ? (
            <EmptyState icon="📊" title={`Sem ${tab}`} desc={`Nenhum lançamento encontrado para este período.`} />
          ) : (
            <>
              <DonutChart segments={segments} selected={slice} onSelect={setSlice} total={total} />
              <div className="legend-grid">
                {catEntries.map((c,i)=>(
                  <div key={c.label} className="legend-item"
                    style={{opacity:slice!==null&&slice!==i?0.4:1,cursor:"pointer"}}
                    onClick={()=>setSlice(slice===i?null:i)}
                  >
                    <div className="legend-dot" style={{background:c.color}} />
                    <span className="legend-label">{c.label}</span>
                    <span className="legend-pct">{Math.round((c.value/total)*100)}%</span>
                  </div>
                ))}
              </div>
              {slice!==null && (
                <div style={{marginTop:14,padding:"12px 14px",background:"#FFF",borderRadius:14,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.08)",animation:"pageFadeIn 0.18s ease both"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:12,height:12,borderRadius:3,background:catEntries[slice].color}} />
                    <span style={{fontSize:14,fontWeight:600}}>{catEntries[slice].label}</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:15,fontWeight:700,color:tab==="despesas"?"#FF3B30":"#34C759"}}>{formatBRL(catEntries[slice].value)}</div>
                    <div style={{fontSize:11,color:"#6E6E73"}}>{Math.round((catEntries[slice].value/total)*100)}% do total</div>
                  </div>
                </div>
              )}

              {/* Top 3 mais e menos */}
              <div style={{marginTop:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div style={{background:"rgba(255,59,48,0.06)",borderRadius:12,padding:"10px 12px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#FF3B30",marginBottom:8}}>🔺 Mais consome</div>
                  {catEntries.slice(0,3).map(c=>(
                    <div key={c.label} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                      <span style={{color:"#3C3C43",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{c.label}</span>
                      <span style={{fontWeight:700,color:"#FF3B30"}}>{formatBRL(c.value)}</span>
                    </div>
                  ))}
                </div>
                <div style={{background:"rgba(52,199,89,0.06)",borderRadius:12,padding:"10px 12px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#34C759",marginBottom:8}}>🔻 Menos consome</div>
                  {[...catEntries].reverse().slice(0,3).map(c=>(
                    <div key={c.label} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                      <span style={{color:"#3C3C43",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{c.label}</span>
                      <span style={{fontWeight:700,color:"#34C759"}}>{formatBRL(c.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Fluxo Mensal Real */}
      {tab==="fluxo" && (
        <div className="summary-card" style={{marginBottom:22}}>
          <div style={{display:"flex",gap:14,marginBottom:12}}>
            {[["#34C759","Receitas"],["#FF3B30","Despesas"]].map(([c,l])=>(
              <span key={l} style={{fontSize:12,color:c,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:8,height:8,borderRadius:2,background:c,display:"inline-block"}} />{l}
              </span>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100,margin:"14px 0 8px"}}>
            {monthlyFlow.map((d,i)=>(
              <div key={d.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,height:"100%"}}>
                <div style={{display:"flex",gap:3,alignItems:"flex-end",height:"100%",width:"100%"}}>
                  <div className={`bar-income${ready?" bar-animate":""}`} style={{flex:1,height:ready?`${(d.income/maxFlow)*100}%`:"0%",minHeight:d.income>0?4:0,animationDelay:`${i*0.06}s`,transition:"height 0.6s cubic-bezier(0.34,1.56,0.64,1)"}} />
                  <div className={`bar-expense${ready?" bar-animate":""}`} style={{flex:1,height:ready?`${(d.expense/maxFlow)*100}%`:"0%",minHeight:d.expense>0?4:0,animationDelay:`${i*0.06+0.03}s`,transition:"height 0.6s cubic-bezier(0.34,1.56,0.64,1)"}} />
                </div>
                <span style={{fontSize:10,color:"#6E6E73",fontWeight:500}}>{d.month}</span>
              </div>
            ))}
          </div>
          {/* Tabela de resumo mensal */}
          <div style={{marginTop:12,borderTop:"1px solid #F0F0F0",paddingTop:12}}>
            {monthlyFlow.filter(d=>d.income>0||d.expense>0).map(d=>(
              <div key={d.month} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #F8F8F8"}}>
                <span style={{fontSize:12,fontWeight:600,color:"#3C3C43",width:32}}>{d.month}</span>
                <span style={{fontSize:12,color:"#34C759",fontWeight:600}}>{formatBRL(d.income)}</span>
                <span style={{fontSize:12,color:"#FF3B30",fontWeight:600}}>{formatBRL(d.expense)}</span>
                <span style={{fontSize:12,color:d.income-d.expense>=0?"#007AFF":"#FF3B30",fontWeight:700}}>{formatBRL(d.income-d.expense)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Pix */}
      {tab==="pix" && (
        <div className="summary-card" style={{marginBottom:22}}>
          {top5.length===0 ? (
            <EmptyState icon="💸" title="Sem transferências" desc="Nenhum beneficiário Pix encontrado neste período." />
          ) : (
            top5.map(([name,{total,count}],i)=>{
              const color=`hsl(${210+i*28},82%,${54-i*3}%)`;
              return (
                <div key={name} className="hbar-row">
                  <div className="hbar-header">
                    <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,flex:1}}>
                      <div style={{width:28,height:28,borderRadius:8,background:color,display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontSize:11,fontWeight:700,flexShrink:0}}>
                        {name.split(" ").map((w:string)=>w[0]).slice(0,2).join("")}
                      </div>
                      <span className="hbar-name">{name}</span>
                    </div>
                    <span className="hbar-value">{formatBRL(total)}</span>
                  </div>
                  <div className="hbar-track">
                    <div className="hbar-fill" style={{width:ready?`${(total/maxPix)*100}%`:"0%",background:color,transitionDelay:`${i*0.08}s`}} />
                  </div>
                  <div className="hbar-sub">{count} transferência{count>1?"s":""}</div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Home page ────────────────────────────────────────────────────────────────

function HomePage({
  accounts, transactions, bills, loading, error, refetch, onEditTx, onOpenInvestimentos
}: {
  accounts: NormAccount[];
  transactions: NormTx[];
  bills: BillToPay[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  onEditTx: (tx: NormTx) => void;
  onOpenInvestimentos: () => void;
}) {
  const [barsReady,   setBarsReady]   = useState(false);
  const [selectedBar, setSelectedBar] = useState<number|null>(null);
  const [txFilter,    setTxFilter]    = useState<"todos"|"receita"|"despesa">("todos");
  const [showFilter,  setShowFilter]  = useState(false);
  const [totalInvestido, setTotalInvestido] = useState<number | null>(null);
  const [cardsById, setCardsById] = useState<Record<string,string>>({});
  useEffect(() => { const t = setTimeout(() => setBarsReady(true), 60); return () => clearTimeout(t); }, []);
  useEffect(() => {
    (async () => {
      const [invRes, lancRes] = await Promise.all([
        supabase.from("investimentos").select("valor_inicial"),
        supabase.from("investimento_lancamentos").select("valor_ganho, valor_operacao"),
      ]);
      const base = (invRes.data ?? []).reduce((s: number, i: { valor_inicial?: number }) => s + (i.valor_inicial ?? 0), 0);
      const ganhos = (lancRes.data ?? []).reduce((s: number, l: { valor_ganho?: number; valor_operacao?: number|null }) => s + (l.valor_ganho ?? 0) + (l.valor_operacao ?? 0), 0);
      setTotalInvestido(base + ganhos);
    })();
    (async () => {
      const { data } = await supabase.from("bills_to_pay").select("id, nome").eq("recorrente", true).not("dia_fechamento", "is", null);
      const map: Record<string,string> = {};
      (data ?? []).forEach((c: { id:string; nome:string }) => { map[c.id] = c.nome; });
      setCardsById(map);
    })();
  }, []);

  const homeMonthlyFlow = buildMonthlyFlow(transactions);
  const homeMaxChart    = Math.max(...homeMonthlyFlow.map(d=>Math.max(d.income,d.expense)),1);

  const filteredTxs = txFilter === "todos" ? transactions
    : transactions.filter(t => txFilter === "receita" ? t.type === "income" : t.type === "expense");

  const currentMonthKey = new Date().toISOString().slice(0,7);
  const transactionsThisMonth = transactions.filter(t => (t.date ?? "").startsWith(currentMonthKey));
  const totalIncome  = transactionsThisMonth.filter(t=>t.type==="income").reduce((s,t)=>s+t.value,0);
  const totalExpense = transactionsThisMonth.filter(t=>t.type==="expense").reduce((s,t)=>s+t.value,0);
  const totalBalance = accounts.reduce((s,a)=>s+a.balance,0);
  const grouped      = groupByMonth(transactions);
  const maxChart     = Math.max(...CHART_DATA_FALLBACK.map(d=>Math.max(d.income,d.expense)));

  if (error) {
    return (
      <div className="scroll-content page-fade">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <div className="empty-title">Erro ao carregar dados</div>
          <div className="empty-desc">{error}</div>
          <button className="btn-primary" style={{marginTop:16,width:"auto",padding:"12px 28px"}} onClick={refetch}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const [selectedAccSlice, setSelectedAccSlice] = useState<number|null>(null);
  const accountsComSaldo = [...accounts].filter(a => Math.abs(a.balance) > 0.001).sort((a,b) => b.balance - a.balance);
  const accSegments = buildPieSegments(accountsComSaldo.map(a => ({ label: a.name, value: Math.max(a.balance,0.01), color: getCardColor(a.name) })));

  return (
    <div className="scroll-content page-fade">
      {/* Accounts */}
      <div className="section-header">
        <span className="section-title">Contas</span>
      </div>
      {loading ? <Spinner /> : accounts.length === 0 ? (
        <EmptyState icon="🏦" title="Nenhuma conta" desc="Adicione contas no Supabase para vê-las aqui." />
      ) : (
        <>
          {/* Barra do total geral */}
          <div style={{background:"linear-gradient(135deg,#007AFF,#0055D4)",borderRadius:20,padding:20,marginBottom:16,color:"#FFF"}}>
            <div style={{fontSize:12,opacity:0.85,marginBottom:4}}>Saldo total · {accounts.length} conta{accounts.length>1?"s":""} ativa{accounts.length>1?"s":""}</div>
            <div style={{fontSize:28,fontWeight:700,letterSpacing:"-0.5px"}}>{formatBRL(totalBalance)}</div>
          </div>

          {/* Gráfico de pizza + lista */}
          {totalBalance > 0.05 ? (
            <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap",justifyContent:"center",marginBottom:16}}>
              <DonutChart segments={accSegments} selected={selectedAccSlice} onSelect={setSelectedAccSlice} total={totalBalance} />
            </div>
          ) : (
            <div style={{textAlign:"center",fontSize:12,color:"#86868B",marginBottom:16,lineHeight:1.5}}>
              Cadastre o saldo de cada conta (toque no ✏️ ao lado) para ver a distribuição no gráfico.
            </div>
          )}

          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {accountsComSaldo.map((acc, i) => (
              <div key={acc.id}
                onClick={()=>setSelectedAccSlice(selectedAccSlice===i?null:i)}
                style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:selectedAccSlice===i?"#F0F7FF":"#F5F5F7",borderRadius:14,cursor:"pointer",border:selectedAccSlice===i?"1.5px solid #007AFF":"1.5px solid transparent",transition:"all 0.15s"}}>
                <div style={{
                  width:44,height:44,borderRadius:14,flexShrink:0,
                  background:`linear-gradient(145deg, ${getCardColor(acc.name)}dd, ${getCardColor(acc.name)})`,
                  boxShadow:"0 3px 6px rgba(0,0,0,0.22), inset 0 1px 1px rgba(255,255,255,0.45), inset 0 -2px 3px rgba(0,0,0,0.18)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                }}>
                  <span style={{fontSize:14,fontWeight:800,color:getCardTextColor(acc.name),letterSpacing:"-0.3px"}}>{getCardInitials(acc.name)}</span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,color:"#1D1D1F",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{acc.name}</div>
                  <div style={{fontSize:11,color:"#86868B"}}>{acc.type === "savings" ? "Poupança" : "Conta corrente"}</div>
                </div>
                <div style={{fontSize:15,fontWeight:700,color:"#1D1D1F"}}>{formatBRL(acc.balance)}</div>
                <span
                  onClick={async (e)=>{
                    e.stopPropagation();
                    const novo = window.prompt(`Novo saldo de ${acc.name} (R$)`, String(acc.balance));
                    if (novo === null) return;
                    const valor = parseFloat(novo.replace(",","."));
                    if (isNaN(valor)) return;
                    await supabase.from("accounts").update({ saldo_inicial: valor }).eq("id", acc.id);
                    refetch();
                  }}
                  style={{fontSize:14,cursor:"pointer",marginLeft:2,flexShrink:0}}
                >✏️</span>
              </div>
            ))}
            <div onClick={onOpenInvestimentos} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#1D1D1F",borderRadius:14,cursor:"pointer"}}>
              <div style={{
                width:44,height:44,borderRadius:14,flexShrink:0,
                background:"linear-gradient(145deg,#3ddc6fdd,#34C759)",
                boxShadow:"0 3px 6px rgba(0,0,0,0.22), inset 0 1px 1px rgba(255,255,255,0.45), inset 0 -2px 3px rgba(0,0,0,0.18)",
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>
                <span style={{fontSize:18}}>📈</span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:"#FFF"}}>Investimentos</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>Ver detalhes</div>
              </div>
              <div style={{fontSize:15,fontWeight:700,color:"#FFF"}}>{totalInvestido===null?"…":formatBRL(totalInvestido)}</div>
            </div>
          </div>
        </>
      )}

      {/* Cash flow chart */}
      <div style={{marginTop:28}}>
        <div className="section-header">
          <span className="section-title">Fluxo de Caixa</span>
          <span className="section-link">{new Date().getFullYear()}</span>
        </div>
        <div className="summary-card">
          <div style={{display:"flex",gap:14,marginBottom:4}}>
            {[["#34C759","Receitas"],["#FF3B30","Despesas"]].map(([c,l])=>(
              <span key={l} style={{fontSize:12,color:c,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:8,height:8,borderRadius:2,background:c,display:"inline-block"}} />{l}
              </span>
            ))}
          </div>
          <div className="chart-bars" style={{position:"relative"}}>
            {homeMonthlyFlow.map((d,i)=>{
              const isCurrentMonth = i === homeMonthlyFlow.length - 1;
              const isSelected = selectedBar === i;
              const hasData = d.income > 0 || d.expense > 0;
              return (
                <div key={d.month} className="chart-bar-wrap"
                  style={{position:"relative",cursor:hasData?"pointer":"default"}}
                  onClick={()=>setSelectedBar(isSelected?null:i)}
                >
                  {/* Tooltip */}
                  {isSelected && hasData && (
                    <div style={{position:"absolute",bottom:"110%",left:"50%",transform:"translateX(-50%)",background:"#1D1D1F",color:"#FFF",borderRadius:10,padding:"8px 10px",fontSize:11,whiteSpace:"nowrap",zIndex:10,boxShadow:"0 4px 16px rgba(0,0,0,0.2)",lineHeight:1.7}}>
                      <div style={{color:"#34C759",fontWeight:700}}>▲ {formatBRL(d.income)}</div>
                      <div style={{color:"#FF6B6B",fontWeight:700}}>▼ {formatBRL(d.expense)}</div>
                      <div style={{color:d.income-d.expense>=0?"#64D2FF":"#FF9F9F",fontWeight:700,borderTop:"1px solid rgba(255,255,255,0.15)",paddingTop:3,marginTop:2}}>
                        = {formatBRL(d.income-d.expense)}
                      </div>
                      <div style={{position:"absolute",bottom:-5,left:"50%",transform:"translateX(-50%)",width:10,height:10,background:"#1D1D1F",clipPath:"polygon(0 0,100% 0,50% 100%)"}} />
                    </div>
                  )}
                  <div style={{display:"flex",gap:3,alignItems:"flex-end",height:"100%",width:"100%"}}>
                    {/* Barra receita */}
                    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%"}}>
                      {d.income > 0 && barsReady && (
                        <div style={{fontSize:8,color:"#34C759",fontWeight:700,marginBottom:2,whiteSpace:"nowrap"}}>
                          {d.income>=1000?`${(d.income/1000).toFixed(1)}k`:Math.round(d.income)}
                        </div>
                      )}
                      <div className={`bar-income${barsReady?" bar-animate":""}`}
                        style={{
                          width:"100%",
                          height:homeMaxChart>0?`${(d.income/homeMaxChart)*100}%`:"0%",
                          minHeight:d.income>0?3:0,
                          transition:"height 0.6s cubic-bezier(0.34,1.56,0.64,1)",
                          animationDelay:`${i*0.06}s`,
                          opacity:isCurrentMonth?1:0.7,
                          background:isCurrentMonth?"#34C759":"rgba(52,199,89,0.6)",
                          borderRadius:"3px 3px 0 0",
                        }}
                      />
                    </div>
                    {/* Barra despesa */}
                    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%"}}>
                      {d.expense > 0 && barsReady && (
                        <div style={{fontSize:8,color:"#FF3B30",fontWeight:700,marginBottom:2,whiteSpace:"nowrap"}}>
                          {d.expense>=1000?`${(d.expense/1000).toFixed(1)}k`:Math.round(d.expense)}
                        </div>
                      )}
                      <div className={`bar-expense${barsReady?" bar-animate":""}`}
                        style={{
                          width:"100%",
                          height:homeMaxChart>0?`${(d.expense/homeMaxChart)*100}%`:"0%",
                          minHeight:d.expense>0?3:0,
                          transition:"height 0.6s cubic-bezier(0.34,1.56,0.64,1)",
                          animationDelay:`${i*0.06+0.03}s`,
                          opacity:isCurrentMonth?1:0.7,
                          background:isCurrentMonth?"#FF3B30":"rgba(255,59,48,0.6)",
                          borderRadius:"3px 3px 0 0",
                        }}
                      />
                    </div>
                  </div>
                  <div className="chart-month" style={{fontWeight:isCurrentMonth?700:400,color:isCurrentMonth?"#1D1D1F":"#6E6E73"}}>
                    {d.month}{isCurrentMonth?" ●":""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div style={{marginTop:20}}>
        <div className="section-header">
          <span className="section-title">Transações</span>
          <span className="section-link" onClick={()=>setShowFilter(f=>!f)}>Filtrar</span>
        </div>
        {showFilter && (
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            {(["todos","receita","despesa"] as const).map(f=>(
              <button key={f} onClick={()=>setTxFilter(f)}
                style={{padding:"6px 14px",borderRadius:20,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",background:txFilter===f?"#1D1D1F":"#F5F5F7",color:txFilter===f?"#FFF":"#6E6E73",transition:"all 0.18s"}}
              >{{todos:"Todos",receita:"Receitas",despesa:"Despesas"}[f]}</button>
            ))}
          </div>
        )}
        {loading ? <Spinner /> : filteredTxs.length === 0 ? (
          <EmptyState icon="📋" title="Nenhuma transação" desc="As transações do Supabase aparecerão aqui, ordenadas por data." />
        ) : (
          Object.entries(groupByMonth(filteredTxs)).map(([month, txs]) => (
            <div key={month}>
              <div className="tx-group-header">{month}</div>
              {txs.map((tx, i) => {
                const { icon } = getCategoryStyle(`${tx.category} ${tx.name}`);
                const pm = tx.meio_pagamento ? getPaymentStyle(tx.meio_pagamento) : null;
                const subtitleParts = [tx.category, pm?.label, tx.tipo_escopo].filter(Boolean);
                return (
                  <div key={tx.id} className="tx-item tx-enter" style={{animationDelay:`${i*0.04}s`}} onClick={()=>onEditTx(tx)}>
                    <div className="tx-icon" style={{background:"#F2F2F5"}}>{icon}</div>
                    <div className="tx-info">
                      <div className="tx-name">{tx.name}{tx.meio_pagamento==="credito" && tx.cartao_id && cardsById[tx.cartao_id] && (
                        <span title={cardsById[tx.cartao_id]} style={{marginLeft:6,display:"inline-flex",verticalAlign:"middle",alignItems:"center",justifyContent:"center",width:16,height:16,borderRadius:5,background:getCardColor(cardsById[tx.cartao_id]),color:getCardTextColor(cardsById[tx.cartao_id]),fontSize:8,fontWeight:800}}>
                          {getCardInitials(cardsById[tx.cartao_id]).slice(0,2)}
                        </span>
                      )}{tx.anexo_url && <span title="Tem comprovante anexado" style={{marginLeft:6,fontSize:12}}>📎</span>}</div>
                      <div style={{fontSize:12,color:"#8E8E93",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {subtitleParts.join(" · ")}
                      </div>
                    </div>
                    <div className="tx-right">
                      <div className={`tx-value ${tx.type==="income"?"income":tx.type==="transfer"?"transfer":"expense"}`} style={tx.type==="transfer"?{color:"#8E8E93"}:tx.meio_pagamento==="credito"?{color:"#5856D6"}:undefined}>                        {tx.type==="income"?"+":tx.type==="transfer"?"⇄ ":"−"}{formatBRL(tx.value)}
                      </div>
                      <div className="tx-date">{formatDatePT(tx.date)} · {tx.account}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Nova Transação modal ─────────────────────────────────────────────────────

interface TxForm { name:string; value:string; category:string; date:string; accountId:string; tipo:"receita"|"despesa"|"transferencia"; beneficiario_real:string; meio_pagamento:string; tipo_escopo:string; contaDestinoId:string; }
const EMPTY_FORM: TxForm = { name:"", value:"", category:"", date:"", accountId:"", tipo:"despesa", beneficiario_real:"", meio_pagamento:"Pix", tipo_escopo:"Despesa Familiar", contaDestinoId:"" };

// Ajusta o saldo de uma conta somando/subtraindo um valor (usado ao criar/editar/excluir transações,
// pra manter o saldo da conta sempre refletindo os lançamentos automaticamente).
async function adjustAccountBalance(accountId: string | null | undefined, delta: number): Promise<string | null> {
  if (!accountId || delta === 0) return null;
  const { data, error: selErr } = await supabase.from("accounts").select("saldo_inicial").eq("id", accountId).single();
  if (selErr) { console.error("Erro ao ler saldo da conta:", selErr); return selErr.message; }
  const atual = data?.saldo_inicial ?? 0;
  const { error: updErr } = await supabase.from("accounts").update({ saldo_inicial: atual + delta }).eq("id", accountId);
  if (updErr) { console.error("Erro ao atualizar saldo da conta:", updErr); return updErr.message; }
  return null;
}

// Calcula o efeito (delta) de uma transação sobre a conta de origem e, se for transferência, sobre a de destino.
function txBalanceEffects(tipo: string, valor: number, accountId: string | null | undefined, contaDestinoId?: string | null) {
  const effects: { accountId: string | null | undefined; delta: number }[] = [];
  if (tipo === "receita" || tipo === "income") {
    effects.push({ accountId, delta: valor });
  } else if (tipo === "transferencia" || tipo === "transfer") {
    effects.push({ accountId, delta: -valor });
    if (contaDestinoId) effects.push({ accountId: contaDestinoId, delta: valor });
  } else {
    effects.push({ accountId, delta: -valor });
  }
  return effects;
}

const ESCOPO_OPTIONS = ["Despesa Familiar", "Lazer Familiar", "Gasto Pessoal", "Giro de Revenda"] as const;

const PAYMENT_METHODS: { label:string; dbValue:string; color:string; badgeClass:string }[] = [
  { label:"Pix",      dbValue:"pix",      color:"#00C7BE", badgeClass:"badge-pix"      },
  { label:"Débito",   dbValue:"debito",   color:"#007AFF", badgeClass:"badge-debito"   },
  { label:"Crédito",  dbValue:"credito",  color:"#5856D6", badgeClass:"badge-credito"  },
  { label:"Dinheiro", dbValue:"dinheiro", color:"#34C759", badgeClass:"badge-dinheiro" },
  { label:"TED/DOC",  dbValue:"ted_doc",  color:"#FF9500", badgeClass:"badge-teddoc"   },
  { label:"Boleto",   dbValue:"boleto",   color:"#8E8E93", badgeClass:"badge-boleto"   },
];

const INCOME_TYPES = [
  { id:"salario",     label:"💼 Salário"               },
  { id:"venda_prod",  label:"📦 Venda de Produto"      },
  { id:"venda_serv",  label:"🛠️ Venda de Serviço"     },
  { id:"consultoria", label:"🤝 Consultoria"           },
  { id:"reembolso",   label:"🔄 Reembolso"             },
  { id:"rendimento",  label:"📈 Rendimento/Investimento"},
  { id:"aluguel",     label:"🏠 Aluguel Recebido"      },
  { id:"cashback",    label:"💳 Cashback/Estorno"      },
  { id:"presente",    label:"🎁 Presente/Doação"       },
  { id:"pensao",      label:"👨‍👩‍👧 Pensão/Mesada"        },
  { id:"venda_bem",   label:"🚗 Venda de Bem"          },
  { id:"outros",      label:"➕ Outros"                },
];

const EXPENSE_CATEGORIES = [
  "🛒 Alimentação","🏠 Moradia","⚡ Energia/Água/Gás","🚗 Transporte",
  "💊 Saúde/Farmácia","🏋️ Academia","📚 Educação","🎮 Lazer",
  "🐾 Pet","👗 Vestuário","💅 Beleza","🎬 Streaming","📱 Telefone/Internet",
  "🏦 Tarifas Bancárias","🎲 Confraternização","✈️ Viagem","🎁 Presente",
  "💸 Transferência","🔧 Manutenção","📦 Compras Online","Outros"
];

function getPaymentStyle(meio: string | null): { label:string; badgeClass:string } {
  if (!meio) return { label:"", badgeClass:"" };
  const found = PAYMENT_METHODS.find(p => p.dbValue === meio || p.label.toLowerCase() === meio.toLowerCase());
  return found ? { label:found.label, badgeClass:found.badgeClass } : { label:meio, badgeClass:"badge-debito" };
}

function NovaTransacaoModal({ onClose, onSaved, accounts, userId, transactions, bills }: {
  onClose: () => void;
  onSaved: () => void;
  accounts: NormAccount[];
  userId: string;
  transactions: NormTx[];
  bills: BillToPay[];
}) {
  const [form,        setForm]        = useState<TxForm>({ ...EMPTY_FORM, accountId: accounts[0]?.id ?? "" });
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState<string|null>(null);
  const [incomeType,  setIncomeType]  = useState("salario");
  const [paraQuem,    setParaQuem]    = useState("");
  const [oQue,        setOQue]        = useState("");
  const [numPessoas,  setNumPessoas]  = useState("1");
  const [reembolsoDesc, setReembolsoDesc] = useState("");
  const [similarTxs,  setSimilarTxs] = useState<NormTx[]>([]);
  const [showSimilar, setShowSimilar] = useState(false);
  const [cartaoId,    setCartaoId]    = useState("");
  const [parcelas,    setParcelas]    = useState("1");
  const [anexoFile,   setAnexoFile]   = useState<File | null>(null);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const [cards, setCards] = useState<{id:string; nome:string}[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("bills_to_pay").select("id, nome").eq("recorrente", true).not("dia_fechamento", "is", null);
      setCards((data ?? []) as {id:string; nome:string}[]);
    })();
  }, []);

  useEffect(() => {
    if (accounts.length > 0 && !form.accountId) {
      setForm(f => ({ ...f, accountId: accounts[0].id }));
    }
  }, [accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detectar transações similares para reembolso
  useEffect(() => {
    if (form.tipo === "receita" && incomeType === "reembolso" && form.value && parseFloat(form.value) > 0) {
      const val = parseFloat(form.value);
      const today = form.date || new Date().toISOString().slice(0,10);
      const similar = transactions.filter(t => {
        if (t.type !== "expense") return false;
        const diff = Math.abs(t.value - val) / val;
        return diff <= 0.05; // 5% de tolerância
      });
      setSimilarTxs(similar);
      setShowSimilar(similar.length > 0);
    } else {
      setSimilarTxs([]);
      setShowSimilar(false);
    }
  }, [form.value, form.tipo, incomeType, form.date, transactions]);

  const noAccounts = accounts.length === 0;

  function buildDescricao(): string {
    if (form.tipo === "transferencia") {
      const destino = accounts.find(a=>a.id===form.contaDestinoId)?.name ?? "outra conta";
      return form.name.trim() || `Transferência para ${destino}`;
    }
    if (form.tipo === "despesa") return form.name.trim();
    switch(incomeType) {
      case "salario":     return "Salário";
      case "venda_prod":  return `Venda: ${form.name.trim() || "Produto"}`;
      case "venda_serv":  return `Serviço para ${paraQuem || "cliente"}: ${oQue || form.name.trim()}`;
      case "consultoria": return `Consultoria para ${paraQuem || "cliente"}: ${oQue || form.name.trim()}`;
      case "reembolso":   return `Reembolso: ${reembolsoDesc || form.name.trim()}`;
      case "rendimento":  return `Rendimento: ${form.name.trim() || "Investimento"}`;
      case "aluguel":     return `Aluguel: ${form.name.trim()}`;
      case "cashback":    return `Cashback/Estorno: ${form.name.trim()}`;
      case "presente":    return `Presente de ${paraQuem || form.name.trim()}`;
      case "pensao":      return `Pensão de ${paraQuem || form.name.trim()}`;
      case "venda_bem":   return `Venda: ${form.name.trim()}`;
      default:            return form.name.trim() || "Receita";
    }
  }

  function buildCategoria(): string {
    if (form.tipo === "transferencia") return "Transferência";
    if (form.tipo === "despesa") return form.category || "Outros";
    const map: Record<string,string> = {
      salario:"Salário", venda_prod:"Venda de Produto", venda_serv:"Venda de Serviço",
      consultoria:"Consultoria", reembolso:"Reembolso", rendimento:"Rendimento",
      aluguel:"Aluguel", cashback:"Cashback", presente:"Presente",
      pensao:"Pensão", venda_bem:"Venda de Bem", outros:"Outros"
    };
    return map[incomeType] || "Receita";
  }

  async function handleSave() {
    const descricao = buildDescricao();
    if (!descricao || !form.value || !form.date) {
      setErr("Preencha todos os campos obrigatórios antes de salvar.");
      return;
    }
    if (form.tipo === "transferencia" && !form.contaDestinoId) {
      setErr("Selecione a conta de destino da transferência.");
      return;
    }
    if (noAccounts) { setErr("Nenhuma conta disponível."); return; }
    setSaving(true); setErr(null);

    const valorTotal = parseFloat(form.value);
    const pessoas    = parseInt(numPessoas) || 1;
    const minhaParte = form.tipo === "despesa" && pessoas > 1 ? valorTotal / pessoas : null;

    let anexoUrl: string | null = null;
    let anexoNome: string | null = null;
    if (anexoFile) {
      setUploadingAnexo(true);
      const path = `${userId}/${Date.now()}-${anexoFile.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const { error: upErr } = await supabase.storage.from("anexos").upload(path, anexoFile);
      setUploadingAnexo(false);
      if (upErr) {
        setSaving(false);
        setErr(`Erro ao enviar anexo: ${upErr.message}`);
        return;
      }
      anexoUrl = supabase.storage.from("anexos").getPublicUrl(path).data.publicUrl;
      anexoNome = anexoFile.name;
    }

    const isCredito = form.meio_pagamento === "Crédito";
    const resolvedAccountId = form.accountId || accounts[0]?.id || null;
    const payload: Record<string,unknown> = {
      user_id:        userId,
      descricao,
      categoria:      buildCategoria(),
      valor:          valorTotal,
      tipo:           form.tipo,
      data_transacao: form.date,
      account_id:     resolvedAccountId,
      meio_pagamento: form.tipo==="transferencia" ? "pix" : (PAYMENT_METHODS.find(p=>p.label===form.meio_pagamento)?.dbValue ?? "pix"),
      tipo_escopo:    form.tipo==="transferencia" ? "Despesa Familiar" : (form.tipo_escopo || "Despesa Familiar"),
      ...(form.tipo==="transferencia" ? { conta_destino_id: form.contaDestinoId } : {}),
      ...(form.beneficiario_real ? { beneficiario_real: form.beneficiario_real } : {}),
      ...(paraQuem ? { beneficiario_real: paraQuem } : {}),
      ...(minhaParte !== null ? { observacao: `Dividido entre ${pessoas} pessoas. Sua parte: R$${minhaParte.toFixed(2)}` } : {}),
      ...(isCredito && cartaoId ? { cartao_id: cartaoId, parcela_total: Math.max(1, parseInt(parcelas,10) || 1) } : {}),
      ...(anexoUrl ? { anexo_url: anexoUrl, anexo_nome: anexoNome } : {}),
    };

    const { error } = await supabase.from("transactions").insert(payload);
    setSaving(false);
    if (error) {
      setErr(error.code==="42501" ? "Sem permissão. Verifique as políticas RLS." : `Erro: ${error.message}`);
      return;
    }
    // Compras no cartão de crédito não saem da conta na hora (viram fatura) — só ajusta saldo pra Pix/débito/dinheiro/TED e transferências
    if (!isCredito) {
      const effects = txBalanceEffects(form.tipo, valorTotal, resolvedAccountId, form.contaDestinoId);
      for (const e of effects) {
        const errMsg = await adjustAccountBalance(e.accountId, e.delta);
        if (errMsg) { setErr(`Transação salva, mas o saldo não atualizou: ${errMsg}`); return; }
      }
    }
    onSaved(); onClose();
  }

  const set = (k: keyof TxForm) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const pessoas = parseInt(numPessoas) || 1;
  const valorNum = parseFloat(form.value) || 0;
  const minhaParte = pessoas > 1 ? (valorNum / pessoas).toFixed(2) : null;
  const aReceber   = pessoas > 1 ? (valorNum - valorNum/pessoas).toFixed(2) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" style={{maxHeight:"92svh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">Nova Transação</div>

        {err && (
          <div style={{background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",borderRadius:12,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#C9352B",lineHeight:1.4}}>
            {err}
          </div>
        )}

        {/* Tipo Despesa/Receita/Transferência */}
        <div className="form-field">
          <label className="form-label">Tipo</label>
          <div className="type-toggle">
            <button className={`type-btn${form.tipo==="despesa"?" expense":""}`} onClick={()=>setForm(f=>({...f,tipo:"despesa"}))}>⬇ Despesa</button>
            <button className={`type-btn${form.tipo==="receita"?" income":""}`}  onClick={()=>setForm(f=>({...f,tipo:"receita"}))}>⬆ Receita</button>
            <button className={`type-btn${form.tipo==="transferencia"?" income":""}`} style={form.tipo==="transferencia"?{background:"#8E8E93",borderColor:"#8E8E93"}:{}} onClick={()=>setForm(f=>({...f,tipo:"transferencia"}))}>⇄ Transferência</button>
          </div>
        </div>

        {/* ── TRANSFERÊNCIA: conta origem/destino ── */}
        {form.tipo === "transferencia" && (
          <>
            <div style={{fontSize:12,color:"#86868B",marginBottom:12,lineHeight:1.5}}>
              Transferências entre suas próprias contas não contam como receita nem despesa — só movem o dinheiro de um lugar pro outro.
            </div>
            <div className="form-field">
              <label className="form-label">De (conta de origem)</label>
              <select className="form-input" value={form.accountId} onChange={set("accountId")}>
                {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Para (conta de destino)</label>
              <select className="form-input" value={form.contaDestinoId} onChange={set("contaDestinoId")}>
                <option value="">Selecione…</option>
                {accounts.filter(a=>a.id!==form.accountId).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Descrição (opcional)</label>
              <input className="form-input" placeholder="Ex: Poupança para conta corrente" value={form.name} onChange={set("name")} />
            </div>
          </>
        )}

        {/* ── RECEITA: seletor de tipo ── */}
        {form.tipo === "receita" && (
          <div className="form-field">
            <label className="form-label">Tipo de Receita</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:4}}>
              {INCOME_TYPES.map(it=>(
                <button key={it.id}
                  onClick={()=>setIncomeType(it.id)}
                  style={{padding:"9px 10px",borderRadius:12,border:`1.5px solid ${incomeType===it.id?"#34C759":"#E5E5EA"}`,background:incomeType===it.id?"rgba(52,199,89,0.08)":"transparent",fontSize:12,fontWeight:600,color:incomeType===it.id?"#1EA446":"#6E6E73",cursor:"pointer",textAlign:"left",transition:"all 0.18s"}}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── DESPESA: categoria ── */}
        {form.tipo === "despesa" && (
          <div className="form-field">
            <label className="form-label">Categoria</label>
            <select className="form-input" value={form.category} onChange={set("category")}>
              <option value="">Selecione…</option>
              {EXPENSE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Descrição adaptada */}
        {(form.tipo==="despesa" || ["salario","rendimento","aluguel","cashback","venda_prod","venda_bem","outros"].includes(incomeType)) && (
          <div className="form-field">
            <label className="form-label">
              {form.tipo==="despesa" ? "Descrição" : incomeType==="venda_prod" ? "Nome do Produto" : incomeType==="aluguel" ? "Endereço/Imóvel" : incomeType==="cashback" ? "Origem do Cashback" : incomeType==="venda_bem" ? "Descrição do Bem" : "Descrição"}
            </label>
            <input className="form-input" placeholder={form.tipo==="despesa"?"Ex: Supermercado":"Descreva…"} value={form.name} onChange={set("name")} />
          </div>
        )}

        {/* Para quem + O que (serviço, consultoria, presente, pensão) */}
        {["venda_serv","consultoria","presente","pensao"].includes(incomeType) && form.tipo==="receita" && (
          <>
            <div className="form-field">
              <label className="form-label">{["presente","pensao"].includes(incomeType) ? "De quem" : "Para quem"}</label>
              <input className="form-input" placeholder="Nome do cliente/pessoa" value={paraQuem} onChange={e=>setParaQuem(e.target.value)} />
            </div>
            {["venda_serv","consultoria"].includes(incomeType) && (
              <div className="form-field">
                <label className="form-label">O que foi feito</label>
                <input className="form-input" placeholder="Descreva o serviço/consultoria" value={oQue} onChange={e=>setOQue(e.target.value)} />
              </div>
            )}
          </>
        )}

        {/* Reembolso */}
        {incomeType==="reembolso" && form.tipo==="receita" && (
          <div className="form-field">
            <label className="form-label">Referência do Reembolso</label>
            <input className="form-input" placeholder="Ex: Churrasco 15/06, Almoço time…" value={reembolsoDesc} onChange={e=>setReembolsoDesc(e.target.value)} />
          </div>
        )}

        {/* Valor + Data */}
        <div className="form-row">
          <div className="form-field" style={{flex:1}}>
            <label className="form-label">Valor (R$)</label>
            <input className="form-input" type="number" inputMode="decimal" placeholder="0,00" value={form.value} onChange={set("value")} />
          </div>
          <div className="form-field" style={{flex:1}}>
            <label className="form-label">Data</label>
            <input className="form-input" type="date" value={form.date} onChange={set("date")} />
          </div>
        </div>

        {/* Divisão de despesa (churrasco etc) */}
        {form.tipo==="despesa" && (
          <div className="form-field">
            <label className="form-label">Dividir entre quantas pessoas?</label>
            <input className="form-input" type="number" inputMode="numeric" placeholder="1 (só você)" value={numPessoas} onChange={e=>setNumPessoas(e.target.value)} min="1" />
            {pessoas > 1 && valorNum > 0 && (
              <div style={{marginTop:10,padding:"12px 14px",background:"rgba(52,199,89,0.08)",borderRadius:12,border:"1px solid rgba(52,199,89,0.2)"}}>
                <div style={{fontSize:13,fontWeight:600,color:"#1EA446",marginBottom:4}}>💡 Divisão calculada:</div>
                <div style={{fontSize:12,color:"#3C3C43",lineHeight:1.6}}>
                  Sua parte: <strong>R${minhaParte}</strong><br/>
                  A receber dos outros {pessoas-1}: <strong style={{color:"#34C759"}}>R${aReceber}</strong>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Detecção de reembolso similar */}
        {showSimilar && similarTxs.length > 0 && (
          <div style={{background:"rgba(255,149,0,0.08)",border:"1px solid rgba(255,149,0,0.25)",borderRadius:12,padding:"12px 14px",marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:"#C97800",marginBottom:8}}>🔍 Possível conciliação encontrada:</div>
            {similarTxs.slice(0,3).map(t=>(
              <div key={t.id} style={{fontSize:12,color:"#3C3C43",padding:"6px 0",borderBottom:"1px solid rgba(0,0,0,0.06)",display:"flex",justifyContent:"space-between"}}>
                <span>{t.name}</span>
                <span style={{fontWeight:700,color:"#FF3B30"}}>R${t.value.toFixed(2)}</span>
              </div>
            ))}
            <div style={{fontSize:12,color:"#C97800",marginTop:8}}>Este valor é reembolso de uma dessas despesas?</div>
          </div>
        )}

        {/* Conta */}
        <div className="form-field">
          <label className="form-label">Conta</label>
          {noAccounts ? (
            <div className="form-input" style={{color:"#AEAEB2",background:"#F5F5F7",cursor:"default"}}>Nenhuma conta cadastrada</div>
          ) : (
            <select className="form-input" value={form.accountId} onChange={set("accountId")}>
              {accounts.map(a=>(
                <option key={a.id} value={a.id}>{a.name}{a.type?` — ${a.type==="savings"?"Poupança":"Corrente"}`:""}</option>
              ))}
            </select>
          )}
        </div>

        {/* Beneficiário Pix (despesa) */}
        {form.tipo === "despesa" && (
          <div className="form-field">
            <label className="form-label">Beneficiário Pix (opcional)</label>
            <input className="form-input" placeholder="Nome do destinatário" value={form.beneficiario_real} onChange={set("beneficiario_real")} />
          </div>
        )}

        {/* Escopo — apenas para despesas */}
        {form.tipo === "despesa" && (
        <div className="form-field">
          <label className="form-label">Escopo</label>
          <div className="seg-ctrl" style={{marginBottom:0}}>
            {ESCOPO_OPTIONS.map(opt=>(
              <button key={opt} className={`seg-btn${form.tipo_escopo===opt?" active":""}`}
                style={{fontSize:"11px",padding:"7px 4px"}}
                onClick={()=>setForm(f=>({...f,tipo_escopo:opt}))}
              >{opt}</button>
            ))}
          </div>
        </div>
        )}
        <div className="form-field">
          <label className="form-label">Meio de {form.tipo==="receita" ? "Recebimento" : "Pagamento"}</label>
          <div className="pay-seg">
            {PAYMENT_METHODS
              .filter(pm => form.tipo==="receita" ? ["pix","ted_doc","dinheiro"].includes(pm.dbValue) : true)
              .map(pm=>(
              <button
                key={pm.label}
                className={`pay-seg-btn${form.meio_pagamento===pm.label?" active":""}`}
                style={form.meio_pagamento===pm.label?{background:pm.color,borderColor:pm.color,color:"#FFF"}:{}}
                onClick={()=>setForm(f=>({...f,meio_pagamento:pm.label}))}
              >{pm.label}</button>
            ))}
          </div>
        </div>
        {form.tipo === "despesa" && form.meio_pagamento === "Crédito" && (
          <div className="form-field">
            <label className="form-label">Cartão</label>
            {cards.length === 0 ? (
              <div style={{fontSize:12,color:"#86868B",padding:"6px 0"}}>
                Nenhum cartão cadastrado ainda. Cadastre em <strong>Cartões</strong> para vincular a fatura automaticamente.
              </div>
            ) : (
              <select className="form-input" value={cartaoId} onChange={e=>setCartaoId(e.target.value)}>
                <option value="">Selecione o cartão</option>
                {cards.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
            {cartaoId && (
              <div style={{marginTop:10}}>
                <label className="form-label">Parcelas</label>
                <input className="form-input" type="number" min={1} max={48} value={parcelas} onChange={e=>setParcelas(e.target.value)} />
                {parseInt(parcelas,10) > 1 && (
                  <div style={{fontSize:12,color:"#86868B",marginTop:6}}>
                    {parcelas}x de {formatBRL((parseFloat(form.value||"0"))/(parseInt(parcelas,10)||1))} — cada parcela entra na fatura de um mês seguinte
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="form-field">
          <label className="form-label">Anexar comprovante (opcional)</label>
          <input type="file" accept="image/*,application/pdf" onChange={e=>setAnexoFile(e.target.files?.[0] ?? null)}
            style={{width:"100%",padding:"10px",border:"1.5px dashed #C7C7CC",borderRadius:12,fontSize:13,fontFamily:"inherit",background:"#FAFAFA"}} />
          {anexoFile && <div style={{fontSize:12,color:"#34C759",marginTop:6}}>📎 {anexoFile.name}</div>}
        </div>
        <button className="btn-primary" onClick={handleSave} disabled={saving || uploadingAnexo}>
          {uploadingAnexo ? "Enviando anexo…" : saving ? "Salvando…" : "Salvar Transação"}
        </button>
      </div>
    </div>
  );
}

// ─── Editar/Excluir Transação modal ──────────────────────────────────────────

function EditTransacaoModal({ tx, onClose, onSaved, onDeleted, accounts }: {
  tx: NormTx;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  accounts: NormAccount[];
}) {
  const [descricao,  setDescricao]  = useState(tx.name);
  const [valor,      setValor]      = useState(String(tx.value));
  const [data,       setData]       = useState(tx.date);
  const [categoria,  setCategoria]  = useState(tx.category);
  const [accountId,  setAccountId]  = useState(tx.account_id ?? accounts[0]?.id ?? "");
  const [tipo,       setTipo]       = useState<"receita"|"despesa">(tx.type==="income"?"receita":"despesa");
  const [meioPag,    setMeioPag]    = useState(
    PAYMENT_METHODS.find(p=>p.dbValue===tx.meio_pagamento)?.label ?? "Pix"
  );
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [err,        setErr]        = useState<string|null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [anexoFile,  setAnexoFile]  = useState<File | null>(null);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const [removeAnexo, setRemoveAnexo] = useState(false);

  async function handleSave() {
    if (!descricao.trim() || !valor || !data) {
      setErr("Preencha todos os campos obrigatórios."); return;
    }
    setSaving(true); setErr(null);

    let anexoUpdate: Record<string, unknown> = {};
    if (anexoFile) {
      setUploadingAnexo(true);
      const path = `${tx.user_id ?? "sem-usuario"}/${Date.now()}-${anexoFile.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const { error: upErr } = await supabase.storage.from("anexos").upload(path, anexoFile);
      setUploadingAnexo(false);
      if (upErr) { setSaving(false); setErr(`Erro ao enviar anexo: ${upErr.message}`); return; }
      const url = supabase.storage.from("anexos").getPublicUrl(path).data.publicUrl;
      anexoUpdate = { anexo_url: url, anexo_nome: anexoFile.name };
    } else if (removeAnexo) {
      anexoUpdate = { anexo_url: null, anexo_nome: null };
    }

    const { error } = await supabase.from("transactions").update({
      descricao:      descricao.trim(),
      valor:          parseFloat(valor),
      data_transacao: data,
      categoria,
      tipo,
      account_id:     accountId || null,
      meio_pagamento: PAYMENT_METHODS.find(p=>p.label===meioPag)?.dbValue ?? "pix",
      ...anexoUpdate,
    }).eq("id", tx.id);
    setSaving(false);
    if (error) { setErr(`Erro ao salvar: ${error.message}`); return; }

    // Reverte o efeito antigo no saldo e aplica o novo (pulando compras no cartão, que não mexem no saldo da conta)
    const oldEraCredito = tx.meio_pagamento === "credito";
    if (!oldEraCredito) {
      const oldEffects = txBalanceEffects(tx.type, tx.value, tx.account_id, tx.conta_destino_id);
      for (const e of oldEffects) await adjustAccountBalance(e.accountId, -e.delta);
    }
    const novoEhCredito = (PAYMENT_METHODS.find(p=>p.label===meioPag)?.dbValue) === "credito";
    if (!novoEhCredito) {
      const newEffects = txBalanceEffects(tipo, parseFloat(valor), accountId, null);
      for (const e of newEffects) await adjustAccountBalance(e.accountId, e.delta);
    }

    onSaved(); onClose();
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    const { error } = await supabase.from("transactions").delete().eq("id", tx.id);
    setDeleting(false);
    if (error) { setErr(`Erro ao excluir: ${error.message}`); return; }

    // Desfaz o efeito da transação excluída no saldo da conta (se não era compra no cartão)
    if (tx.meio_pagamento !== "credito") {
      const effects = txBalanceEffects(tx.type, tx.value, tx.account_id, tx.conta_destino_id);
      for (const e of effects) await adjustAccountBalance(e.accountId, -e.delta);
    }

    onDeleted(); onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" style={{maxHeight:"92svh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div className="modal-title" style={{margin:0}}>Editar Transação</div>
          <div style={{fontSize:11,color:"#AEAEB2"}}>ID: {tx.id.slice(0,8)}…</div>
        </div>

        {err && (
          <div style={{background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",borderRadius:12,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#C9352B"}}>
            {err}
          </div>
        )}

        {/* Tipo */}
        <div className="form-field">
          <label className="form-label">Tipo</label>
          <div className="type-toggle">
            <button className={`type-btn${tipo==="despesa"?" expense":""}`} onClick={()=>setTipo("despesa")}>⬇ Despesa</button>
            <button className={`type-btn${tipo==="receita"?" income":""}`}  onClick={()=>setTipo("receita")}>⬆ Receita</button>
          </div>
        </div>

        {/* Descrição */}
        <div className="form-field">
          <label className="form-label">Descrição</label>
          <input className="form-input" value={descricao} onChange={e=>setDescricao(e.target.value)} />
        </div>

        {/* Valor + Data */}
        <div className="form-row">
          <div className="form-field" style={{flex:1}}>
            <label className="form-label">Valor (R$)</label>
            <input className="form-input" type="number" inputMode="decimal" value={valor} onChange={e=>setValor(e.target.value)} />
          </div>
          <div className="form-field" style={{flex:1}}>
            <label className="form-label">Data</label>
            <input className="form-input" type="date" value={data} onChange={e=>setData(e.target.value)} />
          </div>
        </div>

        {/* Categoria */}
        <div className="form-field">
          <label className="form-label">Categoria</label>
          {tipo === "despesa" ? (
            <select className="form-input" value={categoria} onChange={e=>setCategoria(e.target.value)}>
              {EXPENSE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              <option value={categoria}>{categoria}</option>
            </select>
          ) : (
            <select className="form-input" value={categoria} onChange={e=>setCategoria(e.target.value)}>
              {INCOME_TYPES.map(it=><option key={it.id} value={it.label.replace(/^\S+\s/,"")}>{it.label}</option>)}
            </select>
          )}
        </div>

        {/* Conta */}
        <div className="form-field">
          <label className="form-label">Conta</label>
          <select className="form-input" value={accountId} onChange={e=>setAccountId(e.target.value)}>
            {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {/* Meio de Pagamento */}
        <div className="form-field">
          <label className="form-label">Meio de Pagamento</label>
          <div className="pay-seg">
            {PAYMENT_METHODS.map(pm=>(
              <button key={pm.label}
                className={`pay-seg-btn${meioPag===pm.label?" active":""}`}
                style={meioPag===pm.label?{background:pm.color,borderColor:pm.color}:{}}
                onClick={()=>setMeioPag(pm.label)}
              >{pm.label}</button>
            ))}
          </div>
        </div>

        <div className="form-field">
          <label className="form-label">Comprovante anexado</label>
          {tx.anexo_url && !removeAnexo && !anexoFile ? (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"#F5F5F7",borderRadius:12}}>
              <a href={tx.anexo_url} target="_blank" rel="noopener noreferrer" style={{fontSize:13,color:"#007AFF",textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📎 {tx.anexo_nome ?? "Ver anexo"}</a>
              <span onClick={()=>setRemoveAnexo(true)} style={{cursor:"pointer",fontSize:16}}>🗑️</span>
            </div>
          ) : (
            <input type="file" accept="image/*,application/pdf" onChange={e=>{setAnexoFile(e.target.files?.[0] ?? null); setRemoveAnexo(false);}}
              style={{width:"100%",padding:"10px",border:"1.5px dashed #C7C7CC",borderRadius:12,fontSize:13,fontFamily:"inherit",background:"#FAFAFA"}} />
          )}
          {anexoFile && <div style={{fontSize:12,color:"#34C759",marginTop:6}}>📎 {anexoFile.name} (substituirá o anterior)</div>}
          {removeAnexo && !anexoFile && <div style={{fontSize:12,color:"#FF3B30",marginTop:6}}>Anexo será removido ao salvar.</div>}
        </div>

        {/* Salvar */}
        <button className="btn-primary" onClick={handleSave} disabled={saving||deleting||uploadingAnexo}>
          {uploadingAnexo ? "Enviando anexo…" : saving ? "Salvando…" : "💾 Salvar Alterações"}
        </button>

        {/* Excluir */}
        <button
          onClick={handleDelete}
          disabled={saving||deleting}
          style={{width:"100%",padding:"13px",marginTop:10,background:confirmDel?"#FF3B30":"rgba(255,59,48,0.08)",color:confirmDel?"#FFF":"#FF3B30",border:`1.5px solid ${confirmDel?"#FF3B30":"rgba(255,59,48,0.18)"}`,borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}
        >
          {deleting ? "Excluindo…" : confirmDel ? "⚠️ Confirmar Exclusão" : "🗑️ Excluir Transação"}
        </button>

        {confirmDel && (
          <div style={{textAlign:"center",marginTop:8,fontSize:12,color:"#6E6E73"}}>
            Clique novamente para confirmar. Esta ação não pode ser desfeita.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Couple link hook ─────────────────────────────────────────────────────────

// ─── Importar Extrato/Fatura (via IA) ──────────────────────────────────────────

function normalizeDesc(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Procura, no histórico já lançado, a transação mais parecida com a descrição importada,
// pra reaproveitar a categoria/escopo que o usuário já usou em compras recorrentes.
function findBestMatch(importedDesc: string, history: NormTx[]): NormTx | null {
  const normImported = normalizeDesc(importedDesc);
  if (!normImported) return null;
  const importedWords = normImported.split(" ").filter(w => w.length > 2);
  if (importedWords.length === 0) return null;
  const importedWordSet = new Set(importedWords);

  let best: NormTx | null = null;
  let bestScore = 0;
  for (const h of history) {
    const normH = normalizeDesc(h.name);
    if (!normH) continue;
    if (normH === normImported || normImported.includes(normH) || normH.includes(normImported)) {
      return h; // match forte (histórico já vem ordenado do mais recente para o mais antigo)
    }
    const hWords = new Set(normH.split(" ").filter(w => w.length > 2));
    let overlap = 0;
    for (const w of importedWordSet) if (hWords.has(w)) overlap++;
    const score = overlap / importedWords.length;
    if (score > bestScore && score >= 0.5) { bestScore = score; best = h; }
  }
  return best;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface ParsedTransacao {
  data: string; descricao: string; valor: number;
  tipo: "despesa"|"receita"|"transferencia"; meio_pagamento: string;
  categoria_sugerida?: string | null; parcelas?: number;
}

function ImportarDocumentoModal({ userId, accounts, transactions, onClose, onImported }: {
  userId: string; accounts: NormAccount[]; transactions: NormTx[]; onClose: () => void; onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle"|"analisando"|"importando"|"done"|"error">("idle");
  const [errorMsg, setErrorMsg] = useState<string|null>(null);
  const [resumo, setResumo] = useState<{banco:string|null; tipo:string; total:number; reconhecidas:number; saldoAtualizado:number|null; cartaoNaoEncontrado:boolean}|null>(null);

  async function handleImport() {
    if (!file) return;
    setStatus("analisando"); setErrorMsg(null);
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await fetch("/api/parse-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64, mimeType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao analisar o documento");

      const transacoes: ParsedTransacao[] = data.transacoes ?? [];
      if (transacoes.length === 0) {
        setErrorMsg("Não foi possível identificar nenhum lançamento nesse arquivo. Tente uma foto/PDF mais nítido.");
        setStatus("error");
        return;
      }

      setStatus("importando");

      // Tenta casar o banco detectado com uma conta já cadastrada
      const bancoDetectado = (data.banco_detectado ?? "").toLowerCase();
      const contaCorrespondente = accounts.find(a => bancoDetectado && (a.name.toLowerCase().includes(bancoDetectado) || bancoDetectado.includes(a.name.toLowerCase())));
      const accountId = contaCorrespondente?.id ?? accounts[0]?.id ?? null;

      // Tenta achar o cartão correspondente pelo banco — independente de a IA ter classificado
      // o documento como "fatura" ou "extrato" (algumas telas de fatura podem confundir a classificação).
      let cartaoId: string | null = null;
      const { data: cards } = await supabase.from("bills_to_pay").select("id, nome").eq("recorrente", true).not("dia_fechamento", "is", null);
      const cardMatch = (cards ?? []).find((c: any) => {
        const nomeCard = (c.nome ?? "").toLowerCase();
        return bancoDetectado && (nomeCard.includes(bancoDetectado) || bancoDetectado.includes(nomeCard));
      });
      cartaoId = cardMatch?.id ?? null;
      const temLancamentoCredito = transacoes.some(t => t.meio_pagamento === "credito");
      const cartaoNaoEncontrado = temLancamentoCredito && !cartaoId;

      // Histórico ordenado do mais recente pro mais antigo, pra priorizar a classificação mais atual
      const historicoOrdenado = [...transactions].sort((a,b) => (b.date ?? "").localeCompare(a.date ?? ""));
      let reconhecidas = 0;

      // Garante que o meio de pagamento é um dos valores válidos no banco, mesmo se a IA devolver algo diferente
      const VALID_MEIOS = ["pix","debito","credito","dinheiro","ted_doc"];
      const sanitizeMeio = (m: string) => {
        const norm = (m ?? "").toLowerCase().trim();
        if (VALID_MEIOS.includes(norm)) return norm;
        if (norm.includes("transfer") || norm === "ted" || norm === "doc") return "ted_doc";
        if (norm.includes("boleto")) return "debito";
        return "pix";
      };

      const payloads = transacoes.map(t => {
        const isTransfer = t.tipo === "transferencia";
        const match = !isTransfer ? findBestMatch(t.descricao, historicoOrdenado) : null;
        if (match) reconhecidas++;
        return {
          user_id: userId,
          descricao: t.descricao,
          valor: t.valor,
          tipo: t.tipo,
          data_transacao: t.data,
          categoria: t.categoria_sugerida || (isTransfer ? "Transferência" : (match?.category ?? "Outros")),
          tipo_escopo: isTransfer ? "Despesa Familiar" : (match?.tipo_escopo ?? "Despesa Familiar"),
          meio_pagamento: sanitizeMeio(t.meio_pagamento) || "pix",
          account_id: accountId,
          ...(cartaoId && t.meio_pagamento === "credito" ? { cartao_id: cartaoId, parcela_total: Math.max(1, t.parcelas ?? 1) } : {}),
        };
      });

      const { error } = await supabase.from("transactions").insert(payloads);
      if (error) throw new Error(error.message);

      // Se o documento tinha um saldo final legível e achamos a conta correspondente, atualiza o saldo
      let saldoAtualizado: number | null = null;
      if (data.saldo_final !== null && data.saldo_final !== undefined && accountId) {
        const { error: saldoErr } = await supabase.from("accounts").update({ saldo_inicial: data.saldo_final }).eq("id", accountId);
        if (!saldoErr) saldoAtualizado = data.saldo_final;
      }

      setResumo({ banco: data.banco_detectado, tipo: data.tipo_documento, total: transacoes.length, reconhecidas, saldoAtualizado, cartaoNaoEncontrado });
      setStatus("done");
      onImported();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Erro ao importar");
      setStatus("error");
    }
  }

  return (
    <div className="modal-overlay" onClick={status==="analisando"||status==="importando" ? undefined : onClose}>
      <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">Importar extrato ou fatura</div>

        {status === "done" && resumo ? (
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:40,marginBottom:12}}>✅</div>
            <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>{resumo.total} lançamento{resumo.total!==1?"s":""} importado{resumo.total!==1?"s":""}!</div>
            <div style={{fontSize:13,color:"#86868B",marginBottom:20}}>
              {resumo.banco ? `Banco identificado: ${resumo.banco}. ` : ""}
              {resumo.reconhecidas > 0
                ? `${resumo.reconhecidas} de ${resumo.total} já foram classificados automaticamente com base no seu histórico. Revise o restante em Transações.`
                : `Importei com categoria "Outros" por padrão — revise em Transações quando puder.`}
              {resumo.saldoAtualizado !== null && (
                <><br/><br/>Saldo da conta atualizado para {formatBRL(resumo.saldoAtualizado)}.</>
              )}
              {resumo.cartaoNaoEncontrado && (
                <><br/><br/>⚠️ Não encontrei um cartão cadastrado com esse banco em <strong>Cartões</strong> — os lançamentos entraram em Transações, mas não estão contando na fatura de nenhum cartão. Cadastre o cartão e sincronize a fatura pra isso funcionar.</>
              )}
            </div>
            <button className="btn-primary" onClick={onClose}>Fechar</button>
          </div>
        ) : (
          <>
            <div style={{fontSize:13,color:"#6E6E73",marginBottom:16,lineHeight:1.5}}>
              Envie uma foto, print ou PDF do extrato da conta corrente ou da fatura do cartão. A IA identifica os lançamentos automaticamente — depois é só revisar as categorias.
            </div>

            {status === "idle" || status === "error" ? (
              <>
                <label style={{display:"block",background:"#F5F5F7",borderRadius:16,padding:28,textAlign:"center",marginBottom:16,cursor:"pointer",border:"2px dashed #D1D1D6"}}>
                  <input type="file" accept="image/*,application/pdf" style={{display:"none"}}
                    onChange={e=>setFile(e.target.files?.[0] ?? null)} />
                  <div style={{fontSize:40,marginBottom:12}}>{file ? "📎" : "📄"}</div>
                  <div style={{fontWeight:600,marginBottom:6}}>{file ? file.name : "Escolher arquivo"}</div>
                  <div style={{fontSize:13,color:"#6E6E73"}}>Foto, print ou PDF do extrato/fatura</div>
                </label>
                {errorMsg && (
                  <div style={{background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.2)",borderRadius:12,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#C9352B"}}>
                    {errorMsg}
                  </div>
                )}
                <button className="btn-primary" disabled={!file} onClick={handleImport} style={{opacity:file?1:0.5}}>
                  Analisar e importar
                </button>
                <button onClick={onClose} style={{width:"100%",padding:12,marginTop:8,background:"transparent",color:"#86868B",border:"none",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
              </>
            ) : (
              <div style={{textAlign:"center",padding:"30px 0"}}>
                <div style={{fontSize:32,marginBottom:14}}>🔎</div>
                <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>
                  {status === "analisando" ? "Lendo o documento…" : "Importando lançamentos…"}
                </div>
                <div style={{fontSize:13,color:"#86868B"}}>Isso pode levar alguns segundos.</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


function useCoupleLink(userId: string | null) {
  const [couple,  setCouple]  = useState<Couple | null>(null);
  const [cLoading, setCLoading] = useState(true);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setCLoading(false); return; }
    setCLoading(true);
    // Check for active link
    const { data: active } = await supabase
      .from("couples")
      .select("*")
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .eq("status", "active")
      .maybeSingle();
    if (active) { setCouple(active as Couple); setPendingInviteToken(null); setPendingEmail(null); setCLoading(false); return; }
    // Check for pending invite sent by this user
    const { data: pending } = await supabase
      .from("couples")
      .select("*")
      .eq("user_id_1", userId)
      .eq("status", "pending")
      .maybeSingle();
    if (pending) { setCouple(null); setPendingInviteToken((pending as Couple).invite_token); setPendingEmail((pending as Couple).invited_email ?? null); }
    else { setCouple(null); setPendingInviteToken(null); setPendingEmail(null); }
    setCLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const partnerUserId = couple
    ? (couple.user_id_1 === userId ? couple.user_id_2 ?? null : couple.user_id_1)
    : null;

  async function sendInvite(email: string): Promise<string | null> {
    if (!userId) return "Não autenticado";
    const token = crypto.randomUUID();
    const { error } = await supabase.from("couples").insert({
      user_id_1: userId,
      invited_email: email,
      status: "pending",
      invite_token: token,
    });
    if (error) return error.message;
    const redirectTo = `${window.location.origin}${window.location.pathname}?invite=${token}`;
    await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    await load();
    return null;
  }

  async function acceptInvite(token: string): Promise<void> {
    if (!userId) return;
    const { data: row } = await supabase
      .from("couples")
      .select("*")
      .eq("invite_token", token)
      .eq("status", "pending")
      .maybeSingle();
    if (!row) return;
    await supabase.from("couples")
      .update({ user_id_2: userId, status: "active" })
      .eq("id", (row as Couple).id);
    await load();
  }

  async function cancelInvite(): Promise<void> {
    if (!userId) return;
    await supabase.from("couples")
      .delete()
      .eq("user_id_1", userId)
      .eq("status", "pending");
    setPendingInviteToken(null); setPendingEmail(null);
  }

  async function unlinkCouple(): Promise<void> {
    if (!couple) return;
    await supabase.from("couples").delete().eq("id", couple.id);
    setCouple(null);
  }

  return { couple, partnerUserId, isLinked: !!couple, pendingInviteToken, pendingEmail, cLoading, sendInvite, acceptInvite, cancelInvite, unlinkCouple, refetch: load };
}

// ─── Contas Fixas page ────────────────────────────────────────────────────────

const CATEGORIAS_FIXAS = ["Moradia","Utilidades","Assinaturas","Dívidas","Transporte","Saúde","Educação","Outros"];

// Calcula a chave "YYYY-MM" da fatura em que uma compra cai, dado o dia de fechamento
function invoiceMonthKey(dataTransacao: string, diaFechamento: number): string {
  const d = new Date(dataTransacao + "T00:00:00");
  let y = d.getFullYear(), m = d.getMonth(); // 0-indexed
  if (d.getDate() > diaFechamento) { m += 1; if (m > 11) { m = 0; y += 1; } }
  return `${y}-${String(m+1).padStart(2,"0")}`;
}
function addMonthsToKey(key: string, n: number): string {
  const [y,m] = key.split("-").map(Number);
  let total = (y*12 + (m-1)) + n;
  const ny = Math.floor(total/12), nm = total%12;
  return `${ny}-${String(nm+1).padStart(2,"0")}`;
}
function monthsBetween(fromKey: string, toKey: string): number {
  const [fy,fm] = fromKey.split("-").map(Number);
  const [ty,tm] = toKey.split("-").map(Number);
  return (ty*12+tm) - (fy*12+fm);
}
function monthKeyLabel(key: string): string {
  const [y,m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m-1]} ${y}`;
}
// Soma o valor de todas as transações de cartão que caem numa fatura específica (respeitando parcelamento)
function invoiceTotalFor(cardId: string, targetMonthKey: string, transactions: NormTx[], diaFechamento: number, linkedBills: BillToPay[] = []): { total: number; count: number } {
  let total = 0, count = 0;
  for (const t of transactions) {
    if (t.cartao_id !== cardId || t.type !== "expense") continue;
    const first = invoiceMonthKey(t.date, diaFechamento);
    const n = t.parcela_total ?? 1;
    for (let i = 0; i < n; i++) {
      if (addMonthsToKey(first, i) === targetMonthKey) { total += t.value / n; count += 1; break; }
    }
  }
  // Contas fixas cujo pagamento é vinculado a este cartão (ex: assinaturas cobradas automaticamente)
  for (const b of linkedBills) {
    if (b.cartao_vinculado_id !== cardId) continue;
    total += b.valor_base ?? 0;
    count += 1;
  }
  return { total, count };
}

// Lista detalhada de cada compra que compõe a fatura de um cartão num mês específico
// (igual ao invoiceTotalFor, mas devolve os itens em vez de só a soma).
function invoiceItemsFor(cardId: string, targetMonthKey: string, transactions: NormTx[], diaFechamento: number, linkedBills: BillToPay[] = []): { nome:string; valor:number; data:string; parcelaInfo:string|null }[] {
  const items: { nome:string; valor:number; data:string; parcelaInfo:string|null }[] = [];
  for (const t of transactions) {
    if (t.cartao_id !== cardId || t.type !== "expense") continue;
    const first = invoiceMonthKey(t.date, diaFechamento);
    const n = t.parcela_total ?? 1;
    for (let i = 0; i < n; i++) {
      if (addMonthsToKey(first, i) === targetMonthKey) {
        items.push({ nome: t.name, valor: t.value / n, data: t.date, parcelaInfo: n > 1 ? `${i+1}/${n}` : null });
        break;
      }
    }
  }
  for (const b of linkedBills) {
    if (b.cartao_vinculado_id !== cardId) continue;
    items.push({ nome: `${b.nome} (assinatura)`, valor: b.valor_base ?? 0, data: "", parcelaInfo: null });
  }
  return items.sort((a,b)=>(b.data??"").localeCompare(a.data??""));
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}
function dueDateForMonthKey(monthKey: string, dia: number): string {
  const [y,m] = monthKey.split("-").map(Number);
  const clamped = Math.min(dia, daysInMonth(y, m-1));
  return `${monthKey}-${String(clamped).padStart(2,"0")}`;
}

function ContasFixasPage({ userId, transactions, accounts, onOpenCartoes }: { userId: string; transactions: NormTx[]; accounts: NormAccount[]; onOpenCartoes: () => void }) {
  const [all, setAll] = useState<BillToPay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BillToPay | null>(null);
  const [historyFor, setHistoryFor] = useState<BillToPay | null>(null);
  const [form, setForm] = useState({ nome:"", valor_base:"", primeira_data:"", categoria:CATEGORIAS_FIXAS[0], parcelas_totais:"", forma_pagamento:"pix", cartao_vinculado_id:"" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:"success"|"error"}|null>(null);
  const [payingBill, setPayingBill] = useState<BillToPay | null>(null);
  const [calendarLink, setCalendarLink] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ data_pagamento:"", motivo_atraso:"", juros:"", contaId:"" });
  const [removeAnexo, setRemoveAnexo] = useState(false);
  const formSheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showForm && formSheetRef.current) {
      formSheetRef.current.scrollTop = 0;
    }
  }, [showForm]);

  const [cardsSummary, setCardsSummary] = useState<BillToPay[]>([]);
  const [allRaw, setAllRaw] = useState<BillToPay[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("bills_to_pay").select("*").order("nome", { ascending: true });
    if (!error) {
      setAll((data ?? []).filter((b: BillToPay) => !b.dia_fechamento) as BillToPay[]);
      setCardsSummary((data ?? []).filter((b: BillToPay) => b.recorrente && !!b.dia_fechamento) as BillToPay[]);
      setAllRaw((data ?? []) as BillToPay[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefetchOnFocus(load);

  useEffect(() => { if (toast) { const t = setTimeout(()=>setToast(null), toast.type==="error"?8000:3000); return () => clearTimeout(t); } }, [toast]);

  const templates = all.filter(b => b.recorrente);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  const cardsTotalAtual = cardsSummary.reduce((sum, card) => {
    const inst = allRaw.find(b => b.template_id === card.id && (b.data_vencimento ?? "").startsWith(monthKey));
    return sum + (inst ? (inst.valor_base ?? 0) : invoiceTotalFor(card.id, monthKey, transactions, card.dia_fechamento ?? 1, templates).total);
  }, 0);

  const instanceForTemplateThisMonth = (tplId: string) =>
    all.find(b => b.template_id === tplId && (b.data_vencimento ?? "").startsWith(monthKey));

  const historyForTemplate = (tplId: string) =>
    all.filter(b => b.template_id === tplId).sort((a,b)=>(b.data_vencimento??"").localeCompare(a.data_vencimento??""));

  const lastInstallmentMonthKey = (tplId: string): string =>
    historyForTemplate(tplId).reduce((max, h) => {
      const mk = (h.data_vencimento ?? "").slice(0,7);
      return mk > max ? mk : max;
    }, "");

  const isPlanCompleted = (tpl: BillToPay) => {
    if (!tpl.parcelas_totais) return false;
    const lastMonth = lastInstallmentMonthKey(tpl.id);
    return lastMonth !== "" && monthKey > lastMonth;
  };

  const isUltimaParcela = (tpl: BillToPay) => {
    if (!tpl.parcelas_totais) return false;
    return lastInstallmentMonthKey(tpl.id) === monthKey;
  };

  const todayIso = now.toISOString().slice(0,10);
  const isOverdue = (b: BillToPay) =>
    !!b.data_vencimento && b.data_vencimento < todayIso && (b.status ?? "").toLowerCase() !== "pago";
  const overdueBills = all.filter(b => !!b.data_vencimento && isOverdue(b));

  // Prévia de mês/ano futuro (planejamento) — não gera nada no banco, só calcula
  const [previewMonth, setPreviewMonth] = useState<string | null>(null);
  const [showMonthInput, setShowMonthInput] = useState(false);
  const isPreview = previewMonth !== null && previewMonth !== monthKey;

  function monthsBetween(fromKey: string, toKey: string): number {
    const [fy,fm] = fromKey.split("-").map(Number);
    const [ty,tm] = toKey.split("-").map(Number);
    return (ty*12+tm) - (fy*12+fm);
  }

  const previewData = (() => {
    if (!isPreview || !previewMonth) return null;
    const fixedPreview = templates
      .filter(t => t.forma_pagamento !== "cartao")
      .map(t => {
        // Se a parcela desse mês já foi gerada de verdade no banco (parcelas com total definido
        // são todas pré-geradas), usa o dado real em vez de estimar.
        const real = all.find(b => b.template_id === t.id && (b.data_vencimento ?? "").startsWith(previewMonth));
        if (real) {
          let parcela: string | null = null;
          if (t.parcelas_totais) {
            const ordenado = historyForTemplate(t.id).sort((a,b)=>(a.data_vencimento??"").localeCompare(b.data_vencimento??""));
            const posicao = ordenado.findIndex(h => h.id === real.id) + 1;
            if (posicao > 0) parcela = `${posicao}/${t.parcelas_totais}`;
          }
          return { nome: t.nome ?? "Conta", valor: real.valor_base ?? 0, data: real.data_vencimento ?? dueDateForMonthKey(previewMonth, t.dia_vencimento ?? 5), parcela };
        }
        // Conta corrente (sem total de parcelas) ainda não gerada tão à frente: estima pela referência
        if (!t.parcelas_totais) {
          return { nome: t.nome ?? "Conta", valor: t.valor_base ?? 0, data: dueDateForMonthKey(previewMonth, t.dia_vencimento ?? 5), parcela: null as string | null };
        }
        // Plano com total definido e sem cobrança real nesse mês: já encerrou antes desse mês
        return null;
      })
      .filter((x): x is { nome:string; valor:number; data:string; parcela: string | null } => x !== null);

    const cardsPreview = cardsSummary.map(card => ({
      nome: card.nome ?? "Cartão",
      valor: invoiceTotalFor(card.id, previewMonth, transactions, card.dia_fechamento ?? 1, templates).total,
    })).filter(c => c.valor > 0);

    const totalFixed = fixedPreview.reduce((s,f)=>s+f.valor,0);
    const totalCards = cardsPreview.reduce((s,c)=>s+c.valor,0);
    return { fixedPreview, cardsPreview, totalFixed, totalCards, total: totalFixed+totalCards };
  })();

  async function saveTemplate() {
    if (!form.nome.trim()) { setToast({msg:"Preencha o nome",type:"error"}); return; }
    if (!form.valor_base) { setToast({msg:"Preencha o valor",type:"error"}); return; }
    if (form.forma_pagamento !== "cartao" && !form.primeira_data) { setToast({msg:"Preencha a primeira data de vencimento",type:"error"}); return; }
    if (form.forma_pagamento === "cartao" && !form.cartao_vinculado_id) { setToast({msg:"Selecione o cartão vinculado",type:"error"}); return; }
    setSaving(true);

    let anexoUrl: string | null = null;
    let anexoNome: string | null = null;
    if (anexoFile) {
      setUploadingAnexo(true);
      const path = `${userId}/${Date.now()}-${anexoFile.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const { error: upErr } = await supabase.storage.from("anexos").upload(path, anexoFile);
      setUploadingAnexo(false);
      if (upErr) { setSaving(false); setToast({msg:`Erro ao enviar anexo: ${upErr.message}`,type:"error"}); return; }
      anexoUrl = supabase.storage.from("anexos").getPublicUrl(path).data.publicUrl;
      anexoNome = anexoFile.name;
    }

    const diaVencimentoCalculado = form.primeira_data ? new Date(form.primeira_data + "T00:00:00").getDate() : null;
    const payload: Record<string, unknown> = {
      nome: form.nome.trim(),
      valor_base: form.valor_base ? parseFloat(form.valor_base.replace(",",".")) : 0,
      dia_vencimento: diaVencimentoCalculado,
      categoria: form.categoria,
      recorrente: true,
      user_id: userId,
      status: "pendente",
      parcelas_totais: form.parcelas_totais ? parseInt(form.parcelas_totais,10) : null,
      forma_pagamento: form.forma_pagamento,
      cartao_vinculado_id: form.forma_pagamento === "cartao" ? form.cartao_vinculado_id : null,
      ...(anexoUrl ? { anexo_url: anexoUrl, anexo_nome: anexoNome } : removeAnexo ? { anexo_url: null, anexo_nome: null } : {}),
    };
    if (editing) {
      const { error } = await supabase.from("bills_to_pay").update(payload).eq("id", editing.id);
      if (error) { setToast({msg:`Erro ao salvar: ${error.message}`,type:"error"}); console.error(error); }
      else setToast({msg:"Conta fixa atualizada",type:"success"});
    } else {
      const { data: created, error } = await supabase.from("bills_to_pay").insert(payload).select().single();
      if (error) { setToast({msg:`Erro ao criar: ${error.message}`,type:"error"}); console.error(error); }
      else {
        if (created && form.primeira_data && form.forma_pagamento !== "cartao") {
          const totalParcelas = form.parcelas_totais ? parseInt(form.parcelas_totais,10) : null;
          const valorParcela = form.valor_base ? parseFloat(form.valor_base.replace(",",".")) : 0;
          const primeiraMonthKey = form.primeira_data.slice(0,7);

          if (totalParcelas && totalParcelas > 1) {
            // Total de parcelas conhecido: gera todas as cobranças de uma vez e já agenda cada uma
            for (let i = 0; i < totalParcelas; i++) {
              const mesInstalado = addMonthsToKey(primeiraMonthKey, i);
              const dataInstalado = i === 0 ? form.primeira_data : dueDateForMonthKey(mesInstalado, diaVencimentoCalculado ?? 5);
              const { data: inst, error: instErr } = await supabase.from("bills_to_pay").insert({
                nome: form.nome.trim(), valor_base: valorParcela, categoria: form.categoria,
                data_vencimento: dataInstalado, status: "pendente", recorrente: false,
                template_id: created.id, user_id: userId,
              }).select().single();
              if (instErr) { console.error(instErr); continue; }
              if (inst) {
                syncBillToCalendar(userId, {
                  billId: inst.id,
                  title: `${form.nome.trim()} (Parcela ${i+1}/${totalParcelas})`,
                  date: dataInstalado, amount: valorParcela,
                }).catch((e)=>console.error("Erro ao sincronizar parcela com Google Agenda:", e));
              }
            }
          } else {
            // Conta corrente (sem total definido): gera só a primeira, as próximas vêm mês a mês
            const { data: firstInstance, error: instErr } = await supabase.from("bills_to_pay").insert({
              nome: form.nome.trim(), valor_base: valorParcela, categoria: form.categoria,
              data_vencimento: form.primeira_data, status: "pendente", recorrente: false,
              template_id: created.id, user_id: userId,
            }).select().single();
            if (instErr) console.error(instErr);
            else if (firstInstance) {
              syncBillToCalendar(userId, { billId: firstInstance.id, title: form.nome.trim(), date: form.primeira_data, amount: valorParcela }).catch((e)=>{ console.error("Erro ao sincronizar com Google Agenda:", e); setToast({msg:`Conta salva, mas não sincronizou com a agenda: ${e instanceof Error ? e.message : "erro desconhecido"}`,type:"error"}); });
            }
          }
        }
        setToast({msg:"Conta fixa criada",type:"success"});
      }
    }
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    setAnexoFile(null); setRemoveAnexo(false);
    setForm({ nome:"", valor_base:"", primeira_data:"", categoria:CATEGORIAS_FIXAS[0], parcelas_totais:"", forma_pagamento:"pix", cartao_vinculado_id:"" });
    load();
  }

  async function generateThisMonth(tpl: BillToPay) {
    if (tpl.forma_pagamento === "cartao") return;
    if (instanceForTemplateThisMonth(tpl.id)) { setToast({msg:"Já gerada este mês",type:"error"}); return; }
    if (isPlanCompleted(tpl)) { setToast({msg:"Parcelamento já concluído",type:"error"}); return; }
    const data_vencimento = dueDateForMonthKey(monthKey, tpl.dia_vencimento ?? 5);
    const { data: created, error } = await supabase.from("bills_to_pay").insert({
      nome: tpl.nome, valor_base: tpl.valor_base, categoria: tpl.categoria,
      data_vencimento, status: "pendente", recorrente: false, template_id: tpl.id, user_id: userId,
    }).select().single();
    if (error) setToast({msg:"Erro ao gerar",type:"error"});
    else {
      setToast({msg:"Despesa do mês gerada",type:"success"});
      if (created) {
        const numeroParcela = historyForTemplate(tpl.id).length; // já inclui a recém-criada
        const tituloAgenda = tpl.parcelas_totais ? `${tpl.nome} (Parcela ${numeroParcela}/${tpl.parcelas_totais})` : (tpl.nome ?? "Despesa fixa");
        syncBillToCalendar(userId, { billId: created.id, title: tituloAgenda, date: data_vencimento, amount: tpl.valor_base ?? 0 }).catch((e)=>{ console.error("Erro ao sincronizar com Google Agenda:", e); });
      }
    }
    load();
  }

  // Gera automaticamente as cobranças do mês assim que a página carrega, sem precisar clicar
  const autoGenRan = useRef(false);
  useEffect(() => {
    if (loading || autoGenRan.current || all.length === 0) return;
    const pending = templates.filter(t => t.forma_pagamento !== "cartao" && !isPlanCompleted(t) && !instanceForTemplateThisMonth(t.id));
    if (pending.length > 0) {
      autoGenRan.current = true;
      (async () => {
        for (const tpl of pending) await generateThisMonth(tpl);
      })();
    }
  }, [loading, all]); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateInstanceValue(instance: BillToPay, newValue: number) {
    const { error } = await supabase.from("bills_to_pay").update({ valor_base: newValue }).eq("id", instance.id);
    if (error) setToast({msg:"Erro ao atualizar valor",type:"error"});
    else setToast({msg:"Valor atualizado",type:"success"});
    load();
  }

  async function addInstanceToCalendar(instance: BillToPay, tpl: BillToPay) {
    try {
      let titulo = tpl.nome ?? "Conta fixa";
      if (tpl.parcelas_totais) {
        const historico = historyForTemplate(tpl.id).sort((a,b)=>(a.data_vencimento??"").localeCompare(b.data_vencimento??""));
        const posicao = historico.findIndex(h => h.id === instance.id);
        if (posicao >= 0) titulo = `${titulo} (Parcela ${posicao+1}/${tpl.parcelas_totais})`;
      }
      const result = await syncBillToCalendar(userId, { billId: instance.id, title: titulo, date: instance.data_vencimento ?? todayIso, amount: (instance.valor_base??0)+(instance.juros_atraso??0) });
      if (result.htmlLink) {
        setCalendarLink(result.htmlLink);
      } else {
        setToast({msg:"Sincronizado, mas o Google não retornou um link do evento",type:"error"});
      }
    } catch (e) {
      setToast({msg: e instanceof Error ? e.message : "Erro ao adicionar à agenda", type:"error"});
    }
  }

  async function toggleStatus(instance: BillToPay) {
    const jaPago = (instance.status ?? "pendente").toLowerCase() === "pago";
    if (jaPago) {
      await supabase.from("bills_to_pay").update({ status: "pendente", data_pagamento: null, motivo_atraso: null }).eq("id", instance.id);
      load();
      return;
    }
    setPayingBill(instance);
    setPayForm({ data_pagamento: todayIso, motivo_atraso: "", juros: String(instance.juros_atraso ?? ""), contaId: accounts[0]?.id ?? "" });
  }

  async function confirmPayment() {
    if (!payingBill) return;
    setSaving(true);
    const dataPagamento = payForm.data_pagamento || todayIso;
    const jurosValor = payForm.juros ? parseFloat(payForm.juros.replace(",",".")) : null;
    const { error } = await supabase.from("bills_to_pay").update({
      status: "pago",
      data_pagamento: dataPagamento,
      motivo_atraso: isOverdue(payingBill) ? (payForm.motivo_atraso || null) : null,
      juros_atraso: jurosValor,
    }).eq("id", payingBill.id);
    if (error) { setSaving(false); setToast({msg:`Erro ao registrar pagamento: ${error.message}`,type:"error"}); return; }

    // Espelha o pagamento em Transações e ajusta o saldo da conta usada
    if (payForm.contaId) {
      const tplRef = templates.find(t => t.id === payingBill.template_id);
      const meioMap: Record<string,string> = { pix:"pix", boleto:"boleto", cartao:"credito" };
      const meio = meioMap[tplRef?.forma_pagamento ?? "pix"] ?? "pix";
      const valorTotal = (payingBill.valor_base ?? 0) + (jurosValor ?? 0);
      await supabase.from("transactions").insert({
        user_id: userId, account_id: payForm.contaId,
        descricao: payingBill.nome, valor: valorTotal, tipo: "despesa",
        data_transacao: dataPagamento, categoria: payingBill.categoria ?? "Outros",
        tipo_escopo: "Despesa Familiar", meio_pagamento: meio,
      });
      await adjustAccountBalance(payForm.contaId, -valorTotal);
    }

    setSaving(false);
    setToast({msg:"Pagamento registrado",type:"success"});
    setPayingBill(null);
    load();
  }

  async function deleteTemplate(tpl: BillToPay) {
    if (!confirm(`Remover "${tpl.nome}" e todo o histórico de instâncias geradas?`)) return;
    await supabase.from("bills_to_pay").delete().eq("template_id", tpl.id);
    await supabase.from("bills_to_pay").delete().eq("id", tpl.id);
    load();
  }

  return (
    <div className="scroll-content page-fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div className="section-title" style={{margin:0}}>Contas Fixas</div>
        <span className="section-link" onClick={()=>{setEditing(null);setForm({nome:"",valor_base:"",primeira_data:"",categoria:CATEGORIAS_FIXAS[0],parcelas_totais:"",forma_pagamento:"pix",cartao_vinculado_id:""});setAnexoFile(null);setRemoveAnexo(false);setShowForm(true);}}>+ Nova conta fixa</span>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>{setShowMonthInput(v=>!v); if (!previewMonth) setPreviewMonth(monthKey);}}
          style={{flex:1,padding:"9px",borderRadius:10,border:"1.5px solid #E5E5EA",background:isPreview?"#007AFF":"#FFF",color:isPreview?"#FFF":"#1D1D1F",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          📅 {isPreview && previewMonth ? `Prévia: ${monthKeyLabel(previewMonth)}` : "Ver mês futuro"}
        </button>
        {isPreview && (
          <button onClick={()=>{setPreviewMonth(null);setShowMonthInput(false);}} style={{padding:"9px 14px",borderRadius:10,border:"1.5px solid #E5E5EA",background:"#FFF",color:"#86868B",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            Voltar a hoje
          </button>
        )}
      </div>

      {showMonthInput && (
        <div style={{marginTop:-8,marginBottom:14}}>
          <input type="month" value={previewMonth ?? monthKey} min={monthKey}
            onChange={e=>{setPreviewMonth(e.target.value); setShowMonthInput(false);}}
            style={{width:"100%",padding:"10px 12px",border:"1.5px solid #E5E5EA",borderRadius:10,fontSize:14,fontFamily:"inherit"}} />
        </div>
      )}

      {isPreview && previewData && (
        <div style={{background:"#F0F7FF",border:"1px solid #B3D9FF",borderRadius:16,padding:16,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:600,color:"#007AFF",marginBottom:10}}>📋 Prévia para {monthKeyLabel(previewMonth!)}</div>
          {previewData.fixedPreview.length === 0 && previewData.cardsPreview.length === 0 ? (
            <div style={{fontSize:13,color:"#6E6E73"}}>Nenhuma conta ou fatura prevista para esse mês.</div>
          ) : (
            <>
              {previewData.fixedPreview.map((f,i) => (
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}}>
                  <span style={{color:"#1D1D1F"}}>{f.nome} <span style={{color:"#86868B",fontSize:11}}>({new Date(f.data+"T00:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"})}{f.parcela ? ` · ${f.parcela}` : ""})</span></span>
                  <span style={{color:"#1D1D1F",fontWeight:600}}>{formatBRL(f.valor)}</span>
                </div>
              ))}
              {previewData.cardsPreview.map((c,i) => (
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0"}}>
                  <span style={{color:"#1D1D1F"}}>💳 {c.nome}</span>
                  <span style={{color:"#1D1D1F",fontWeight:600}}>{formatBRL(c.valor)}</span>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700,marginTop:10,paddingTop:10,borderTop:"1px solid #B3D9FF"}}>
                <span>Total previsto</span>
                <span>{formatBRL(previewData.total)}</span>
              </div>
            </>
          )}
          <div style={{fontSize:11,color:"#6E6E73",marginTop:10,lineHeight:1.5}}>
            Estimativa baseada nas contas e parcelamentos já cadastrados — nada aqui é gerado de verdade no banco.
          </div>
        </div>
      )}

      {cardsSummary.length > 0 && (
        <div onClick={onOpenCartoes} style={{background:"#F5F5F7",borderRadius:14,padding:"12px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
          <div>
            <div style={{fontSize:12,color:"#86868B"}}>💳 Cartões de crédito (fatura atual)</div>
            <div style={{fontSize:11,color:"#007AFF",marginTop:2}}>Ver detalhamento em Cartões →</div>
          </div>
          <span style={{fontSize:16,fontWeight:700,color:"#FF3B30"}}>{formatBRL(cardsTotalAtual)}</span>
        </div>
      )}

      {overdueBills.length > 0 && (
        <div style={{background:"#FFEBEE",borderRadius:14,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600,color:"#D32F2F",marginBottom:6}}>
            ⚠️ {overdueBills.length} conta{overdueBills.length!==1?"s":""} em atraso
          </div>
          {overdueBills.map(b => (
            <div key={b.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#B71C1C",padding:"2px 0"}}>
              <span>{b.nome}</span>
              <span>vencia em {b.data_vencimento ? new Date(b.data_vencimento+"T00:00:00").toLocaleDateString("pt-BR") : "—"}</span>
            </div>
          ))}
        </div>
      )}

      {isPreview ? null : loading ? (
        <div style={{textAlign:"center",padding:40,color:"#86868B"}}>Carregando…</div>
      ) : templates.length === 0 ? (
        <div style={{textAlign:"center",padding:"40px 20px",color:"#86868B"}}>
          <div style={{fontSize:40,marginBottom:10}}>📌</div>
          <div style={{fontSize:14}}>Nenhuma conta fixa cadastrada ainda.<br/>Cadastre aluguel, internet, assinaturas etc. e a cobrança de cada mês é gerada automaticamente.</div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {templates.map(tpl => {
            const instance = instanceForTemplateThisMonth(tpl.id);
            const paid = (instance?.status ?? "").toLowerCase() === "pago";
            const historicoOrdenado = historyForTemplate(tpl.id).sort((a,b)=>(a.data_vencimento??"").localeCompare(b.data_vencimento??""));
            const posicaoAtual = instance ? historicoOrdenado.findIndex(h => h.id === instance.id) + 1 : historicoOrdenado.length;
            const completed = isPlanCompleted(tpl);
            const isCardLinked = tpl.forma_pagamento === "cartao";
            const linkedCardName = isCardLinked ? cardsSummary.find(c=>c.id===tpl.cartao_vinculado_id)?.nome : null;
            const formaLabel = tpl.forma_pagamento === "cartao" ? "💳 Cartão" : tpl.forma_pagamento === "boleto" ? "🧾 Boleto" : "🔑 Pix";
            return (
              <div key={tpl.id} style={{background:"#F5F5F7",borderRadius:16,padding:14,opacity:completed?0.65:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:"#1D1D1F"}}>{tpl.nome}</div>
                    <div style={{fontSize:12,color:"#86868B",marginTop:2}}>
                      {tpl.categoria} · {formaLabel}{!isCardLinked ? ` · vence ${instance?.data_vencimento ? new Date(instance.data_vencimento+"T00:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}) : `dia ${tpl.dia_vencimento}`}` : ""} · ref. {formatBRL(tpl.valor_base ?? 0)}
                      {!isCardLinked && (tpl.parcelas_totais ? ` · ${posicaoAtual}/${tpl.parcelas_totais} parcelas` : " · corrente")}
                    </div>
                    {tpl.anexo_url && (
                      <a href={tpl.anexo_url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#007AFF",marginTop:4,display:"inline-block"}}>📎 {tpl.anexo_nome ?? "Ver anexo"}</a>
                    )}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <span onClick={()=>{setEditing(tpl);const d=new Date();const day=Math.min(tpl.dia_vencimento??5,daysInMonth(d.getFullYear(),d.getMonth()));const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;setForm({nome:tpl.nome??"",valor_base:String(tpl.valor_base??""),primeira_data:iso,categoria:tpl.categoria??CATEGORIAS_FIXAS[0],parcelas_totais:String(tpl.parcelas_totais??""),forma_pagamento:tpl.forma_pagamento??"pix",cartao_vinculado_id:tpl.cartao_vinculado_id??""});setAnexoFile(null);setRemoveAnexo(false);setShowForm(true);}} style={{cursor:"pointer",fontSize:16}}>✏️</span>
                    <span onClick={()=>deleteTemplate(tpl)} style={{cursor:"pointer",fontSize:16}}>🗑️</span>
                  </div>
                </div>

                <div style={{marginTop:10,paddingTop:10,borderTop:"0.5px solid #E5E5E7"}}>
                  {isCardLinked ? (
                    <div style={{fontSize:12,color:"#86868B",lineHeight:1.5}}>
                      💳 Cobrado automaticamente na fatura do cartão <strong>{linkedCardName ?? "—"}</strong>. Não é contado separadamente para evitar duplicidade — acompanhe em <span onClick={onOpenCartoes} style={{color:"#007AFF",cursor:"pointer"}}>Cartões</span>.
                    </div>
                  ) : completed && (!instance || paid) ? (
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:13,color:"#34C759",fontWeight:600}}>✓ Parcelamento concluído</span>
                      <span onClick={()=>setHistoryFor(tpl)} style={{fontSize:12,color:"#007AFF",cursor:"pointer"}}>Histórico</span>
                    </div>
                  ) : !instance ? (
                    <div style={{fontSize:13,color:"#86868B",padding:"6px 0"}}>Aguardando geração automática deste mês…</div>
                  ) : (
                    <div>
                      {isUltimaParcela(tpl) && (
                        <div style={{fontSize:11,color:"#FF9500",fontWeight:600,marginBottom:6}}>Última parcela — marque como paga para concluir</div>
                      )}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span
                            onClick={()=>toggleStatus(instance)}
                            style={{width:20,height:20,borderRadius:6,border:paid?"none":"1.5px solid #C7C7CC",background:paid?"#34C759":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:12,color:"#FFF"}}
                          >{paid?"✓":""}</span>
                          <input
                            type="text" defaultValue={String(instance.valor_base ?? "")}
                            onBlur={(e)=>{ const v = parseFloat(e.target.value.replace(",",".")); if (!isNaN(v) && v !== instance.valor_base) updateInstanceValue(instance, v); }}
                            style={{width:90,padding:"6px 8px",border:"1px solid #E5E5E7",borderRadius:8,fontSize:13,fontFamily:"inherit"}}
                          />
                          <span style={{fontSize:12,color:paid?"#34C759":isOverdue(instance)?"#FF3B30":"#FF9500",fontWeight:600}}>
                            {paid?"Pago":isOverdue(instance)?"Atrasada":"Pendente"}
                          </span>
                        </div>
                        <div style={{display:"flex",gap:10,alignItems:"center"}}>
                          <span onClick={()=>addInstanceToCalendar(instance, tpl)} title="Adicionar à agenda" style={{fontSize:14,cursor:"pointer"}}>📅</span>
                          <span onClick={()=>setHistoryFor(tpl)} style={{fontSize:12,color:"#007AFF",cursor:"pointer"}}>Histórico</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && createPortal(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setShowForm(false)}>
          <div className="modal-sheet-center" ref={formSheetRef} onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>{editing?"Editar":"Nova"} conta fixa</div>
            <input placeholder="Nome (ex: Aluguel, Internet)" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <select value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}
                style={{flex:1,padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,fontFamily:"inherit",background:"#FFF"}}>
                {CATEGORIAS_FIXAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <input placeholder="Valor de referência (R$)" value={form.valor_base} onChange={e=>setForm(f=>({...f,valor_base:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />

            <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Como é paga</label>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              {(["pix","cartao","boleto"] as const).map(fp => (
                <button key={fp} onClick={()=>setForm(f=>({...f,forma_pagamento:fp}))}
                  style={{flex:1,padding:"9px",borderRadius:10,border:form.forma_pagamento===fp?"none":"1.5px solid #E5E5EA",background:form.forma_pagamento===fp?"#007AFF":"#FFF",color:form.forma_pagamento===fp?"#FFF":"#1D1D1F",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  {fp==="pix"?"🔑 Pix":fp==="cartao"?"💳 Cartão":"🧾 Boleto"}
                </button>
              ))}
            </div>

            {form.forma_pagamento === "cartao" ? (
              <>
                <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Cartão vinculado</label>
                {cardsSummary.length === 0 ? (
                  <div style={{fontSize:12,color:"#86868B",marginBottom:10}}>Nenhum cartão cadastrado ainda. Cadastre em <strong>Cartões</strong> primeiro.</div>
                ) : (
                  <select value={form.cartao_vinculado_id} onChange={e=>setForm(f=>({...f,cartao_vinculado_id:e.target.value}))}
                    style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit",background:"#FFF"}}>
                    <option value="">Selecione o cartão</option>
                    {cardsSummary.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                )}
                <div style={{fontSize:12,color:"#86868B",marginBottom:10,lineHeight:1.5}}>
                  Essa despesa entra automaticamente na fatura do cartão escolhido todo mês, e não é contada separadamente — evitando duplicidade no relatório.
                </div>
              </>
            ) : (
              <>
                <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Primeira data de vencimento</label>
                <input type="date" value={form.primeira_data} onChange={e=>setForm(f=>({...f,primeira_data:e.target.value}))}
                  style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:6,fontFamily:"inherit"}} />
                <div style={{fontSize:12,color:"#86868B",marginBottom:10,lineHeight:1.5}}>
                  A partir dessa data, os meses seguintes vencem automaticamente no mesmo dia (ajustando sozinho para meses mais curtos, como fevereiro).
                </div>
                <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Quantidade de parcelas (opcional)</label>
                <input placeholder="Deixe em branco para recorrência contínua" type="number" min={1} value={form.parcelas_totais} onChange={e=>setForm(f=>({...f,parcelas_totais:e.target.value}))}
                  style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:6,fontFamily:"inherit"}} />
                <div style={{fontSize:12,color:"#86868B",marginBottom:10,lineHeight:1.5}}>
                  {form.parcelas_totais
                    ? `Essa despesa vai gerar cobrança por ${form.parcelas_totais} meses e depois parar automaticamente (ex: negociação de dívidas).`
                    : "Sem quantidade definida, é uma conta corrente: continua gerando cobrança todo mês, indefinidamente."}
                </div>

                <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Anexar {form.forma_pagamento==="boleto"?"boleto":"chave Pix / comprovante"} (opcional)</label>
                {editing?.anexo_url && !removeAnexo && !anexoFile ? (
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"#FAFAFA",borderRadius:12,marginBottom:10}}>
                    <a href={editing.anexo_url} target="_blank" rel="noopener noreferrer" style={{fontSize:13,color:"#007AFF",textDecoration:"none"}}>📎 {editing.anexo_nome ?? "Ver anexo"}</a>
                    <span onClick={()=>setRemoveAnexo(true)} style={{cursor:"pointer",fontSize:16}}>🗑️</span>
                  </div>
                ) : (
                  <input type="file" accept="image/*,application/pdf" onChange={e=>{setAnexoFile(e.target.files?.[0] ?? null); setRemoveAnexo(false);}}
                    style={{width:"100%",padding:"10px",border:"1.5px dashed #C7C7CC",borderRadius:12,fontSize:13,fontFamily:"inherit",background:"#FAFAFA",marginBottom:10}} />
                )}
                {anexoFile && <div style={{fontSize:12,color:"#34C759",marginBottom:10}}>📎 {anexoFile.name}</div>}
              </>
            )}

            <button disabled={saving||uploadingAnexo} onClick={saveTemplate} style={{width:"100%",padding:14,background:"#007AFF",color:"#FFF",border:"none",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:(saving||uploadingAnexo)?0.6:1}}>
              {uploadingAnexo?"Enviando anexo…":saving?"Salvando…":"Salvar"}
            </button>
            <button onClick={()=>setShowForm(false)} style={{width:"100%",padding:12,background:"transparent",color:"#86868B",border:"none",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
          </div>
        </div>,
        document.body
      )}

      {/* Calendar link confirmation */}
      {calendarLink && createPortal(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setCalendarLink(null)}>
          <div className="modal-sheet-center" onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:420,borderRadius:20,padding:24,textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:10}}>📅</div>
            <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>Evento sincronizado!</div>
            <div style={{fontSize:13,color:"#86868B",marginBottom:20}}>Toque no link abaixo para conferir na sua Google Agenda.</div>
            <a href={calendarLink} target="_blank" rel="noopener noreferrer"
              style={{display:"block",padding:14,background:"#007AFF",color:"#FFF",borderRadius:14,fontSize:14,fontWeight:700,textDecoration:"none",marginBottom:10}}>
              Abrir evento na Google Agenda
            </a>
            <button onClick={()=>setCalendarLink(null)} style={{width:"100%",padding:12,background:"transparent",color:"#86868B",border:"none",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Fechar</button>
          </div>
        </div>,
        document.body
      )}

      {/* Payment modal */}
      {payingBill && createPortal(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setPayingBill(null)}>
          <div className="modal-sheet-center" onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontSize:17,fontWeight:600,marginBottom:6}}>Registrar pagamento</div>
            <div style={{fontSize:13,color:"#86868B",marginBottom:16}}>{payingBill.nome} · {formatBRL((payingBill.valor_base??0)+(payingBill.juros_atraso??0))}</div>

            <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Data do pagamento</label>
            <input type="date" value={payForm.data_pagamento} onChange={e=>setPayForm(f=>({...f,data_pagamento:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />

            <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Pago com qual conta?</label>
            <select value={payForm.contaId} onChange={e=>setPayForm(f=>({...f,contaId:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit",background:"#FFF"}}>
              <option value="">Não espelhar em Transações</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>

            {isOverdue(payingBill) && (
              <>
                <label style={{fontSize:12,color:"#FF3B30",display:"block",marginBottom:4}}>Motivo do atraso</label>
                <input placeholder="Ex: esqueci, sem saldo, aguardando recebimento..." value={payForm.motivo_atraso} onChange={e=>setPayForm(f=>({...f,motivo_atraso:e.target.value}))}
                  style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />
              </>
            )}

            <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Juros/multa pagos (opcional, R$)</label>
            <input placeholder="0,00" value={payForm.juros} onChange={e=>setPayForm(f=>({...f,juros:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:16,fontFamily:"inherit"}} />

            <button disabled={saving} onClick={confirmPayment} style={{width:"100%",padding:14,background:"#34C759",color:"#FFF",border:"none",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.6:1}}>
              {saving?"Salvando…":"Confirmar pagamento"}
            </button>
            <button onClick={()=>setPayingBill(null)} style={{width:"100%",padding:12,background:"transparent",color:"#86868B",border:"none",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
          </div>
        </div>,
        document.body
      )}

      {/* History modal */}
      {historyFor && createPortal(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setHistoryFor(null)}>
          <div className="modal-sheet-center" onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"70vh",overflowY:"auto"}}>
            <div style={{fontSize:17,fontWeight:600,marginBottom:14}}>Histórico — {historyFor.nome}</div>
            {historyForTemplate(historyFor.id).length === 0 ? (
              <div style={{fontSize:13,color:"#86868B"}}>Nenhuma cobrança gerada ainda.</div>
            ) : (
              historyForTemplate(historyFor.id).sort((a,b)=>(a.data_vencimento??"").localeCompare(b.data_vencimento??"")).map((h,idx,arr) => {
                const paidH = (h.status??"").toLowerCase()==="pago";
                return (
                <div key={h.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"0.5px solid #E5E5E7"}}>
                  <span style={{fontSize:13,color:"#1D1D1F"}}>
                    {h.data_vencimento ? new Date(h.data_vencimento+"T00:00:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"}) : "—"}
                    {historyFor.parcelas_totais ? ` · ${idx+1}/${historyFor.parcelas_totais}` : ""}
                  </span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span
                      onClick={()=>toggleStatus(h)}
                      style={{width:18,height:18,borderRadius:5,border:paidH?"none":"1.5px solid #C7C7CC",background:paidH?"#34C759":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:11,color:"#FFF",flexShrink:0}}
                    >{paidH?"✓":""}</span>
                    <input
                      type="text" defaultValue={String(h.valor_base ?? "")}
                      onBlur={(e)=>{ const v = parseFloat(e.target.value.replace(",",".")); if (!isNaN(v) && v !== h.valor_base) updateInstanceValue(h, v); }}
                      style={{width:78,padding:"5px 7px",border:"1px solid #E5E5E7",borderRadius:8,fontSize:12,fontFamily:"inherit",textAlign:"right"}}
                    />
                    <span onClick={()=>addInstanceToCalendar(h, historyFor)} title="Adicionar/atualizar na agenda" style={{fontSize:14,cursor:"pointer"}}>📅</span>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}

      {toast && createPortal(
        <div style={{position:"fixed",bottom:90,left:16,right:16,maxWidth:568,margin:"0 auto",background:toast.type==="error"?"#FF3B30":"#1D1D1F",color:"#FFF",padding:"12px 16px",borderRadius:12,fontSize:13,textAlign:"center",zIndex:300}}>
          {toast.msg}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Cartões page ─────────────────────────────────────────────────────────────

function CartoesPage({ userId, transactions, accounts, onImported }: { userId: string; transactions: NormTx[]; accounts: NormAccount[]; onImported: () => void }) {
  const [all, setAll] = useState<BillToPay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BillToPay | null>(null);
  const [historyFor, setHistoryFor] = useState<BillToPay | null>(null);
  const [form, setForm] = useState({ nome:"", dia_fechamento:"", dia_vencimento:"" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:"success"|"error"}|null>(null);
  const [payingBill, setPayingBill] = useState<BillToPay | null>(null);
  const [payForm, setPayForm] = useState({ data_pagamento:"", motivo_atraso:"", juros:"" });
  const [showImportFatura, setShowImportFatura] = useState(false);
  const [selectedCardSlice, setSelectedCardSlice] = useState<number|null>(null);
  const [detailCard, setDetailCard] = useState<BillToPay | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const formSheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (showForm && formSheetRef.current) formSheetRef.current.scrollTop = 0; }, [showForm]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("bills_to_pay").select("*").order("nome", { ascending: true });
    if (!error) setAll((data ?? []).filter((b: BillToPay) => !!b.dia_fechamento || !!b.template_id || !!b.cartao_vinculado_id) as BillToPay[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useRefetchOnFocus(load);

  useEffect(() => { if (toast) { const t = setTimeout(()=>setToast(null), toast.type==="error"?8000:3000); return () => clearTimeout(t); } }, [toast]);

  const cards = all.filter(b => b.recorrente && !!b.dia_fechamento);
  const linkedFixedBills = all.filter(b => b.recorrente && !!b.cartao_vinculado_id);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const todayIso = now.toISOString().slice(0,10);

  const instanceForCardThisMonth = (cardId: string) =>
    all.find(b => b.template_id === cardId && (b.data_vencimento ?? "").startsWith(monthKey));
  const historyForCard = (cardId: string) =>
    all.filter(b => b.template_id === cardId).sort((a,b)=>(b.data_vencimento??"").localeCompare(a.data_vencimento??""));
  const isOverdue = (b: BillToPay) =>
    !!b.data_vencimento && b.data_vencimento < todayIso && (b.status ?? "").toLowerCase() !== "pago";

  async function saveCard() {
    if (!form.nome.trim()) { setToast({msg:"Preencha o nome",type:"error"}); return; }
    if (!form.dia_fechamento) { setToast({msg:"Preencha o dia de fechamento",type:"error"}); return; }
    if (!form.dia_vencimento) { setToast({msg:"Preencha o dia de vencimento",type:"error"}); return; }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      categoria: "Cartão de Crédito",
      dia_fechamento: parseInt(form.dia_fechamento,10),
      dia_vencimento: parseInt(form.dia_vencimento,10),
      valor_base: 0,
      recorrente: true,
      user_id: userId,
      status: "pendente",
    };
    const { error } = editing
      ? await supabase.from("bills_to_pay").update(payload).eq("id", editing.id)
      : await supabase.from("bills_to_pay").insert(payload);
    setSaving(false);
    if (error) { setToast({msg:`Erro: ${error.message}`,type:"error"}); return; }
    setToast({msg: editing ? "Cartão atualizado" : "Cartão criado", type:"success"});
    setShowForm(false); setEditing(null);
    setForm({ nome:"", dia_fechamento:"", dia_vencimento:"" });
    load();
  }

  async function syncCardInvoice(card: BillToPay, targetMonthKey: string) {
    const { total } = invoiceTotalFor(card.id, targetMonthKey, transactions, card.dia_fechamento ?? 1, linkedFixedBills);
    const data_vencimento = dueDateForMonthKey(targetMonthKey, card.dia_vencimento ?? 10);
    const existing = all.find(b => b.template_id === card.id && (b.data_vencimento ?? "").startsWith(targetMonthKey));
    let instanceId: string | null = existing?.id ?? null;
    if (existing) {
      await supabase.from("bills_to_pay").update({ valor_base: total }).eq("id", existing.id);
    } else {
      const { data: createdInstance } = await supabase.from("bills_to_pay").insert({
        nome: card.nome, categoria: card.categoria, valor_base: total,
        data_vencimento, status: "pendente", recorrente: false, template_id: card.id, user_id: userId,
      }).select().single();
      instanceId = createdInstance?.id ?? null;
    }
    if (instanceId) {
      syncBillToCalendar(userId, { billId: instanceId, title: `Fatura ${card.nome}`, date: data_vencimento, amount: total }).catch((e)=>{ console.error("Erro ao sincronizar fatura com Google Agenda:", e); });
    }
    setToast({msg:"Fatura sincronizada",type:"success"});
    load();
  }

  // Sincroniza automaticamente a fatura do mês só na primeira vez (quando ainda não existe nenhuma
  // fatura gerada pra esse mês) — depois disso, o valor é o que está salvo (inclusive edições manuais),
  // e só muda de novo se o usuário clicar em "Sincronizar fatura".
  const autoSyncRan = useRef(false);
  useEffect(() => {
    if (loading || autoSyncRan.current || cards.length === 0) return;
    autoSyncRan.current = true;
    const cardsSemFatura = cards.filter(card => !all.find(b => b.template_id === card.id && (b.data_vencimento ?? "").startsWith(monthKey)));
    (async () => { for (const card of cardsSemFatura) await syncCardInvoice(card, monthKey); })();
  }, [loading, all]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleStatus(instance: BillToPay) {
    const jaPago = (instance.status ?? "pendente").toLowerCase() === "pago";
    if (jaPago) {
      await supabase.from("bills_to_pay").update({ status: "pendente", data_pagamento: null, motivo_atraso: null }).eq("id", instance.id);
      load();
      return;
    }
    setPayingBill(instance);
    setPayForm({ data_pagamento: todayIso, motivo_atraso: "", juros: String(instance.juros_atraso ?? "") });
  }

  async function updateInvoiceValue(instance: BillToPay, newValue: number) {
    const { error } = await supabase.from("bills_to_pay").update({ valor_base: newValue }).eq("id", instance.id);
    if (error) setToast({msg:"Erro ao atualizar valor",type:"error"});
    else setToast({msg:"Valor da fatura atualizado",type:"success"});
    load();
  }

  async function criarOuEditarFatura(card: BillToPay, targetMonthKey: string, valor: number) {
    const existente = all.find(b => b.template_id === card.id && (b.data_vencimento ?? "").startsWith(targetMonthKey));
    if (existente) {
      await updateInvoiceValue(existente, valor);
      return;
    }
    const data_vencimento = dueDateForMonthKey(targetMonthKey, card.dia_vencimento ?? 10);
    const { error } = await supabase.from("bills_to_pay").insert({
      nome: card.nome, categoria: card.categoria, valor_base: valor,
      data_vencimento, status: "pendente", recorrente: false, template_id: card.id, user_id: userId,
    });
    if (error) setToast({msg:`Erro ao criar fatura: ${error.message}`,type:"error"});
    else setToast({msg:"Fatura criada e editável a partir de agora",type:"success"});
    load();
  }

  async function confirmPayment() {
    if (!payingBill) return;
    setSaving(true);
    const { error } = await supabase.from("bills_to_pay").update({
      status: "pago",
      data_pagamento: payForm.data_pagamento || todayIso,
      motivo_atraso: isOverdue(payingBill) ? (payForm.motivo_atraso || null) : null,
      juros_atraso: payForm.juros ? parseFloat(payForm.juros.replace(",",".")) : null,
    }).eq("id", payingBill.id);
    setSaving(false);
    if (error) { setToast({msg:`Erro ao registrar pagamento: ${error.message}`,type:"error"}); return; }
    setToast({msg:"Pagamento registrado",type:"success"});
    setPayingBill(null);
    load();
  }

  async function deleteCard(card: BillToPay) {
    if (!confirm(`Remover o cartão "${card.nome}" e todo o histórico de faturas?`)) return;
    await supabase.from("bills_to_pay").delete().eq("template_id", card.id);
    await supabase.from("bills_to_pay").delete().eq("id", card.id);
    load();
  }

  return (
    <div className="scroll-content page-fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div className="section-title" style={{margin:0}}>Cartões</div>
        <span className="section-link" onClick={()=>{setEditing(null);setForm({nome:"",dia_fechamento:"",dia_vencimento:""});setShowForm(true);}}>+ Novo cartão</span>
      </div>

      <button onClick={()=>{setShowMonthPicker(v=>!v); if(!selectedMonth) setSelectedMonth(monthKey);}}
        style={{width:"100%",padding:"10px",background:selectedMonth&&selectedMonth!==monthKey?"#007AFF":"#F5F5F7",color:selectedMonth&&selectedMonth!==monthKey?"#FFF":"#1D1D1F",border:"none",borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:showMonthPicker?8:14}}>
        🗓️ {selectedMonth && selectedMonth!==monthKey ? `Vendo: ${monthKeyLabel(selectedMonth)}` : "Ver mês específico"}
      </button>
      {showMonthPicker && (
        <input type="month" value={selectedMonth ?? monthKey}
          onChange={e=>{setSelectedMonth(e.target.value); setShowMonthPicker(false);}}
          style={{width:"100%",padding:"10px 12px",border:"1.5px solid #E5E5EA",borderRadius:10,fontSize:14,fontFamily:"inherit",marginBottom:14}} />
      )}

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:"#86868B"}}>Carregando…</div>
      ) : cards.length === 0 ? (
        <div style={{textAlign:"center",padding:"40px 20px",color:"#86868B"}}>
          <div style={{fontSize:40,marginBottom:10}}>🗂️</div>
          <div style={{fontSize:14}}>Nenhum cartão cadastrado ainda.<br/>Cadastre e a fatura é calculada automaticamente a partir das compras lançadas.</div>
        </div>
      ) : (
        <>
          {(() => {
            const faturaExibida = (card: BillToPay) => {
              const inst = all.find(b => b.template_id === card.id && (b.data_vencimento ?? "").startsWith(monthKey));
              return inst ? (inst.valor_base ?? 0) : invoiceTotalFor(card.id, monthKey, transactions, card.dia_fechamento ?? 1, linkedFixedBills).total;
            };
            const totalFaturaAtual = cards.reduce((s,c) => s + faturaExibida(c), 0);
            const cardSegments = buildPieSegments(cards.map(c => ({
              label: c.nome ?? "Cartão",
              value: Math.max(faturaExibida(c), 0.01),
              color: getCardColor(c.nome ?? ""),
            })));
            return (
              <>
                <div style={{background:"linear-gradient(135deg,#FF3B30,#D32F2F)",borderRadius:16,padding:16,color:"#FFF",marginBottom:16}}>
                  <div style={{fontSize:11,opacity:0.85,marginBottom:4}}>Gasto total no cartão este mês ({cards.length} cartõe{cards.length!==1?"s":"s"})</div>
                  <div style={{fontSize:22,fontWeight:700}}>{formatBRL(totalFaturaAtual)}</div>
                </div>

                {cards.length > 1 && (
                  <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
                    <DonutChart segments={cardSegments} selected={selectedCardSlice} onSelect={setSelectedCardSlice} total={totalFaturaAtual} />
                  </div>
                )}
              </>
            );
          })()}

        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {cards.map(card => {
            const viewMonth = selectedMonth ?? monthKey;
            const isCurrentMonth = viewMonth === monthKey;
            const instance = instanceForCardThisMonth(card.id);
            const paid = (instance?.status ?? "").toLowerCase() === "pago";
            const currentInvoice = invoiceTotalFor(card.id, viewMonth, transactions, card.dia_fechamento!, linkedFixedBills);
            const nextKey = addMonthsToKey(viewMonth, 1);
            const nextInvoice = invoiceTotalFor(card.id, nextKey, transactions, card.dia_fechamento!, linkedFixedBills);
            const valorExibido = isCurrentMonth && instance ? (instance.valor_base ?? currentInvoice.total) : currentInvoice.total;
            const daysToClose = (() => {
              const today = new Date();
              let close = new Date(today.getFullYear(), today.getMonth(), card.dia_fechamento!);
              if (close < today) close = new Date(today.getFullYear(), today.getMonth()+1, card.dia_fechamento!);
              return Math.ceil((close.getTime()-today.getTime())/86400000);
            })();
            return (
              <div key={card.id} onClick={()=>setDetailCard(card)} style={{background:"#F5F5F7",borderRadius:16,padding:14,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:"#1D1D1F"}}>💳 {card.nome}</div>
                    <div style={{fontSize:12,color:"#86868B",marginTop:2}}>Fecha dia {card.dia_fechamento} · vence dia {card.dia_vencimento} · fecha em {daysToClose} dia{daysToClose!==1?"s":""}</div>
                  </div>
                  <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                    <span onClick={()=>{setEditing(card);setForm({nome:card.nome??"",dia_fechamento:String(card.dia_fechamento??""),dia_vencimento:String(card.dia_vencimento??"")});setShowForm(true);}} style={{cursor:"pointer",fontSize:16}}>✏️</span>
                    <span onClick={()=>deleteCard(card)} style={{cursor:"pointer",fontSize:16}}>🗑️</span>
                  </div>
                </div>

                <div style={{marginTop:10,paddingTop:10,borderTop:"0.5px solid #E5E5E7"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:12,color:"#86868B"}}>{isCurrentMonth?"Fatura atual":`Fatura de ${monthKeyLabel(viewMonth)}`} ({currentInvoice.count} lançamento{currentInvoice.count!==1?"s":""}){isCurrentMonth&&paid?" · Paga":""}</span>
                    <span style={{fontSize:15,fontWeight:700,color:isCurrentMonth&&paid?"#34C759":"#FF3B30"}}>{formatBRL(valorExibido)}</span>
                  </div>
                  {isCurrentMonth && instance && Math.abs((instance.valor_base ?? 0) - currentInvoice.total) > 0.01 && (
                    <div style={{fontSize:11,color:"#FF9500",marginBottom:8}}>
                      Valor ajustado manualmente (soma das compras lançadas seria {formatBRL(currentInvoice.total)})
                    </div>
                  )}
                  {linkedFixedBills.filter(b=>b.cartao_vinculado_id===card.id).length > 0 && (
                    <div style={{fontSize:11,color:"#86868B",marginBottom:8,lineHeight:1.5}}>
                      Inclui assinaturas fixas: {linkedFixedBills.filter(b=>b.cartao_vinculado_id===card.id).map(b=>`${b.nome} (${formatBRL(b.valor_base??0)})`).join(", ")}
                    </div>
                  )}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <span style={{fontSize:12,color:"#86868B"}}>Próxima fatura ({monthKeyLabel(nextKey)})</span>
                    <span style={{fontSize:13,fontWeight:600,color:"#86868B"}}>{formatBRL(nextInvoice.total)}</span>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>syncCardInvoice(card, monthKey)} style={{flex:1,padding:"9px",background:"#007AFF",color:"#FFF",border:"none",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                      Sincronizar fatura
                    </button>
                    {instance && (
                      <span
                        onClick={()=>toggleStatus(instance)}
                        title={paid?"Marcar como pendente":"Marcar como paga"}
                        style={{width:32,height:32,borderRadius:8,border:paid?"none":"1.5px solid #C7C7CC",background:paid?"#34C759":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,color:"#FFF",flexShrink:0}}
                      >{paid?"✓":""}</span>
                    )}
                    <span onClick={()=>setHistoryFor(card)} style={{fontSize:12,color:"#007AFF",cursor:"pointer",whiteSpace:"nowrap"}}>Histórico</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Modal: compras detalhadas do cartão no mês */}
      {detailCard && createPortal(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setDetailCard(null)}>
          <div className="modal-sheet-center" onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"75vh",overflowY:"auto"}}>
            {(() => {
              const viewMonth = selectedMonth ?? monthKey;
              const items = invoiceItemsFor(detailCard.id, viewMonth, transactions, detailCard.dia_fechamento ?? 1, linkedFixedBills);
              const total = items.reduce((s,i)=>s+i.valor,0);
              return (
                <>
                  <div style={{fontSize:17,fontWeight:600,marginBottom:2}}>💳 {detailCard.nome}</div>
                  <div style={{fontSize:13,color:"#86868B",marginBottom:16}}>{monthKeyLabel(viewMonth)} · {items.length} compra{items.length!==1?"s":""} · {formatBRL(total)}</div>
                  {items.length === 0 ? (
                    <div style={{fontSize:13,color:"#86868B",textAlign:"center",padding:"20px 0"}}>Nenhuma compra lançada nesse mês pra esse cartão.</div>
                  ) : (
                    items.map((it,i) => (
                      <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"0.5px solid #E5E5E7"}}>
                        <div>
                          <div style={{fontSize:13,color:"#1D1D1F"}}>{it.nome}{it.parcelaInfo?<span style={{color:"#86868B"}}> · {it.parcelaInfo}</span>:""}</div>
                          {it.data && <div style={{fontSize:11,color:"#86868B",marginTop:2}}>{new Date(it.data+"T00:00:00").toLocaleDateString("pt-BR")}</div>}
                        </div>
                        <span style={{fontSize:13,fontWeight:600,color:"#5856D6"}}>{formatBRL(it.valor)}</span>
                      </div>
                    ))
                  )}
                </>
              );
            })()}
            <button onClick={()=>setDetailCard(null)} style={{width:"100%",padding:12,marginTop:16,background:"transparent",color:"#86868B",border:"none",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Fechar</button>
          </div>
        </div>,
        document.body
      )}

      {/* Form modal */}
      {showForm && createPortal(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setShowForm(false)}>
          <div className="modal-sheet-center" ref={formSheetRef} onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>{editing?"Editar":"Novo"} cartão de crédito</div>
            <input placeholder="Nome do cartão (ex: Nubank)" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <div style={{flex:1}}>
                <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Dia de fechamento</label>
                <input placeholder="Ex: 20" type="number" min={1} max={31} value={form.dia_fechamento} onChange={e=>setForm(f=>({...f,dia_fechamento:e.target.value}))}
                  style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,fontFamily:"inherit"}} />
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Dia de vencimento</label>
                <input placeholder="Ex: 27" type="number" min={1} max={31} value={form.dia_vencimento} onChange={e=>setForm(f=>({...f,dia_vencimento:e.target.value}))}
                  style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,fontFamily:"inherit"}} />
              </div>
            </div>
            <div style={{fontSize:12,color:"#86868B",marginBottom:16,lineHeight:1.5}}>
              O valor da fatura é calculado automaticamente a partir das compras lançadas com este cartão — você não precisa digitar manualmente.
            </div>
            <button disabled={saving} onClick={saveCard} style={{width:"100%",padding:14,background:"#007AFF",color:"#FFF",border:"none",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.6:1}}>
              {saving?"Salvando…":"Salvar"}
            </button>
            <button onClick={()=>setShowForm(false)} style={{width:"100%",padding:12,background:"transparent",color:"#86868B",border:"none",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
          </div>
        </div>,
        document.body
      )}

      {/* Payment modal */}
      {payingBill && createPortal(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setPayingBill(null)}>
          <div className="modal-sheet-center" onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontSize:17,fontWeight:600,marginBottom:6}}>Registrar pagamento</div>
            <div style={{fontSize:13,color:"#86868B",marginBottom:16}}>{payingBill.nome} · {formatBRL((payingBill.valor_base??0)+(payingBill.juros_atraso??0))}</div>

            <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Data do pagamento</label>
            <input type="date" value={payForm.data_pagamento} onChange={e=>setPayForm(f=>({...f,data_pagamento:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />

            {isOverdue(payingBill) && (
              <>
                <label style={{fontSize:12,color:"#FF3B30",display:"block",marginBottom:4}}>Motivo do atraso</label>
                <input placeholder="Ex: esqueci, sem saldo, aguardando recebimento..." value={payForm.motivo_atraso} onChange={e=>setPayForm(f=>({...f,motivo_atraso:e.target.value}))}
                  style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />
              </>
            )}

            <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Juros/multa pagos (opcional, R$)</label>
            <input placeholder="0,00" value={payForm.juros} onChange={e=>setPayForm(f=>({...f,juros:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:16,fontFamily:"inherit"}} />

            <button disabled={saving} onClick={confirmPayment} style={{width:"100%",padding:14,background:"#34C759",color:"#FFF",border:"none",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.6:1}}>
              {saving?"Salvando…":"Confirmar pagamento"}
            </button>
            <button onClick={()=>setPayingBill(null)} style={{width:"100%",padding:12,background:"transparent",color:"#86868B",border:"none",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
          </div>
        </div>,
        document.body
      )}

      {/* History modal */}
      {historyFor && createPortal(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setHistoryFor(null)}>
          <div className="modal-sheet-center" onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"70vh",overflowY:"auto"}}>
            <div style={{fontSize:17,fontWeight:600,marginBottom:14}}>Histórico — {historyFor.nome}</div>
            {historyForCard(historyFor.id).length === 0 ? (
              <div style={{fontSize:13,color:"#86868B"}}>Nenhuma fatura gerada ainda.</div>
            ) : (
              historyForCard(historyFor.id).map(h => {
                const paidH = (h.status??"").toLowerCase()==="pago";
                return (
                <div key={h.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"0.5px solid #E5E5E7"}}>
                  <span style={{fontSize:13,color:"#1D1D1F"}}>{h.data_vencimento ? new Date(h.data_vencimento+"T00:00:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"}) : "—"}</span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span
                      onClick={()=>toggleStatus(h)}
                      style={{width:18,height:18,borderRadius:5,border:paidH?"none":"1.5px solid #C7C7CC",background:paidH?"#34C759":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:11,color:"#FFF",flexShrink:0}}
                    >{paidH?"✓":""}</span>
                    <input
                      type="text" defaultValue={String(h.valor_base ?? "")}
                      onBlur={(e)=>{ const v = parseFloat(e.target.value.replace(",",".")); if (!isNaN(v) && v !== h.valor_base) updateInvoiceValue(h, v); }}
                      style={{width:78,padding:"5px 7px",border:"1px solid #E5E5E7",borderRadius:8,fontSize:12,fontFamily:"inherit",textAlign:"right"}}
                    />
                  </div>
                </div>
                );
              })
            )}

            {/* Prévia dos próximos meses — parcelas já conhecidas que ainda não viraram fatura real */}
            {(() => {
              const jaExistentes = new Set(historyForCard(historyFor.id).map(h => (h.data_vencimento ?? "").slice(0,7)));
              const preview = Array.from({length:6}, (_,i) => addMonthsToKey(monthKey, i+1))
                .filter(mk => !jaExistentes.has(mk))
                .map(mk => ({ mk, total: invoiceTotalFor(historyFor.id, mk, transactions, historyFor.dia_fechamento ?? 1, linkedFixedBills).total }))
                .filter(p => p.total > 0);
              if (preview.length === 0) return null;
              return (
                <>
                  <div style={{fontSize:12,color:"#86868B",fontWeight:600,marginTop:16,marginBottom:6}}>Prévia (toque em ✏️ pra criar/editar a fatura desse mês)</div>
                  {preview.map(p => (
                    <div key={p.mk} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"0.5px solid #E5E5E7"}}>
                      <span style={{fontSize:13,color:"#86868B"}}>{monthKeyLabel(p.mk)}</span>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <input
                          type="text" defaultValue={p.total.toFixed(2)}
                          onBlur={(e)=>{ const v = parseFloat(e.target.value.replace(",",".")); if (!isNaN(v)) criarOuEditarFatura(historyFor, p.mk, v); }}
                          style={{width:78,padding:"5px 7px",border:"1px solid #E5E5E7",borderRadius:8,fontSize:12,fontFamily:"inherit",textAlign:"right",color:"#86868B"}}
                        />
                      </div>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {toast && createPortal(
        <div style={{position:"fixed",bottom:90,left:16,right:16,maxWidth:568,margin:"0 auto",background:toast.type==="error"?"#FF3B30":"#1D1D1F",color:"#FFF",padding:"12px 16px",borderRadius:12,fontSize:13,textAlign:"center",zIndex:300}}>
          {toast.msg}
        </div>,
        document.body
      )}

      {/* Botão flutuante — lançar fatura direto nessa aba */}
      <div
        onClick={()=>setShowImportFatura(true)}
        title="Importar fatura"
        style={{position:"fixed",bottom:"calc(90px + env(safe-area-inset-bottom))",right:16,width:48,height:48,borderRadius:24,background:"#FF3B30",color:"#FFF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:300,cursor:"pointer",boxShadow:"0 4px 14px rgba(255,59,48,0.4)",zIndex:90}}
      >
        +
      </div>

      {showImportFatura && (
        <ImportarDocumentoModal
          userId={userId}
          accounts={accounts}
          transactions={transactions}
          onClose={()=>setShowImportFatura(false)}
          onImported={()=>{ setShowImportFatura(false); onImported(); load(); }}
        />
      )}
    </div>
  );
}

// ─── Despesas do Mês page ─────────────────────────────────────────────────────

function DespesasMesPage({ bills, accounts }: { bills: BillToPay[]; accounts: NormAccount[] }) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<"img"|"pdf"|null>(null);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const despesasDoMes = bills.filter(b => !!b.data_vencimento && (b.data_vencimento ?? "").startsWith(monthKey))
    .sort((a,b)=>(a.data_vencimento??"").localeCompare(b.data_vencimento??""));

  const billValor = (b: BillToPay) => (b.valor_base ?? 0) + (b.juros_atraso ?? 0) + (b.encargos_cartao ?? 0);
  const pagas = despesasDoMes.filter(b => (b.status??"").toLowerCase()==="pago");
  const pendentes = despesasDoMes.filter(b => (b.status??"").toLowerCase()!=="pago");
  const totalPago = pagas.reduce((s,b)=>s+billValor(b),0);
  const totalPendente = pendentes.reduce((s,b)=>s+billValor(b),0);
  const totalGeral = totalPago + totalPendente;
  const saldoContas = accounts.reduce((s,a)=>s+a.balance,0);
  const cobreDespesas = saldoContas >= totalPendente;

  async function exportImage() {
    if (!reportRef.current) return;
    setExporting("img");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const link = document.createElement("a");
      link.download = `despesas-${monthKey}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally { setExporting(null); }
  }

  async function exportPdf() {
    if (!reportRef.current) return;
    setExporting("pdf");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`despesas-${monthKey}.pdf`);
    } finally { setExporting(null); }
  }

  return (
    <div className="scroll-content page-fade">
      <div className="section-title" style={{marginBottom:14}}>Despesas do Mês</div>

      <div ref={reportRef} style={{background:"#FFF",padding:4}}>
        <div style={{fontSize:15,fontWeight:600,color:"#1D1D1F",marginBottom:14}}>Relação de despesas — {monthLabel}</div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div style={{background:"#F5F5F7",borderRadius:14,padding:14}}>
            <div style={{fontSize:11,color:"#86868B",marginBottom:4}}>Total a pagar</div>
            <div style={{fontSize:17,fontWeight:700,color:"#FF9500"}}>{formatBRL(totalPendente)}</div>
          </div>
          <div style={{background:"#F5F5F7",borderRadius:14,padding:14}}>
            <div style={{fontSize:11,color:"#86868B",marginBottom:4}}>Já pago</div>
            <div style={{fontSize:17,fontWeight:700,color:"#34C759"}}>{formatBRL(totalPago)}</div>
          </div>
        </div>

        <div style={{background:"#F5F5F7",borderRadius:14,padding:14,marginBottom:12}}>
          <div style={{fontSize:11,color:"#86868B",marginBottom:4}}>Total geral de despesas do mês</div>
          <div style={{fontSize:20,fontWeight:700,color:"#1D1D1F"}}>{formatBRL(totalGeral)}</div>
        </div>

        <div style={{background:cobreDespesas?"#E8F9EA":"#FFEBEE",borderRadius:14,padding:14,marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:12,color:"#86868B"}}>Saldo atual das contas</span>
            <span style={{fontSize:14,fontWeight:700,color:"#1D1D1F"}}>{formatBRL(saldoContas)}</span>
          </div>
          <div style={{fontSize:12,color:cobreDespesas?"#1B7A2E":"#B71C1C",fontWeight:600}}>
            {cobreDespesas
              ? `✓ O saldo cobre as despesas pendentes (sobra ${formatBRL(saldoContas-totalPendente)})`
              : `⚠️ O saldo não cobre as despesas pendentes (falta ${formatBRL(totalPendente-saldoContas)})`}
          </div>
        </div>

        <div style={{fontSize:13,fontWeight:600,color:"#86868B",marginBottom:8}}>Detalhamento</div>
        {despesasDoMes.length === 0 ? (
          <div style={{fontSize:13,color:"#86868B",padding:"8px 0"}}>Nenhuma despesa registrada para {monthLabel}.</div>
        ) : (
          <div style={{borderTop:"0.5px solid #E5E5E7"}}>
            {despesasDoMes.map(b => {
              const paga = (b.status??"").toLowerCase()==="pago";
              return (
                <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"0.5px solid #E5E5E7"}}>
                  <div>
                    <div style={{fontSize:14,color:"#1D1D1F"}}>{b.nome ?? "Sem nome"}</div>
                    <div style={{fontSize:12,color:"#86868B",marginTop:2}}>
                      {b.categoria ?? "Outros"} · vence {b.data_vencimento ? new Date(b.data_vencimento+"T00:00:00").toLocaleDateString("pt-BR") : "—"}
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:14,fontWeight:600,color:"#1D1D1F"}}>{formatBRL(billValor(b))}</div>
                    <div style={{fontSize:11,color:paga?"#34C759":"#FF9500",fontWeight:600}}>{paga?"Pago":"Pendente"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {despesasDoMes.length > 0 && (
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={exportImage} disabled={exporting!==null} style={{flex:1,padding:"12px",background:"#007AFF",color:"#FFF",border:"none",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:exporting?0.6:1}}>
            {exporting==="img"?"Gerando…":"📷 Baixar imagem"}
          </button>
          <button onClick={exportPdf} disabled={exporting!==null} style={{flex:1,padding:"12px",background:"#FFFFFF",color:"#1D1D1F",border:"1.5px solid #E5E5E7",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:exporting?0.6:1}}>
            {exporting==="pdf"?"Gerando…":"📄 Baixar PDF"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Planejamento page ────────────────────────────────────────────────────────

function PlanejamentoPage({ userId, transactions }: { userId: string; transactions: NormTx[] }) {
  const [bills, setBills] = useState<BillToPay[]>([]);
  const [simulacoes, setSimulacoes] = useState<SimulacaoCompra[]>([]);
  const [planos, setPlanos] = useState<PlanejamentoMensal[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{msg:string;type:"success"|"error"}|null>(null);

  const [showSimForm, setShowSimForm] = useState(false);
  const [simForm, setSimForm] = useState({ nome:"", valor_parcela:"", parcelas:"1", primeira_parcela:new Date().toISOString().slice(0,10), renda_extra:"", renda_extra_meses:"1" });
  const [savingSim, setSavingSim] = useState(false);
  const [reportSim, setReportSim] = useState<SimulacaoCompra|null>(null);
  const [exportingReport, setExportingReport] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [editingRenda, setEditingRenda] = useState(false);
  const [editingInvest, setEditingInvest] = useState(false);
  const [rendaInput, setRendaInput] = useState("");
  const [investInput, setInvestInput] = useState("");
  const [pendingSave, setPendingSave] = useState<null|"renda"|"invest">(null);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  const load = useCallback(async () => {
    setLoading(true);
    const [billsRes, simRes, planRes] = await Promise.all([
      supabase.from("bills_to_pay").select("*").eq("recorrente", true),
      supabase.from("simulacoes_compra").select("*").order("created_at", { ascending: false }),
      supabase.from("planejamento_mensal").select("*"),
    ]);
    if (!billsRes.error) setBills((billsRes.data ?? []) as BillToPay[]);
    if (!simRes.error) setSimulacoes((simRes.data ?? []) as SimulacaoCompra[]);
    if (!planRes.error) setPlanos((planRes.data ?? []) as PlanejamentoMensal[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useRefetchOnFocus(load);
  useEffect(() => { if (toast) { const t = setTimeout(()=>setToast(null), toast.type==="error"?6000:3000); return () => clearTimeout(t); } }, [toast]);

  const fixedTemplates = bills.filter(b => !b.dia_fechamento && b.forma_pagamento !== "cartao");
  const cardTemplates = bills.filter(b => !!b.dia_fechamento);
  const linkedFixedBills = bills.filter(b => !!b.cartao_vinculado_id);

  // Quanto já está comprometido (contas fixas + faturas de cartão) para um mês qualquer
  function despesasPrevistasParaMes(targetMonth: string): number {
    const fixedTotal = fixedTemplates.reduce((s, t) => {
      const geradas = 0; // aproximação: usamos parcelas restantes a partir de agora
      const [ty,tm] = targetMonth.split("-").map(Number);
      const [cy,cm] = monthKey.split("-").map(Number);
      const mesesAFrente = (ty*12+tm) - (cy*12+cm);
      if (mesesAFrente < 0) return s;
      const aindaAtivo = !t.parcelas_totais || mesesAFrente < t.parcelas_totais;
      return aindaAtivo ? s + (t.valor_base ?? 0) : s;
    }, 0);
    const cardsTotal = cardTemplates.reduce((s, c) =>
      s + invoiceTotalFor(c.id, targetMonth, transactions, c.dia_fechamento ?? 1, linkedFixedBills).total, 0);
    return fixedTotal + cardsTotal;
  }

  const despesasPrevistasMesAtual = despesasPrevistasParaMes(monthKey);
  const planoAtual = planos.find(p => p.mes === monthKey);
  const renda = planoAtual?.renda_mensal ?? 0;
  const investimento = planoAtual?.investimento_mensal ?? 0;
  const saldoLivre = renda - despesasPrevistasMesAtual - investimento;

  async function salvarPlano(campo: "renda_mensal"|"investimento_mensal", valor: number, aplicarFuturos: boolean) {
    const mesesAlvo = aplicarFuturos
      ? Array.from({length:12}, (_,i) => addMonthsToKey(monthKey, i))
      : [monthKey];
    for (const m of mesesAlvo) {
      const existente = planos.find(p => p.mes === m);
      if (existente) {
        await supabase.from("planejamento_mensal").update({ [campo]: valor }).eq("id", existente.id);
      } else {
        await supabase.from("planejamento_mensal").insert({
          mes: m, user_id: userId,
          renda_mensal: campo==="renda_mensal" ? valor : 0,
          investimento_mensal: campo==="investimento_mensal" ? valor : 0,
        });
      }
    }
    setToast({msg:"Planejamento atualizado",type:"success"});
    setPendingSave(null);
    setEditingRenda(false);
    setEditingInvest(false);
    load();
  }

  async function saveSimulacao() {
    if (!simForm.nome.trim() || !simForm.valor_parcela) { setToast({msg:"Preencha nome e valor da parcela",type:"error"}); return; }
    setSavingSim(true);
    const parcelaValor = parseFloat(simForm.valor_parcela.replace(",","."));
    const numParcelas = Math.max(1, parseInt(simForm.parcelas,10) || 1);
    const { error } = await supabase.from("simulacoes_compra").insert({
      nome: simForm.nome.trim(),
      valor_total: parcelaValor * numParcelas,
      parcelas: numParcelas,
      primeira_parcela: simForm.primeira_parcela,
      renda_extra: simForm.renda_extra ? parseFloat(simForm.renda_extra.replace(",",".")) : null,
      renda_extra_meses: simForm.renda_extra ? Math.max(1, parseInt(simForm.renda_extra_meses,10) || 1) : null,
      user_id: userId,
    });
    setSavingSim(false);
    if (error) { setToast({msg:`Erro: ${error.message}`,type:"error"}); return; }
    setToast({msg:"Simulação salva",type:"success"});
    setShowSimForm(false);
    setSimForm({ nome:"", valor_parcela:"", parcelas:"1", primeira_parcela:new Date().toISOString().slice(0,10), renda_extra:"", renda_extra_meses:"1" });
    load();
  }

  async function deleteSimulacao(id: string) {
    if (!confirm("Remover essa simulação?")) return;
    await supabase.from("simulacoes_compra").delete().eq("id", id);
    load();
  }

  // Relatório de 12 meses: renda (base + extra, se dentro da janela), despesas comprometidas
  // (fixas + cartões + esta parcela, se dentro da janela) e saldo livre resultante.
  function relatorio12Meses(sim: SimulacaoCompra) {
    const parcelaValor = sim.valor_total / sim.parcelas;
    const primeiraKey = sim.primeira_parcela.slice(0,7);
    const rendaBase = planoAtual?.renda_mensal ?? 0;
    const investimentoBase = planoAtual?.investimento_mensal ?? 0;
    const meses: { mes:string; renda:number; rendaExtra:number; despesas:number; investimento:number; parcela:number; total:number; saldoLivre:number; parcelaAtiva:boolean; rendaExtraAtiva:boolean }[] = [];
    for (let i = 0; i < 12; i++) {
      const mKey = addMonthsToKey(monthKey, i);
      const mesesDesdePrimeira = monthsBetween(primeiraKey, mKey);
      const parcelaAtiva = mesesDesdePrimeira >= 0 && mesesDesdePrimeira < sim.parcelas;
      const rendaExtraAtiva = !!sim.renda_extra && mesesDesdePrimeira >= 0 && mesesDesdePrimeira < (sim.renda_extra_meses ?? 1);
      const despesasBase = despesasPrevistasParaMes(mKey);
      const parcelaDoMes = parcelaAtiva ? parcelaValor : 0;
      const rendaExtraDoMes = rendaExtraAtiva ? (sim.renda_extra ?? 0) : 0;
      const total = despesasBase + investimentoBase + parcelaDoMes;
      meses.push({
        mes: mKey, renda: rendaBase, rendaExtra: rendaExtraDoMes,
        despesas: despesasBase, investimento: investimentoBase, parcela: parcelaDoMes, total,
        saldoLivre: (rendaBase + rendaExtraDoMes) - total,
        parcelaAtiva, rendaExtraAtiva,
      });
    }
    return { parcelaValor, meses };
  }

  async function exportarRelatorioPDF() {
    if (!reportRef.current || !reportSim) return;
    setExportingReport(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(reportRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`simulacao-${reportSim.nome.replace(/\s+/g,"-").toLowerCase()}.pdf`);
    } finally {
      setExportingReport(false);
    }
  }

  return (
    <div className="scroll-content page-fade">
      <div className="section-title" style={{marginBottom:14}}>Planejamento 🎯</div>

      {/* Planejamento mensal */}
      <div style={{background:"#F5F5F7",borderRadius:16,padding:16,marginBottom:24}}>
        <div style={{fontSize:15,fontWeight:600,marginBottom:12}}>Planejamento do mês — {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}</div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"0.5px solid #E5E5E7"}}>
          <span style={{fontSize:13,color:"#86868B"}}>Renda mensal</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14,fontWeight:600}}>{formatBRL(renda)}</span>
            <span onClick={()=>{setRendaInput(String(renda));setEditingRenda(true);}} style={{cursor:"pointer",fontSize:14}}>✏️</span>
          </div>
        </div>

        {editingRenda && (
          <div style={{padding:"10px 0"}}>
            <input value={rendaInput} onChange={e=>setRendaInput(e.target.value)} placeholder="Renda mensal (R$)"
              style={{width:"100%",padding:"10px 12px",border:"1.5px solid #E5E5EA",borderRadius:10,fontSize:14,marginBottom:8,fontFamily:"inherit"}} />
            <button onClick={()=>setPendingSave("renda")} style={{width:"100%",padding:10,background:"#007AFF",color:"#FFF",border:"none",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Salvar</button>
          </div>
        )}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"0.5px solid #E5E5E7"}}>
          <span style={{fontSize:13,color:"#86868B"}}>Investimento planejado</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14,fontWeight:600,color:"#34C759"}}>{formatBRL(investimento)}</span>
            <span onClick={()=>{setInvestInput(String(investimento));setEditingInvest(true);}} style={{cursor:"pointer",fontSize:14}}>✏️</span>
          </div>
        </div>

        {editingInvest && (
          <div style={{padding:"10px 0"}}>
            <input value={investInput} onChange={e=>setInvestInput(e.target.value)} placeholder="Investimento mensal (R$)"
              style={{width:"100%",padding:"10px 12px",border:"1.5px solid #E5E5EA",borderRadius:10,fontSize:14,marginBottom:8,fontFamily:"inherit"}} />
            <button onClick={()=>setPendingSave("invest")} style={{width:"100%",padding:10,background:"#007AFF",color:"#FFF",border:"none",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Salvar</button>
          </div>
        )}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"0.5px solid #E5E5E7"}}>
          <span style={{fontSize:13,color:"#86868B"}}>Despesas previstas (fixas + cartões)</span>
          <span style={{fontSize:14,fontWeight:600,color:"#FF9500"}}>{formatBRL(despesasPrevistasMesAtual)}</span>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0 0"}}>
          <span style={{fontSize:13,fontWeight:600}}>Saldo livre estimado</span>
          <span style={{fontSize:17,fontWeight:700,color:saldoLivre>=0?"#34C759":"#FF3B30"}}>{formatBRL(saldoLivre)}</span>
        </div>
      </div>

      {/* Simulador de compra parcelada */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div className="section-title" style={{margin:0}}>Simulador de compras</div>
        <span className="section-link" onClick={()=>setShowSimForm(true)}>+ Nova simulação</span>
      </div>

      {loading ? (
        <div style={{textAlign:"center",padding:30,color:"#86868B"}}>Carregando…</div>
      ) : simulacoes.length === 0 ? (
        <div style={{textAlign:"center",padding:"30px 20px",color:"#86868B"}}>
          <div style={{fontSize:36,marginBottom:8}}>🧮</div>
          <div style={{fontSize:14}}>Simule uma compra parcelada antes de decidir — veja como ela afetaria seus próximos 12 meses.</div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {simulacoes.map(sim => {
            const parcelaValor = sim.valor_total / sim.parcelas;
            return (
              <div key={sim.id} onClick={()=>setReportSim(sim)} style={{background:"#F5F5F7",borderRadius:16,padding:14,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:"#1D1D1F"}}>{sim.nome}</div>
                    <div style={{fontSize:12,color:"#86868B",marginTop:2}}>
                      {formatBRL(sim.valor_total)} em {sim.parcelas}x de {formatBRL(parcelaValor)}
                      {sim.renda_extra ? ` · +${formatBRL(sim.renda_extra)}/mês por ${sim.renda_extra_meses}x` : ""}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span onClick={(e)=>{e.stopPropagation();deleteSimulacao(sim.id);}} style={{fontSize:16,cursor:"pointer"}}>🗑️</span>
                    <span style={{fontSize:13,color:"#007AFF"}}>Ver relatório →</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: confirmar aplicação futura */}
      {(pendingSave === "renda" || pendingSave === "invest") && createPortal(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setPendingSave(null)}>
          <div className="modal-sheet-center" onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:420,borderRadius:20,padding:20}}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:14}}>Aplicar essa alteração a quais meses?</div>
            <button onClick={()=>salvarPlano(pendingSave==="renda"?"renda_mensal":"investimento_mensal", parseFloat((pendingSave==="renda"?rendaInput:investInput).replace(",","."))||0, false)}
              style={{width:"100%",padding:12,background:"#F5F5F7",color:"#1D1D1F",border:"none",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>
              Só este mês
            </button>
            <button onClick={()=>salvarPlano(pendingSave==="renda"?"renda_mensal":"investimento_mensal", parseFloat((pendingSave==="renda"?rendaInput:investInput).replace(",","."))||0, true)}
              style={{width:"100%",padding:12,background:"#007AFF",color:"#FFF",border:"none",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Este mês e os próximos 12
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: nova simulação */}
      {showSimForm && createPortal(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setShowSimForm(false)}>
          <div className="modal-sheet-center" onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>Nova simulação de compra</div>
            <input placeholder="O que você quer comprar?" value={simForm.nome} onChange={e=>setSimForm(f=>({...f,nome:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <div style={{flex:1}}>
                <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Valor da parcela (R$)</label>
                <input placeholder="0,00" value={simForm.valor_parcela} onChange={e=>setSimForm(f=>({...f,valor_parcela:e.target.value}))}
                  style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,fontFamily:"inherit"}} />
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Quantidade de parcelas</label>
                <input type="number" min={1} max={48} value={simForm.parcelas} onChange={e=>setSimForm(f=>({...f,parcelas:e.target.value}))}
                  style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,fontFamily:"inherit"}} />
              </div>
            </div>
            <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Pagamento da 1ª parcela</label>
            <input type="date" value={simForm.primeira_parcela} onChange={e=>setSimForm(f=>({...f,primeira_parcela:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:14,fontFamily:"inherit"}} />

            <div style={{fontSize:12,color:"#86868B",marginBottom:6,fontWeight:600}}>Renda extra nesse período (opcional)</div>
            <div style={{display:"flex",gap:10,marginBottom:4}}>
              <div style={{flex:1}}>
                <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Valor (R$)</label>
                <input placeholder="Ex: bônus, 13º" value={simForm.renda_extra} onChange={e=>setSimForm(f=>({...f,renda_extra:e.target.value}))}
                  style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,fontFamily:"inherit"}} />
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Quantas vezes</label>
                <input type="number" min={1} max={12} value={simForm.renda_extra_meses} onChange={e=>setSimForm(f=>({...f,renda_extra_meses:e.target.value}))}
                  style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,fontFamily:"inherit"}} />
              </div>
            </div>
            <div style={{fontSize:11,color:"#86868B",marginBottom:16}}>Ex: R$ 2.000 por 1 vez (um bônus único), ou R$ 500 por 3 vezes (uma renda extra recorrente).</div>

            <button disabled={savingSim} onClick={saveSimulacao} style={{width:"100%",padding:14,background:"#007AFF",color:"#FFF",border:"none",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:savingSim?0.6:1}}>
              {savingSim?"Salvando…":"Salvar simulação"}
            </button>
            <button onClick={()=>setShowSimForm(false)} style={{width:"100%",padding:12,background:"transparent",color:"#86868B",border:"none",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: relatório de 12 meses da simulação */}
      {reportSim && createPortal(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setReportSim(null)}>
          <div className="modal-sheet-center" onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"88vh",overflowY:"auto"}}>
            {(() => {
              const { parcelaValor, meses } = relatorio12Meses(reportSim);
              return (
                <>
                  <div ref={reportRef} style={{background:"#FFF",padding:4}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:2}}>
                      <div style={{fontSize:17,fontWeight:700}}>{reportSim.nome}</div>
                      <span onClick={()=>{ if(confirm("Excluir essa simulação?")){ deleteSimulacao(reportSim.id); setReportSim(null); } }} style={{fontSize:16,cursor:"pointer"}}>🗑️</span>
                    </div>
                    <div style={{fontSize:12,color:"#86868B",marginBottom:16}}>
                      {formatBRL(reportSim.valor_total)} em {reportSim.parcelas}x de {formatBRL(parcelaValor)} · Relatório de 12 meses
                    </div>
                    <div style={{borderTop:"0.5px solid #E5E5E7"}}>
                      {meses.map((m,i) => (
                        <div key={i} style={{padding:"12px 0",borderBottom:"0.5px solid #E5E5E7"}}>
                          <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>{monthKeyLabel(m.mes)}</div>
                          <div style={{display:"flex",gap:16}}>
                            <div style={{flex:1}}>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                                <span style={{color:"#86868B"}}>Renda</span>
                                <span style={{fontWeight:600,color:"#34C759"}}>{formatBRL(m.renda)}</span>
                              </div>
                              {m.rendaExtra > 0 && (
                                <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                                  <span style={{color:"#86868B"}}>Valor extra</span>
                                  <span style={{fontWeight:600,color:"#34C759"}}>{formatBRL(m.rendaExtra)}</span>
                                </div>
                              )}
                            </div>
                            <div style={{flex:1,borderLeft:"0.5px solid #E5E5E7",paddingLeft:16}}>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                                <span style={{color:"#86868B"}}>Despesas</span>
                                <span style={{fontWeight:600}}>{formatBRL(m.despesas)}</span>
                              </div>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                                <span style={{color:"#86868B"}}>Investimentos</span>
                                <span style={{fontWeight:600}}>{formatBRL(m.investimento)}</span>
                              </div>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
                                <span style={{color:"#86868B"}}>Parcela</span>
                                <span style={{fontWeight:600,color:m.parcelaAtiva?"#FF9500":"#86868B"}}>{formatBRL(m.parcela)}</span>
                              </div>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,paddingTop:4,borderTop:"0.5px solid #E5E5E7"}}>
                                <span style={{color:"#1D1D1F",fontWeight:600}}>Total</span>
                                <span style={{fontWeight:700}}>{formatBRL(m.total)}</span>
                              </div>
                            </div>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,paddingTop:8,borderTop:"1px solid #1D1D1F"}}>
                            <span style={{fontSize:12,fontWeight:600}}>Saldo do mês</span>
                            <span style={{fontSize:15,fontWeight:700,color:m.saldoLivre>=0?"#34C759":"#FF3B30"}}>{formatBRL(m.saldoLivre)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button disabled={exportingReport} onClick={exportarRelatorioPDF} style={{width:"100%",padding:14,marginTop:16,background:"#007AFF",color:"#FFF",border:"none",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:exportingReport?0.6:1}}>
                    {exportingReport?"Gerando PDF…":"📄 Exportar PDF"}
                  </button>
                </>
              );
            })()}
            <button onClick={()=>setReportSim(null)} style={{width:"100%",padding:12,marginTop:8,background:"transparent",color:"#86868B",border:"none",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Fechar</button>
          </div>
        </div>,
        document.body
      )}

      {toast && createPortal(
        <div style={{position:"fixed",bottom:90,left:16,right:16,maxWidth:568,margin:"0 auto",background:toast.type==="error"?"#FF3B30":"#1D1D1F",color:"#FFF",padding:"12px 16px",borderRadius:12,fontSize:13,textAlign:"center",zIndex:300}}>
          {toast.msg}
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Investimentos page ───────────────────────────────────────────────────────

const TIPOS_INVESTIMENTO = ["Renda Fixa","Tesouro Direto","Fundos","Ações","Cripto","Poupança","Outros"];

function InvestimentosPage({ userId, accounts }: { userId: string; accounts: NormAccount[] }) {
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [lancamentos, setLancamentos] = useState<InvestimentoLancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Investimento | null>(null);
  const [form, setForm] = useState({ nome:"", tipo:TIPOS_INVESTIMENTO[0], valor_inicial:"", instituicao:"", instituicaoOutro:"", dataAplicacao: new Date().toISOString().slice(0,10) });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:"success"|"error"}|null>(null);
  const [detailFor, setDetailFor] = useState<Investimento | null>(null);
  const [lancForm, setLancForm] = useState({ mes:new Date().toISOString().slice(0,7), valor_ganho:"", saldo_acumulado:"", observacao:"" });
  const [opForm, setOpForm] = useState<{tipo:"aporte"|"retirada"|"rendimento"|null; valor:string; data:string; contaId:string}>({ tipo:null, valor:"", data:new Date().toISOString().slice(0,10), contaId:"" });
  const [showExtratoGeral, setShowExtratoGeral] = useState(false);
  const [savingLanc, setSavingLanc] = useState(false);
  const [bankFilter, setBankFilter] = useState<string>("Todos");
  const formSheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (showForm && formSheetRef.current) formSheetRef.current.scrollTop = 0; }, [showForm]);
  useEffect(() => { if (toast) { const t = setTimeout(()=>setToast(null), toast.type==="error"?6000:3000); return () => clearTimeout(t); } }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    const [invRes, lancRes] = await Promise.all([
      supabase.from("investimentos").select("*").order("nome", { ascending: true }),
      supabase.from("investimento_lancamentos").select("*").order("mes", { ascending: true }),
    ]);
    if (!invRes.error) setInvestimentos((invRes.data ?? []) as Investimento[]);
    if (!lancRes.error) setLancamentos((lancRes.data ?? []) as InvestimentoLancamento[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useRefetchOnFocus(load);


  const lancamentosFor = (invId: string) => lancamentos.filter(l => l.investimento_id === invId);
  const totalGanhoFor = (invId: string) => lancamentosFor(invId).reduce((s,l)=>s+(l.valor_ganho??0),0);
  const netAportesFor = (invId: string) => lancamentosFor(invId).reduce((s,l)=>s+(l.valor_operacao??0),0);
  const saldoAtualFor = (invId: string, valorInicial: number) => valorInicial + totalGanhoFor(invId) + netAportesFor(invId);
  const totalInvestido = investimentos.reduce((s,i)=>s+saldoAtualFor(i.id, i.valor_inicial??0),0);
  const totalGanho = investimentos.reduce((s,i)=>s+totalGanhoFor(i.id),0);

  async function saveInvestimento() {
    if (!form.nome.trim()) { setToast({msg:"Preencha o nome",type:"error"}); return; }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(), tipo: form.tipo,
      valor_inicial: form.valor_inicial ? parseFloat(form.valor_inicial.replace(",",".")) : 0,
      instituicao: (form.instituicao === "Outro" ? form.instituicaoOutro.trim() : form.instituicao) || null,
      data_aplicacao: form.dataAplicacao || null,
      user_id: userId,
    };
    const { error } = editing
      ? await supabase.from("investimentos").update(payload).eq("id", editing.id)
      : await supabase.from("investimentos").insert(payload);
    setSaving(false);
    if (error) { setToast({msg:`Erro: ${error.message}`,type:"error"}); return; }
    setToast({msg: editing ? "Investimento atualizado" : "Investimento criado", type:"success"});
    setShowForm(false); setEditing(null);
    setForm({ nome:"", tipo:TIPOS_INVESTIMENTO[0], valor_inicial:"", instituicao:"", instituicaoOutro:"", dataAplicacao:new Date().toISOString().slice(0,10) });
    load();
  }

  async function deleteInvestimento(inv: Investimento) {
    if (!confirm(`Remover "${inv.nome}" e todo o histórico de rendimentos?`)) return;
    const { error: e1 } = await supabase.from("investimento_lancamentos").delete().eq("investimento_id", inv.id);
    const { error: e2 } = await supabase.from("investimentos").delete().eq("id", inv.id);
    if (e1 || e2) { setToast({msg:`Erro ao excluir: ${(e2||e1)?.message}`,type:"error"}); return; }
    setToast({msg:"Investimento excluído",type:"success"});
    load();
  }

  async function saveRendimentoDireto(inv: Investimento, valor: number, data: string) {
    const { error } = await supabase.from("investimento_lancamentos").insert({
      investimento_id: inv.id,
      mes: data.slice(0,7),
      valor_ganho: valor,
      data_operacao: data,
      observacao: "Rendimento",
    });
    if (error) { setToast({msg:`Erro: ${error.message}`,type:"error"}); return; }
    setToast({msg:"Rendimento registrado",type:"success"});
    load();
  }

  async function saveOperacao(inv: Investimento, tipoOp: "aporte"|"retirada", valor: number, data: string, contaId: string | null) {
    const valorOperacao = tipoOp === "aporte" ? valor : -valor;
    const { error } = await supabase.from("investimento_lancamentos").insert({
      investimento_id: inv.id,
      mes: data.slice(0,7),
      valor_ganho: 0,
      tipo_operacao: tipoOp,
      valor_operacao: valorOperacao,
      data_operacao: data,
    });
    if (error) { setToast({msg:`Erro: ${error.message}`,type:"error"}); return; }

    // Espelha em Transações (como transferência, não conta como receita/despesa) e ajusta o saldo da conta vinculada
    if (contaId) {
      const descricao = tipoOp === "aporte"
        ? `Aporte em ${inv.nome}${inv.instituicao?` (${inv.instituicao})`:""}`
        : `Baixa de investimento — ${inv.nome}${inv.instituicao?` (${inv.instituicao})`:""}`;
      await supabase.from("transactions").insert({
        user_id: userId, account_id: contaId, descricao, valor,
        tipo: "transferencia", data_transacao: data,
        categoria: "Investimentos", tipo_escopo: "Despesa Familiar", meio_pagamento: "pix",
      });
      // Aporte tira dinheiro da conta; retirada devolve pra conta
      await adjustAccountBalance(contaId, tipoOp === "aporte" ? -valor : valor);
    }

    setToast({msg: tipoOp==="aporte" ? "Aporte registrado" : "Retirada registrada", type:"success"});
    load();
  }

  async function saveLancamento() {
    if (!detailFor || !lancForm.saldo_acumulado) { setToast({msg:"Preencha o saldo acumulado",type:"error"}); return; }
    setSavingLanc(true);
    const saldoAtual = parseFloat(lancForm.saldo_acumulado.replace(",","."));
    const anteriores = lancamentosFor(detailFor.id).filter(l => l.mes < lancForm.mes).sort((a,b)=>b.mes.localeCompare(a.mes));
    const saldoAnterior = anteriores[0]?.saldo_acumulado ?? detailFor.valor_inicial ?? 0;
    const valorGanho = saldoAtual - saldoAnterior;
    const existing = lancamentosFor(detailFor.id).find(l => l.mes === lancForm.mes);
    const payload = {
      investimento_id: detailFor.id, mes: lancForm.mes,
      valor_ganho: valorGanho,
      saldo_acumulado: saldoAtual,
      observacao: lancForm.observacao.trim() || null,
    };
    const { error } = existing
      ? await supabase.from("investimento_lancamentos").update(payload).eq("id", existing.id)
      : await supabase.from("investimento_lancamentos").insert(payload);
    setSavingLanc(false);
    if (error) { setToast({msg:`Erro: ${error.message}`,type:"error"}); return; }
    setToast({msg:"Saldo acumulado registrado",type:"success"});
    setLancForm({ mes:new Date().toISOString().slice(0,7), valor_ganho:"", saldo_acumulado:"", observacao:"" });
    load();
  }

  async function deleteLancamento(id: string) {
    await supabase.from("investimento_lancamentos").delete().eq("id", id);
    load();
  }

  return (
    <div className="scroll-content page-fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div className="section-title" style={{margin:0}}>Investimentos</div>
        <span className="section-link" onClick={()=>{setEditing(null);setForm({nome:"",tipo:TIPOS_INVESTIMENTO[0],valor_inicial:"",instituicao:"",instituicaoOutro:""});setShowForm(true);}}>+ Novo</span>
      </div>

      {investimentos.length > 0 && (
        <div onClick={()=>setShowExtratoGeral(v=>!v)} style={{background:"#F5F5F7",borderRadius:16,padding:16,marginBottom:showExtratoGeral?8:16,display:"flex",justifyContent:"space-around",textAlign:"center",cursor:"pointer"}}>
          <div>
            <div style={{fontSize:12,color:"#86868B",marginBottom:4}}>Total investido</div>
            <div style={{fontSize:16,fontWeight:700,color:"#1D1D1F"}}>{formatBRL(totalInvestido)}</div>
          </div>
          <div>
            <div style={{fontSize:12,color:"#86868B",marginBottom:4}}>Rendimento acumulado</div>
            <div style={{fontSize:16,fontWeight:700,color:"#34C759"}}>{formatBRL(totalGanho)}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",color:"#007AFF",fontSize:12}}>{showExtratoGeral?"▲ Ocultar":"▼ Extrato"}</div>
        </div>
      )}

      {showExtratoGeral && (
        <div style={{background:"#FFF",border:"1px solid #E5E5E7",borderRadius:16,padding:14,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:600,color:"#86868B",marginBottom:8}}>Extrato consolidado (todos os investimentos)</div>
          {lancamentos.length === 0 ? (
            <div style={{fontSize:13,color:"#86868B",padding:"8px 0"}}>Nenhuma movimentação registrada ainda.</div>
          ) : (
            [...lancamentos]
              .sort((a,b)=>((b.data_operacao ?? b.mes+"-28")).localeCompare(a.data_operacao ?? a.mes+"-28"))
              .map(l => {
                const inv = investimentos.find(i => i.id === l.investimento_id);
                const isOp = !!l.tipo_operacao;
                const icon = l.tipo_operacao==="aporte" ? "⬆️" : l.tipo_operacao==="retirada" ? "⬇️" : "📈";
                const valorMostrado = isOp ? (l.valor_operacao ?? 0) : l.valor_ganho;
                const dataMostrada = l.data_operacao ? new Date(l.data_operacao+"T00:00:00").toLocaleDateString("pt-BR") : monthKeyLabel(l.mes);
                return (
                  <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"0.5px solid #E5E5E7"}}>
                    <div>
                      <div style={{fontSize:12,color:"#1D1D1F"}}>{icon} {inv?.nome ?? "—"}</div>
                      <div style={{fontSize:11,color:"#86868B",marginTop:1}}>{dataMostrada}</div>
                    </div>
                    <span style={{fontSize:13,fontWeight:600,color:valorMostrado>=0?"#34C759":"#FF3B30"}}>{valorMostrado>=0?"+":""}{formatBRL(valorMostrado)}</span>
                  </div>
                );
              })
          )}
        </div>
      )}

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:"#86868B"}}>Carregando…</div>
      ) : investimentos.length === 0 ? (
        <div style={{textAlign:"center",padding:"40px 20px",color:"#86868B"}}>
          <div style={{fontSize:40,marginBottom:10}}>📈</div>
          <div style={{fontSize:14}}>Nenhum investimento cadastrado ainda.<br/>Cadastre e registre os rendimentos mês a mês.</div>
        </div>
      ) : (
        <>
          {(() => {
            const bancos = ["Todos", ...Array.from(new Set(investimentos.map(i => i.instituicao || "Sem banco")))];
            return bancos.length > 2 && (
              <div className="pay-seg" style={{marginBottom:14}}>
                {bancos.map(b => (
                  <button key={b} className={`pay-seg-btn${bankFilter===b?" active":""}`}
                    style={bankFilter===b?{background:"#007AFF"}:{}}
                    onClick={()=>setBankFilter(b)}>{b}</button>
                ))}
              </div>
            );
          })()}
          <div style={{display:"flex",flexDirection:"column"}}>
            {investimentos
              .filter(inv => bankFilter==="Todos" || (inv.instituicao||"Sem banco")===bankFilter)
              .sort((a,b)=>((b as any).data_aplicacao ?? "").localeCompare((a as any).data_aplicacao ?? ""))
              .map(inv => {
              const ganho = totalGanhoFor(inv.id);
              const saldoAtual = saldoAtualFor(inv.id, inv.valor_inicial??0);
              const dataAplicacao = (inv as any).data_aplicacao as string | null;
              return (
                <div key={inv.id} className="tx-item tx-enter" onClick={()=>setDetailFor(inv)}>
                  <div className="tx-icon" style={{background:"#F2F2F5"}}>📈</div>
                  <div className="tx-info">
                    <div className="tx-name">{inv.nome}</div>
                    <div style={{fontSize:12,color:"#8E8E93",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {inv.tipo}{inv.instituicao?` · ${inv.instituicao}`:""}{ganho!==0?` · rend. ${formatBRL(ganho)}`:""}
                    </div>
                  </div>
                  <div className="tx-right" onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div>
                      <div style={{fontSize:15,fontWeight:700,color:"#1D1D1F"}}>{formatBRL(saldoAtual)}</div>
                      <div style={{fontSize:11,color:"#8E8E93"}}>{dataAplicacao ? new Date(dataAplicacao+"T00:00:00").toLocaleDateString("pt-BR") : ""}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      <span onClick={()=>{setEditing(inv);const matches=accounts.some(a=>a.name===inv.instituicao);setForm({nome:inv.nome,tipo:inv.tipo??TIPOS_INVESTIMENTO[0],valor_inicial:String(inv.valor_inicial??""),instituicao:matches?(inv.instituicao??""):(inv.instituicao?"Outro":""),instituicaoOutro:matches?"":(inv.instituicao??""),dataAplicacao:(inv as any).data_aplicacao??new Date().toISOString().slice(0,10)});setShowForm(true);}} style={{cursor:"pointer",fontSize:14}}>✏️</span>
                      <span onClick={()=>deleteInvestimento(inv)} style={{cursor:"pointer",fontSize:14}}>🗑️</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Form: novo/editar investimento */}
      {showForm && createPortal(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setShowForm(false)}>
          <div className="modal-sheet-center" ref={formSheetRef} onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>{editing?"Editar":"Novo"} investimento</div>
            <input placeholder="Nome (ex: CDB Banco X, Tesouro IPCA+)" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />
            <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit",background:"#FFF"}}>
              {TIPOS_INVESTIMENTO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={form.instituicao} onChange={e=>setForm(f=>({...f,instituicao:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit",background:"#FFF"}}>
              <option value="">Selecione o banco</option>
              {accounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
              <option value="Outro">Outro (fora das contas cadastradas)</option>
            </select>
            {form.instituicao === "Outro" && (
              <input placeholder="Nome do banco/corretora" value={form.instituicaoOutro ?? ""} onChange={e=>setForm(f=>({...f,instituicaoOutro:e.target.value}))}
                style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />
            )}
            <input placeholder="Valor investido inicialmente (R$)" value={form.valor_inicial} onChange={e=>setForm(f=>({...f,valor_inicial:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />
            <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>Data da aplicação</label>
            <input type="date" value={form.dataAplicacao} onChange={e=>setForm(f=>({...f,dataAplicacao:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:16,fontFamily:"inherit"}} />
            <button disabled={saving} onClick={saveInvestimento} style={{width:"100%",padding:14,background:"#007AFF",color:"#FFF",border:"none",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.6:1}}>
              {saving?"Salvando…":"Salvar"}
            </button>
            <button onClick={()=>setShowForm(false)} style={{width:"100%",padding:12,background:"transparent",color:"#86868B",border:"none",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
          </div>
        </div>,
        document.body
      )}

      {/* Detail: extrato do investimento */}
      {detailFor && createPortal(
        <div className="modal-backdrop" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>{setDetailFor(null);setOpForm({tipo:null,valor:"",data:new Date().toISOString().slice(0,10)});}}>
          <div className="modal-sheet-center" onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontSize:17,fontWeight:600,marginBottom:4}}>{detailFor.nome}</div>
            <div style={{fontSize:13,color:"#86868B",marginBottom:4}}>Saldo atual: <strong style={{color:"#1D1D1F"}}>{formatBRL(saldoAtualFor(detailFor.id, detailFor.valor_inicial??0))}</strong></div>
            <div style={{fontSize:13,color:"#86868B",marginBottom:16}}>Rendimento acumulado: <strong style={{color:"#34C759"}}>{formatBRL(totalGanhoFor(detailFor.id))}</strong></div>

            {/* Botões rápidos de Aportar/Retirar/Rendimento */}
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <button onClick={()=>setOpForm(f=>({...f,tipo:f.tipo==="aporte"?null:"aporte",contaId:f.contaId||accounts[0]?.id||""}))}
                style={{flex:1,padding:12,background:opForm.tipo==="aporte"?"#34C759":"#F5F5F7",color:opForm.tipo==="aporte"?"#FFF":"#1D1D1F",border:"none",borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                ⬆️ Aportar
              </button>
              <button onClick={()=>setOpForm(f=>({...f,tipo:f.tipo==="retirada"?null:"retirada",contaId:f.contaId||accounts[0]?.id||""}))}
                style={{flex:1,padding:12,background:opForm.tipo==="retirada"?"#FF3B30":"#F5F5F7",color:opForm.tipo==="retirada"?"#FFF":"#1D1D1F",border:"none",borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                ⬇️ Retirar
              </button>
              <button onClick={()=>setOpForm(f=>({...f,tipo:f.tipo==="rendimento"?null:"rendimento"}))}
                style={{flex:1,padding:12,background:opForm.tipo==="rendimento"?"#007AFF":"#F5F5F7",color:opForm.tipo==="rendimento"?"#FFF":"#1D1D1F",border:"none",borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                📈 Rendimento
              </button>
            </div>

            {opForm.tipo && (
              <div style={{background:"#F5F5F7",borderRadius:14,padding:14,marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>{opForm.tipo==="aporte"?"Novo aporte":opForm.tipo==="retirada"?"Retirada/resgate":"Rendimento do período"}</div>
                <div style={{display:"flex",gap:10,marginBottom:10}}>
                  <input placeholder="Valor (R$)" value={opForm.valor} onChange={e=>setOpForm(f=>({...f,valor:e.target.value}))}
                    style={{flex:1,padding:"10px 12px",border:"1.5px solid #E5E5EA",borderRadius:10,fontSize:14,fontFamily:"inherit"}} />
                  <input type="date" value={opForm.data} onChange={e=>setOpForm(f=>({...f,data:e.target.value}))}
                    style={{flex:1,padding:"10px 12px",border:"1.5px solid #E5E5EA",borderRadius:10,fontSize:14,fontFamily:"inherit"}} />
                </div>
                {opForm.tipo !== "rendimento" && (
                  <>
                    <label style={{fontSize:12,color:"#86868B",display:"block",marginBottom:4}}>
                      {opForm.tipo==="aporte" ? "De qual conta saiu o dinheiro?" : "Para qual conta vai o dinheiro?"}
                    </label>
                    <select value={opForm.contaId} onChange={e=>setOpForm(f=>({...f,contaId:e.target.value}))}
                      style={{width:"100%",padding:"10px 12px",border:"1.5px solid #E5E5EA",borderRadius:10,fontSize:14,fontFamily:"inherit",background:"#FFF",marginBottom:10}}>
                      <option value="">Nenhuma (só registrar no investimento)</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </>
                )}
                {opForm.tipo === "rendimento" && (
                  <div style={{fontSize:11,color:"#86868B",marginBottom:10}}>Isso soma direto ao saldo do investimento, sem mexer em nenhuma conta (é o juro/rendimento ganho, não é dinheiro que saiu de algum lugar).</div>
                )}
                <button onClick={async ()=>{
                  const v = parseFloat(opForm.valor.replace(",","."));
                  if (isNaN(v) || v<=0) { setToast({msg:"Preencha um valor válido",type:"error"}); return; }
                  if (opForm.tipo === "rendimento") await saveRendimentoDireto(detailFor, v, opForm.data);
                  else await saveOperacao(detailFor, opForm.tipo!, v, opForm.data, opForm.contaId || null);
                  setOpForm({tipo:null, valor:"", data:new Date().toISOString().slice(0,10), contaId:""});
                }} style={{width:"100%",padding:11,background:opForm.tipo==="aporte"?"#34C759":opForm.tipo==="retirada"?"#FF3B30":"#007AFF",color:"#FFF",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  Confirmar {opForm.tipo==="aporte"?"aporte":opForm.tipo==="retirada"?"retirada":"rendimento"}
                </button>
              </div>
            )}

            <div style={{background:"#F5F5F7",borderRadius:14,padding:14,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>Lançar saldo acumulado do mês (rendimento)</div>
              <input type="month" value={lancForm.mes} onChange={e=>setLancForm(f=>({...f,mes:e.target.value}))}
                style={{width:"100%",padding:"10px 12px",border:"1.5px solid #E5E5EA",borderRadius:10,fontSize:14,marginBottom:8,fontFamily:"inherit"}} />
              <input placeholder="Saldo acumulado atual (R$)" value={lancForm.saldo_acumulado} onChange={e=>setLancForm(f=>({...f,saldo_acumulado:e.target.value}))}
                style={{width:"100%",padding:"10px 12px",border:"1.5px solid #E5E5EA",borderRadius:10,fontSize:14,marginBottom:8,fontFamily:"inherit"}} />
              {lancForm.saldo_acumulado && (() => {
                const saldoAtual = parseFloat(lancForm.saldo_acumulado.replace(",","."));
                const anteriores = lancamentosFor(detailFor.id).filter(l => l.mes < lancForm.mes).sort((a,b)=>b.mes.localeCompare(a.mes));
                const saldoAnterior = anteriores[0]?.saldo_acumulado ?? detailFor.valor_inicial ?? 0;
                const ganhoPreview = saldoAtual - saldoAnterior;
                return !isNaN(saldoAtual) && (
                  <div style={{fontSize:12,color:ganhoPreview>=0?"#34C759":"#FF3B30",marginBottom:8}}>
                    Rendimento do mês: {formatBRL(ganhoPreview)} (em relação a {formatBRL(saldoAnterior)})
                  </div>
                );
              })()}
              <input placeholder="Observação (opcional)" value={lancForm.observacao} onChange={e=>setLancForm(f=>({...f,observacao:e.target.value}))}
                style={{width:"100%",padding:"10px 12px",border:"1.5px solid #E5E5EA",borderRadius:10,fontSize:14,marginBottom:10,fontFamily:"inherit"}} />
              <button disabled={savingLanc} onClick={saveLancamento} style={{width:"100%",padding:11,background:"#007AFF",color:"#FFF",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:savingLanc?0.6:1}}>
                {savingLanc?"Salvando…":"Salvar rendimento"}
              </button>
            </div>

            <div style={{fontSize:13,fontWeight:600,color:"#86868B",marginBottom:8}}>Extrato (mais recente primeiro)</div>
            {lancamentosFor(detailFor.id).length === 0 ? (
              <div style={{fontSize:13,color:"#86868B",padding:"8px 0"}}>Nenhuma movimentação registrada ainda.</div>
            ) : (
              [...lancamentosFor(detailFor.id)]
                .sort((a,b)=>(b.data_operacao ?? b.mes+"-28").localeCompare(a.data_operacao ?? a.mes+"-28"))
                .map(l => {
                  const isOp = !!l.tipo_operacao;
                  const icon = l.tipo_operacao==="aporte" ? "⬆️" : l.tipo_operacao==="retirada" ? "⬇️" : "📈";
                  const valorMostrado = isOp ? (l.valor_operacao ?? 0) : l.valor_ganho;
                  const label = l.tipo_operacao==="aporte" ? "Aporte" : l.tipo_operacao==="retirada" ? "Retirada" : `Rendimento — ${monthKeyLabel(l.mes)}`;
                  const dataMostrada = l.data_operacao ? new Date(l.data_operacao+"T00:00:00").toLocaleDateString("pt-BR") : monthKeyLabel(l.mes);
                  return (
                    <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"0.5px solid #E5E5E7"}}>
                      <div>
                        <div style={{fontSize:13,color:"#1D1D1F"}}>{icon} {label}</div>
                        <div style={{fontSize:11,color:"#86868B",marginTop:2}}>{dataMostrada}{l.observacao?` · ${l.observacao}`:""}{!isOp && l.saldo_acumulado!=null ? ` · Saldo: ${formatBRL(l.saldo_acumulado)}` : ""}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:14,fontWeight:600,color:valorMostrado>=0?"#34C759":"#FF3B30"}}>{valorMostrado>=0?"+":""}{formatBRL(valorMostrado)}</span>
                        <span onClick={()=>deleteLancamento(l.id)} style={{cursor:"pointer",fontSize:14}}>🗑️</span>
                      </div>
                    </div>
                  );
                })
            )}

            <button onClick={()=>setDetailFor(null)} style={{width:"100%",padding:12,marginTop:16,background:"transparent",color:"#86868B",border:"none",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Fechar</button>
          </div>
        </div>,
        document.body
      )}

      {toast && createPortal(
        <div style={{position:"fixed",bottom:90,left:16,right:16,maxWidth:568,margin:"0 auto",background:toast.type==="error"?"#FF3B30":"#1D1D1F",color:"#FFF",padding:"12px 16px",borderRadius:12,fontSize:13,textAlign:"center",zIndex:300}}>
          {toast.msg}
        </div>,
        document.body
      )}

      {/* Botão flutuante — lançar investimento direto nessa aba */}
      <div
        onClick={()=>{setEditing(null);setForm({nome:"",tipo:TIPOS_INVESTIMENTO[0],valor_inicial:"",instituicao:"",instituicaoOutro:"",dataAplicacao:new Date().toISOString().slice(0,10)});setShowForm(true);}}
        title="Novo investimento"
        style={{position:"fixed",bottom:"calc(90px + env(safe-area-inset-bottom))",right:16,width:48,height:48,borderRadius:24,background:"#34C759",color:"#FFF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:300,cursor:"pointer",boxShadow:"0 4px 14px rgba(52,199,89,0.4)",zIndex:90}}
      >
        +
      </div>
    </div>
  );
}

// ─── Ajustes page ─────────────────────────────────────────────────────────────

type CoupleLinkData = ReturnType<typeof useCoupleLink>;

function AjustesPage({ user, onSignOut, coupleLink }: { user: User; onSignOut: () => void; coupleLink: CoupleLinkData }) {
  const name    = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;
  const email   = user.email ?? "Sem email";
  const initial = (name?.[0] ?? email[0] ?? "?").toUpperCase();
  const [inviteEmail, setInviteEmail]   = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg]       = useState<{text:string;ok:boolean}|null>(null);
  const [unlinking, setUnlinking]       = useState(false);

  async function handleSendInvite() {
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) { setInviteMsg({text:"Insira um email válido.",ok:false}); return; }
    setInviteSending(true); setInviteMsg(null);
    const err = await coupleLink.sendInvite(inviteEmail.trim());
    setInviteSending(false);
    if (err) setInviteMsg({text:`Erro: ${err}`,ok:false});
    else     setInviteMsg({text:"Convite enviado! A pessoa receberá um link por email.",ok:true});
  }

  async function handleUnlink() {
    if (!confirm("Desvincular a conta do casal? Os dados continuarão existindo, mas as visões voltarão ao modo individual.")) return;
    setUnlinking(true);
    await coupleLink.unlinkCouple();
    setUnlinking(false);
  }

  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalMsg, setGcalMsg] = useState<string|null>(null);
  useEffect(() => { hasGoogleCalendarRefreshToken(user.id).then(setGcalConnected); }, []);

  async function handleConnectGoogle() {
    setGcalLoading(true); setGcalMsg(null);
    try {
      await connectGoogleCalendar(user.id);
      setGcalConnected(true);
      setGcalMsg("Conectado! Os vencimentos serão adicionados à sua agenda automaticamente.");
    } catch (e) {
      setGcalMsg(e instanceof Error ? e.message : "Erro ao conectar");
    }
    setGcalLoading(false);
  }

  async function handleDisconnectGoogle() {
    await disconnectGoogleCalendar(user.id);
    setGcalConnected(false);
    setGcalMsg(null);
  }

  const [faceIdOn, setFaceIdOn] = useState(false);
  const [faceIdLoading, setFaceIdLoading] = useState(false);
  const [faceIdMsg, setFaceIdMsg] = useState<string|null>(null);
  useEffect(() => { setFaceIdOn(isFaceIdEnabled()); }, []);

  async function handleEnableFaceId() {
    setFaceIdLoading(true); setFaceIdMsg(null);
    try {
      await enableFaceId(user.id, email);
      setFaceIdOn(true);
      setFaceIdMsg("Ativado! Da próxima vez que abrir o app, ele vai pedir a biometria.");
    } catch (e) {
      setFaceIdMsg(e instanceof Error ? e.message : "Erro ao configurar");
    }
    setFaceIdLoading(false);
  }

  async function handleDisableFaceId() {
    await disableFaceId(user.id);
    setFaceIdOn(false);
    setFaceIdMsg(null);
  }

  const INFO_ROWS: {icon:string; label:string; value:string}[] = [
    { icon:"✉️", label:"Email",    value: email },
    { icon:"🔐", label:"Método",   value: user.app_metadata?.provider === "google" ? "Google" : "Magic Link" },
    { icon:"📅", label:"Membro desde", value: user.created_at ? new Date(user.created_at).toLocaleDateString("pt-BR", { day:"2-digit", month:"long", year:"numeric" }) : "—" },
  ];

  return (
    <div className="scroll-content page-fade">
      <div className="section-title" style={{marginBottom:24}}>Ajustes</div>

      {/* Profile card */}
      <div style={{background:"linear-gradient(135deg,#007AFF,#0055D4)",borderRadius:20,padding:"24px 20px",marginBottom:20,display:"flex",alignItems:"center",gap:16,color:"#FFF"}}>
        <div style={{width:60,height:60,borderRadius:30,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,flexShrink:0,border:"2px solid rgba(255,255,255,0.3)"}}>
          {initial}
        </div>
        <div style={{minWidth:0}}>
          <div style={{fontWeight:700,fontSize:18,marginBottom:3,letterSpacing:-0.3}}>{name ?? "Usuário"}</div>
          <div style={{fontSize:13,opacity:0.82,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{email}</div>
        </div>
      </div>

      {/* Account info rows */}
      <div style={{background:"#F5F5F7",borderRadius:16,overflow:"hidden",marginBottom:20}}>
        {INFO_ROWS.map((r,i)=>(
          <div key={r.label} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:i<INFO_ROWS.length-1?"1px solid rgba(0,0,0,0.06)":"none"}}>
            <span style={{fontSize:18,width:24,textAlign:"center"}}>{r.icon}</span>
            <span style={{fontSize:14,color:"#6E6E73",fontWeight:500,width:90,flexShrink:0}}>{r.label}</span>
            <span style={{fontSize:14,fontWeight:600,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.value}</span>
          </div>
        ))}
      </div>

      {/* Google Agenda section */}
      <div className="section-title" style={{marginBottom:14}}>Google Agenda 📅</div>
      <div style={{background:"#F5F5F7",borderRadius:16,padding:20,marginBottom:20}}>
        {gcalConnected ? (
          <>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
              <div style={{width:48,height:48,borderRadius:24,background:"linear-gradient(135deg,#34A853,#4285F4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                ✓
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:2}}>Agenda conectada</div>
                <div style={{fontSize:12,color:"#6E6E73"}}>Vencimentos de contas e faturas são adicionados automaticamente</div>
              </div>
            </div>
            <button onClick={handleDisconnectGoogle} style={{width:"100%",padding:"12px",background:"rgba(255,59,48,0.07)",color:"#FF3B30",border:"1.5px solid rgba(255,59,48,0.18)",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Desconectar
            </button>
          </>
        ) : (
          <>
            <div style={{fontSize:13,color:"#6E6E73",marginBottom:14,lineHeight:1.5}}>
              Conecte sua Google Agenda para que os vencimentos de contas fixas e faturas de cartão apareçam automaticamente como lembretes.
            </div>
            <button onClick={handleConnectGoogle} disabled={gcalLoading} style={{width:"100%",padding:"12px",background:"#007AFF",color:"#FFF",border:"none",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:gcalLoading?0.6:1}}>
              {gcalLoading ? "Conectando…" : "Conectar Google Agenda"}
            </button>
          </>
        )}
        {gcalMsg && <div style={{fontSize:12,color:gcalConnected?"#34C759":"#FF3B30",marginTop:10}}>{gcalMsg}</div>}
        <div style={{fontSize:11,color:"#9A9A9E",marginTop:10,lineHeight:1.5}}>
          A conexão se renova sozinha em segundo plano — não é preciso reconectar periodicamente.
        </div>
      </div>

      {/* Face ID / Touch ID section */}
      {isFaceIdSupported() && (
        <>
          <div className="section-title" style={{marginBottom:14}}>Bloqueio com Face ID 🔒</div>
          <div style={{background:"#F5F5F7",borderRadius:16,padding:20,marginBottom:20}}>
            {faceIdOn ? (
              <>
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
                  <div style={{width:48,height:48,borderRadius:24,background:"linear-gradient(135deg,#1D1D1F,#3A3A3C)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                    🔒
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:700,marginBottom:2}}>Bloqueio ativado</div>
                    <div style={{fontSize:12,color:"#6E6E73"}}>O app pede Face ID/Touch ID toda vez que for aberto</div>
                  </div>
                </div>
                <button onClick={handleDisableFaceId} style={{width:"100%",padding:"12px",background:"rgba(255,59,48,0.07)",color:"#FF3B30",border:"1.5px solid rgba(255,59,48,0.18)",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  Desativar bloqueio
                </button>
              </>
            ) : (
              <>
                <div style={{fontSize:13,color:"#6E6E73",marginBottom:14,lineHeight:1.5}}>
                  Ative para que o app peça Face ID, Touch ID ou a biometria do seu celular sempre que for aberto — uma camada extra de privacidade, além do login.
                </div>
                <button onClick={handleEnableFaceId} disabled={faceIdLoading} style={{width:"100%",padding:"12px",background:"#007AFF",color:"#FFF",border:"none",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:faceIdLoading?0.6:1}}>
                  {faceIdLoading ? "Configurando…" : "Ativar Face ID / Touch ID"}
                </button>
              </>
            )}
            {faceIdMsg && <div style={{fontSize:12,color:faceIdOn?"#34C759":"#FF3B30",marginTop:10}}>{faceIdMsg}</div>}
            <div style={{fontSize:11,color:"#9A9A9E",marginTop:10,lineHeight:1.5}}>
              É uma trava local do dispositivo — não substitui o login, só protege o acesso mais rápido.
            </div>
          </div>
        </>
      )}

      {/* Couple section */}
      <div className="section-title" style={{marginBottom:14}}>Conta do Casal 💑</div>

      {coupleLink.cLoading ? (
        <div style={{textAlign:"center",padding:20,color:"#6E6E73",fontSize:14}}>Carregando…</div>
      ) : coupleLink.isLinked ? (
        /* ── Linked state ── */
        <div style={{background:"#F5F5F7",borderRadius:16,padding:20,marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
            <div style={{width:48,height:48,borderRadius:24,background:"linear-gradient(135deg,#FF2D55,#AF52DE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"#FFF",fontWeight:700,flexShrink:0}}>
              👩
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:700,marginBottom:2}}>Conta vinculada ✓</div>
              <div style={{fontSize:12,color:"#6E6E73"}}>Visão Geral mostra dados combinados do casal</div>
            </div>
          </div>
          <button onClick={handleUnlink} disabled={unlinking} style={{width:"100%",padding:"12px",background:"rgba(255,59,48,0.07)",color:"#FF3B30",border:"1.5px solid rgba(255,59,48,0.18)",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            {unlinking ? "Desvinculando…" : "Desvincular Conta"}
          </button>
        </div>
      ) : coupleLink.pendingInviteToken ? (
        /* ── Pending invite state ── */
        <div style={{background:"#FFF9F0",border:"1.5px solid #FF9500",borderRadius:16,padding:20,marginBottom:20}}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>⏳ Convite pendente</div>
          <div style={{fontSize:13,color:"#6E6E73",marginBottom:14}}>Aguardando {coupleLink.pendingEmail ?? "a pessoa"} aceitar o convite por email.</div>
          <button onClick={()=>coupleLink.cancelInvite()} style={{width:"100%",padding:"11px",background:"rgba(255,59,48,0.07)",color:"#FF3B30",border:"1.5px solid rgba(255,59,48,0.18)",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            Cancelar Convite
          </button>
        </div>
      ) : (
        /* ── No partner state ── */
        <div style={{background:"#F5F5F7",borderRadius:16,padding:20,marginBottom:20}}>
          <div style={{fontSize:14,color:"#6E6E73",marginBottom:14,lineHeight:1.5}}>
            Vincule a conta da sua esposa/parceiro(a). Ela receberá um link mágico por email para criar a conta e se conectar.
          </div>
          <div className="form-field" style={{marginBottom:12}}>
            <label className="form-label">Email do(a) parceiro(a)</label>
            <input
              className="form-input"
              type="email"
              placeholder="esposa@email.com"
              value={inviteEmail}
              onChange={e=>setInviteEmail(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleSendInvite()}
            />
          </div>
          {inviteMsg && (
            <div style={{padding:"10px 14px",borderRadius:10,marginBottom:12,fontSize:13,fontWeight:500,background:inviteMsg.ok?"rgba(52,199,89,0.10)":"rgba(255,59,48,0.08)",color:inviteMsg.ok?"#1EA446":"#C9352B"}}>
              {inviteMsg.text}
            </div>
          )}
          <button
            onClick={handleSendInvite}
            disabled={inviteSending}
            style={{width:"100%",padding:"13px",background:"#007AFF",color:"#FFF",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:inviteSending?0.6:1}}
          >
            {inviteSending ? "Enviando…" : "💌 Enviar Convite por Email"}
          </button>
        </div>
      )}

      {/* Sign out */}
      <button
        onClick={onSignOut}
        style={{width:"100%",padding:"15px",background:"rgba(255,59,48,0.08)",color:"#FF3B30",border:"1.5px solid rgba(255,59,48,0.18)",borderRadius:16,fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"opacity 0.15s"}}
      >
        Sair da Conta
      </button>

      <div style={{marginTop:28,textAlign:"center",fontSize:12,color:"#AEAEB2",lineHeight:1.6}}>
        Minhas Finanças · Dados armazenados em segurança no Supabase
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

type NavPage = "home"|"relatorios"|"fixas"|"cartoes"|"planejamento"|"ajustes";

export default function App() {
  // ── Auth state ──────────────────────────────────────────────────────────────
  const [user,        setUser]        = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [locked,      setLocked]      = useState(false);
  const [unlockErr,   setUnlockErr]   = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user) {
        await Promise.all([
          restoreFaceIdFromServer(session.user.id),
          restoreGoogleCalendarFromServer(session.user.id),
        ]);
        if (isFaceIdEnabled()) setLocked(true);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user) {
        await Promise.all([
          restoreFaceIdFromServer(session.user.id),
          restoreGoogleCalendarFromServer(session.user.id),
        ]);
        if (isFaceIdEnabled()) setLocked(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  // ── Show auth loading spinner ───────────────────────────────────────────────
  if (authLoading) {
    return (
      <>
        <style>{STYLE}</style>
        <div style={{minHeight:"100svh",display:"flex",alignItems:"center",justifyContent:"center",background:"#FFF",fontFamily:"-apple-system,sans-serif"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
            <div style={{fontSize:52}}>💰</div>
            <div className="spinner" />
            <div style={{fontSize:14,color:"#6E6E73"}}>Verificando sessão…</div>
          </div>
        </div>
      </>
    );
  }

  // ── Show login page when not authenticated ──────────────────────────────────
  if (!user) return <LoginPage />;

  // ── Face ID / Touch ID lock gate ─────────────────────────────────────────────
  if (locked) {
    return (
      <>
        <style>{STYLE}</style>
        <div style={{minHeight:"100svh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#FFF",fontFamily:"-apple-system,sans-serif",gap:20,padding:24}}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect width="64" height="64" rx="16" fill="#1D1D1F"/>
            <path d="M17 40L25 31L32 37L46 21" stroke="#34C759" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M38 21H46V29" stroke="#34C759" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div style={{fontSize:17,fontWeight:600,color:"#1D1D1F"}}>Minhas Finanças está bloqueado</div>
          {unlockErr && <div style={{fontSize:13,color:"#FF3B30",textAlign:"center"}}>{unlockErr}</div>}
          <button
            onClick={async ()=>{
              setUnlockErr(null);
              const ok = await unlockWithFaceId();
              if (ok) setLocked(false);
              else setUnlockErr("Não foi possível confirmar. Tente novamente.");
            }}
            style={{padding:"14px 28px",background:"#007AFF",color:"#FFF",border:"none",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
          >
            🔓 Desbloquear com Face ID / Touch ID
          </button>
          <span onClick={handleSignOut} style={{fontSize:13,color:"#86868B",cursor:"pointer"}}>Sair da conta</span>
        </div>
      </>
    );
  }

  // ── Main app ────────────────────────────────────────────────────────────────
  return <MainApp user={user} onSignOut={handleSignOut} />;
}

function MainApp({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [view,    setView]    = useState<ViewType>("geral");
  const [navPage, setNavPage] = useState<NavPage>("home");
  const [fabOpen, setFabOpen] = useState(false);
  const [modal,   setModal]   = useState<null|"transacao"|"extrato"|"conta">(null);
  const [editTx,  setEditTx]  = useState<NormTx|null>(null);
  const [toast,   setToast]   = useState<{msg:string;type:"error"|"success"}|null>(null);

  // Couple linking
  const coupleLink = useCoupleLink(user.id);

  // Accept invite from URL param on first load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("invite");
    if (token) {
      coupleLink.acceptInvite(token).then(() => {
        // Clean the URL without reload
        const clean = window.location.pathname;
        window.history.replaceState({}, "", clean);
        setToast({ msg:"Conta vinculada com sucesso! 💑", type:"success" });
        setNavPage("ajustes");
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { accounts, transactions, bills, loading, error, refetch } = useFinanceData(view, user.id, coupleLink.partnerUserId);

  // Puxar para atualizar (pull-to-refresh)
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartY = useRef<number | null>(null);
  const PULL_THRESHOLD = 70;

  function handleTouchStart(e: React.TouchEvent) {
    if (window.scrollY <= 0 && !refreshing) pullStartY.current = e.touches[0].clientY;
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (pullStartY.current === null) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0 && window.scrollY <= 0) setPullY(Math.min(delta / 1.8, 100));
  }
  async function handleTouchEnd() {
    if (pullY > PULL_THRESHOLD) {
      setRefreshing(true);
      setPullY(60);
      await refetch();
      setTimeout(() => { setRefreshing(false); setPullY(0); }, 400);
    } else {
      setPullY(0);
    }
    pullStartY.current = null;
  }

  const currentMonthKeyMain = new Date().toISOString().slice(0,7);
  const transactionsThisMonthMain = transactions.filter(t => (t.date ?? "").startsWith(currentMonthKeyMain));
  const totalIncome  = transactionsThisMonthMain.filter(t=>t.type==="income").reduce((s,t)=>s+t.value,0);
  const totalExpense = transactionsThisMonthMain.filter(t=>t.type==="expense").reduce((s,t)=>s+t.value,0);
  const totalSaidas      = transactionsThisMonthMain.filter(t=>t.type==="expense" && t.meio_pagamento!=="credito").reduce((s,t)=>s+t.value,0);
  const totalCartaoMes   = transactionsThisMonthMain.filter(t=>t.meio_pagamento==="credito" && t.type!=="transfer").reduce((s,t)=>s+t.value,0);
  const saldo        = totalIncome - totalExpense;

  // Total investido este mês — vem da aba Investimentos (aportes iniciais + lançamentos do mês), não de "transactions"
  const [totalInvestMes, setTotalInvestMes] = useState(0);
  useEffect(() => {
    (async () => {
      const [invRes, lancRes] = await Promise.all([
        supabase.from("investimentos").select("valor_inicial, data_aplicacao"),
        supabase.from("investimento_lancamentos").select("valor_ganho, valor_operacao, mes, data_operacao"),
      ]);
      const aportesNovos = (invRes.data ?? [])
        .filter((i: any) => (i.data_aplicacao ?? "").startsWith(currentMonthKeyMain))
        .reduce((s: number, i: any) => s + (i.valor_inicial ?? 0), 0);
      const lancamentosDoMes = (lancRes.data ?? [])
        .filter((l: any) => ((l.data_operacao ?? l.mes+"-01") as string).startsWith(currentMonthKeyMain))
        .reduce((s: number, l: any) => s + (l.valor_ganho ?? 0) + (l.valor_operacao ?? 0), 0);
      setTotalInvestMes(aportesNovos + lancamentosDoMes);
    })();
  }, [currentMonthKeyMain]);

  const handleNav = (page: NavPage) => { setNavPage(page); setFabOpen(false); };
  const showToast = (msg: string, type: "error"|"success" = "error") => setToast({msg,type});

  // User avatar data
  const userName    = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;
  const userInitial = (userName?.[0] ?? user.email?.[0] ?? "?").toUpperCase();
  const userDisplay = userName ?? user.email ?? "Usuário";

  const NAV_ITEMS: {icon:string;label:string;page:NavPage}[] = [
    { icon:"🏠", label:"Início",     page:"home" },
    { icon:"📊", label:"Relatórios", page:"relatorios" },
    { icon:"📌", label:"Fixas",      page:"fixas" },
    { icon:"🗂️", label:"Cartões",   page:"cartoes" },
    { icon:"🎯", label:"Planejar",  page:"planejamento" },
    { icon:"⚙️", label:"Ajustes",   page:"ajustes" },
  ];

  return (
    <>
      <style>{STYLE}</style>
      <div className="app" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>

        {(pullY > 0 || refreshing) && (
          <div style={{position:"absolute",top:0,left:0,right:0,display:"flex",justifyContent:"center",alignItems:"center",height:Math.max(pullY,refreshing?60:0),overflow:"hidden",transition:refreshing?"height 0.2s":"none",zIndex:150}}>
            <div style={{fontSize:20,transform:`rotate(${Math.min(pullY,100)*3.6}deg)`,transition:refreshing?"transform 0.4s linear infinite":"none",animation:refreshing?"spin 0.7s linear infinite":"none"}}>
              🔄
            </div>
          </div>
        )}

        {/* Sticky header */}
        <div className="seg-wrap">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div className="logo-header" style={{margin:0,display:"flex",alignItems:"center",gap:10}}>
              <svg width="30" height="30" viewBox="0 0 64 64" fill="none" style={{flexShrink:0}}>
                <rect width="64" height="64" rx="16" fill="#1D1D1F"/>
                <path d="M17 40L25 31L32 37L46 21" stroke="#34C759" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M38 21H46V29" stroke="#34C759" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{fontSize:"clamp(20px,5.5vw,26px)",fontWeight:500,letterSpacing:"-0.4px",color:"#1D1D1F"}}>
                Minhas <strong style={{fontWeight:700}}>Finanças</strong>
              </span>
            </div>
            {/* User avatar */}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div
                style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"4px 8px 4px 4px",borderRadius:20,background:"#F5F5F7",transition:"background 0.15s"}}
                onClick={()=>handleNav("ajustes")}
                title={userDisplay}
              >
                <div style={{width:30,height:30,borderRadius:15,background:"linear-gradient(135deg,#007AFF,#0055D4)",display:"flex",alignItems:"center",justifyContent:"center",color:"#FFF",fontSize:13,fontWeight:700,flexShrink:0}}>
                  {userInitial}
                </div>
                <span style={{fontSize:13,fontWeight:500,color:"#3C3C43",maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {userName ?? user.email?.split("@")[0] ?? "Usuário"}
              </span>
              </div>
            </div>
          </div>
          {navPage === "home" && (
            <div className="seg-ctrl">
              <button className={`seg-btn${view==="geral" ?" active":""}`} onClick={()=>setView("geral")}>Visão Geral</button>
              <button className={`seg-btn${view==="eu"    ?" active":""}`} onClick={()=>setView("eu")}>Despesas do Mês</button>
              <button className={`seg-btn${view==="esposa"?" active":""}`} onClick={()=>setView("esposa")}>Investimentos</button>
            </div>
          )}
        </div>

        {/* Summary bar (home, general view only) */}
        {navPage === "home" && view === "geral" && (
          <div className="summary-bar" style={{flexDirection:"column",gap:0}}>
            <div style={{fontSize:10,color:"#8E8E93",textAlign:"left",padding:"0 6px 6px",fontWeight:600,letterSpacing:0.3,textTransform:"uppercase"}}>
              {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()}
            </div>
            <div style={{display:"flex",width:"100%",overflowX:"auto",gap:4}}>
              <div className="summary-item" style={{flex:"0 0 auto",minWidth:92,padding:"0 6px"}}>
                <div className="summary-label">Receitas</div>
                <div className="summary-value income">{loading?"…":formatBRL(totalIncome)}</div>
              </div>
              <div className="summary-item" style={{flex:"0 0 auto",minWidth:92,padding:"0 6px"}}>
                <div className="summary-label">Saídas</div>
                <div className="summary-value expense">{loading?"…":formatBRL(totalSaidas)}</div>
              </div>
              <div className="summary-item" style={{flex:"0 0 auto",minWidth:92,padding:"0 6px"}}>
                <div className="summary-label">Cartão de Crédito</div>
                <div className="summary-value" style={{color:"#5856D6"}}>{loading?"…":formatBRL(totalCartaoMes)}</div>
              </div>
              <div className="summary-item" style={{flex:"0 0 auto",minWidth:92,padding:"0 6px"}}>
                <div className="summary-label">Investimentos</div>
                <div className="summary-value" style={{color:"#34C759"}}>{loading?"…":formatBRL(totalInvestMes)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Pages */}
        {navPage === "home" && view === "geral" && (
          <HomePage
            key={`home-${view}`}
            accounts={accounts}
            transactions={transactions}
            bills={bills}
            loading={loading}
            error={error}
            refetch={refetch}
            onEditTx={setEditTx}
            onOpenInvestimentos={()=>setView("esposa")}
          />
        )}
        {navPage === "home" && view === "eu" && (
          <DespesasMesPage key="despesas-mes" bills={bills} accounts={accounts} />
        )}
        {navPage === "home" && view === "esposa" && (
          <InvestimentosPage key="investimentos" userId={user.id} accounts={accounts} />
        )}
        {navPage === "relatorios" && (
          <RelatoriosPage key="relatorios" transactions={transactions} bills={bills} loading={loading} />
        )}
        {navPage === "fixas" && (
          <ContasFixasPage key="fixas" userId={user.id} transactions={transactions} accounts={accounts} onOpenCartoes={()=>handleNav("cartoes")} />
        )}
        {navPage === "cartoes" && (
          <CartoesPage key="cartoes" userId={user.id} transactions={transactions} accounts={accounts} onImported={refetch} />
        )}
        {navPage === "planejamento" && (
          <PlanejamentoPage key="planejamento" userId={user.id} transactions={transactions} />
        )}
        {navPage === "ajustes" && (
          <AjustesPage user={user} onSignOut={onSignOut} coupleLink={coupleLink} />
        )}

        {/* Bottom nav */}
        <nav className="bottom-nav">
          {NAV_ITEMS.map(item=>(
            <div key={item.page} className={`nav-item${navPage===item.page?" active":""}`} onClick={()=>handleNav(item.page)}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </div>
          ))}
        </nav>

        {/* FAB overlay */}
        {!(navPage==="cartoes" || (navPage==="home" && view==="esposa")) && (
          <div className={`fab-overlay${fabOpen?" open":""}`} onClick={()=>setFabOpen(false)} />
        )}

        {/* FAB */}
        {!(navPage==="cartoes" || (navPage==="home" && view==="esposa")) && (
          <div className="fab-container">
            <div className="fab-actions">
              {([
                { label:"Nova Conta",     icon:"🏦", bg:"#34C759", action:"conta"     as const },
                { label:"Importar Extrato/Fatura", icon:"📄", bg:"#FF9500", action:"extrato"   as const },
                { label:"Nova Transação", icon:"💸", bg:"#007AFF", action:"transacao" as const },
              ]).map(item=>(
                <div key={item.label} className={`fab-action${fabOpen?" visible":""}`}>
                  <span className="fab-action-label" onClick={()=>{setModal(item.action);setFabOpen(false);}}>{item.label}</span>
                  <button className="fab-action-btn" style={{background:item.bg,color:"#FFF"}} onClick={()=>{setModal(item.action);setFabOpen(false);}}>
                    {item.icon}
                  </button>
                </div>
              ))}
            </div>
            <button className={`fab-main${fabOpen?" open":""}`} onClick={()=>setFabOpen(f=>!f)}>+</button>
          </div>
        )}

        {/* Toast */}
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)} />}

        {/* Modals */}
        {modal === "transacao" && (
          <NovaTransacaoModal
            accounts={accounts}
            userId={user.id}
            transactions={transactions}
            bills={bills}
            onClose={()=>setModal(null)}
            onSaved={()=>{
              refetch();
              showToast("Transação salva com sucesso!", "success");
            }}
          />
        )}

        {editTx && (
          <EditTransacaoModal
            tx={editTx}
            accounts={accounts}
            onClose={()=>setEditTx(null)}
            onSaved={()=>{
              refetch();
              showToast("Transação atualizada!", "success");
            }}
            onDeleted={()=>{
              refetch();
              showToast("Transação excluída.", "success");
            }}
          />
        )}

        {modal === "extrato" && (
          <ImportarDocumentoModal
            userId={user.id}
            accounts={accounts}
            transactions={transactions}
            onClose={()=>setModal(null)}
            onImported={()=>{ refetch(); showToast("Lançamentos importados!", "success"); }}
          />
        )}

        {modal === "conta" && (
          <div className="modal-overlay" onClick={()=>setModal(null)}>
            <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
              <div className="modal-handle" />
              <div className="modal-title">Nova Conta</div>
              <div className="form-field">
                <label className="form-label">Nome do Banco</label>
                <input className="form-input" placeholder="Ex: Bradesco" />
              </div>
              <div className="form-row">
                <div className="form-field" style={{flex:1}}>
                  <label className="form-label">Tipo</label>
                  <select className="form-input"><option>Corrente</option><option>Poupança</option><option>Investimento</option><option>Carteira</option></select>
                </div>
                <div className="form-field" style={{flex:1}}>
                  <label className="form-label">Saldo Inicial</label>
                  <input className="form-input" type="number" inputMode="decimal" placeholder="0,00" />
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Cor</label>
                <div style={{display:"flex",gap:10,padding:"4px 0",flexWrap:"wrap"}}>
                  {["#007AFF","#34C759","#FF3B30","#FF9500","#8A05BE","#5856D6"].map(c=>(
                    <div key={c} style={{width:32,height:32,borderRadius:"50%",background:c,cursor:"pointer"}} />
                  ))}
                </div>
              </div>
              <button className="btn-primary" onClick={()=>setModal(null)}>Adicionar Conta</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}


