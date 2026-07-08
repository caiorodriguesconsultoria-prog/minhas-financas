import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { User } from "@supabase/supabase-js";
import { supabase, normaliseTx, normaliseAccount } from "./supabase";
import type { Profile, Account, Transaction, BillToPay, Couple, Investimento, InvestimentoLancamento } from "./supabase";
import { LoginPage } from "./LoginPage";

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
  .modal-sheet { background:#FFF; border-radius:24px 24px 0 0; padding:24px 20px; padding-bottom:calc(32px + env(safe-area-inset-bottom)); width:100%; max-width:430px; animation:sheetSlideUp 0.32s cubic-bezier(0.32,1,0.64,1) both; will-change:transform; }
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
  if (n.includes("caixa"))   return "🟦";
  return "🏦";
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

function filterByPeriod(txs: NormTx[], period: "mes"|"trim"|"ano"): NormTx[] {
  const now = new Date();
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

  useEffect(() => { const t = setTimeout(() => setReady(true), 80); return () => clearTimeout(t); }, []);

  const filtered     = filterByPeriod(transactions, period);
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
  const PERIOD_LABELS: Record<string,string> = {
    mes: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
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
          <button key={p} className={`report-period-btn${period===p?" active":""}`} onClick={()=>{setPeriod(p);setSlice(null);}}>
            {["Este Mês","Trimestre","Este Ano"][i]}
          </button>
        ))}
      </div>

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
  accounts, transactions, bills, loading, error, refetch, onEditTx
}: {
  accounts: NormAccount[];
  transactions: NormTx[];
  bills: BillToPay[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  onEditTx: (tx: NormTx) => void;
}) {
  const [barsReady,   setBarsReady]   = useState(false);
  const [selectedBar, setSelectedBar] = useState<number|null>(null);
  const [txFilter,    setTxFilter]    = useState<"todos"|"receita"|"despesa">("todos");
  const [showFilter,  setShowFilter]  = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  useEffect(() => { const t = setTimeout(() => setBarsReady(true), 60); return () => clearTimeout(t); }, []);

  const homeMonthlyFlow = buildMonthlyFlow(transactions);
  const homeMaxChart    = Math.max(...homeMonthlyFlow.map(d=>Math.max(d.income,d.expense)),1);

  const filteredTxs = txFilter === "todos" ? transactions
    : transactions.filter(t => txFilter === "receita" ? t.type === "income" : t.type === "expense");

  const totalIncome  = transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.value,0);
  const totalExpense = transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.value,0);
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

  return (
    <div className="scroll-content page-fade">
      {/* Accounts */}
      <div className="section-header">
        <span className="section-title">Contas</span>
        <span className="section-link" onClick={()=>setShowAllAccounts(v=>!v)}>{showAllAccounts?"Ver menos":"Ver tudo"}</span>
      </div>
      {loading ? <Spinner /> : accounts.length === 0 ? (
        <EmptyState icon="🏦" title="Nenhuma conta" desc="Adicione contas no Supabase para vê-las aqui." />
      ) : showAllAccounts ? (
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
          <div className="account-card card-total card-enter" style={{animationDelay:"0s",width:"100%"}}>
            <div className="card-icon">💰</div>
            <div className="card-bank-name">Total Geral</div>
            <div className="card-balance">{formatBRL(totalBalance)}</div>
            <div className="card-label">{accounts.length} conta{accounts.length>1?"s":""} ativa{accounts.length>1?"s":""}</div>
          </div>
          {accounts.map((acc, i) => (
            <div key={acc.id} className={`account-card ${getCardClass(acc.name)} card-enter`} style={{animationDelay:`${(i+1)*0.06}s`,width:"100%"}}>
              <div className="card-icon">{getCardIcon(acc.name)}</div>
              <div className="card-bank-name">{acc.name}</div>
              <div className="card-balance">{formatBRL(acc.balance)}</div>
              <div className="card-label">{acc.type === "savings" ? "Poupança" : "Conta corrente"}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="cards-scroll">
          <div className="account-card card-total card-enter" style={{animationDelay:"0s"}}>
            <div className="card-icon">💰</div>
            <div className="card-bank-name">Total Geral</div>
            <div className="card-balance">{formatBRL(totalBalance)}</div>
            <div className="card-label">{accounts.length} conta{accounts.length>1?"s":""} ativa{accounts.length>1?"s":""}</div>
          </div>
          {accounts.map((acc, i) => (
            <div key={acc.id} className={`account-card ${getCardClass(acc.name)} card-enter`} style={{animationDelay:`${(i+1)*0.06}s`}}>
              <div className="card-icon">{getCardIcon(acc.name)}</div>
              <div className="card-bank-name">{acc.name}</div>
              <div className="card-balance">{formatBRL(acc.balance)}</div>
              <div className="card-label">{acc.type === "savings" ? "Poupança" : "Conta corrente"}</div>
            </div>
          ))}
        </div>
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

      {/* Bills to pay */}
      {bills.filter(b=>!!b.data_vencimento).length > 0 && (
        <div style={{marginTop:4}}>
          <div className="section-header">
            <span className="section-title">Contas a Pagar</span>
            <span className="section-link">{bills.filter(b=>!!b.data_vencimento && (b.status??"").toLowerCase()!=="pago").length} pendente{bills.filter(b=>!!b.data_vencimento && (b.status??"").toLowerCase()!=="pago").length!==1?"s":""}</span>
          </div>
          {bills.filter(b=>!!b.data_vencimento).slice(0,5).map(b=>{
            const paid    = (b.status ?? "").toLowerCase() === "pago";
            const name    = b.nome ?? "Conta";
            const dueDate = b.data_vencimento ?? "";
            return (
              <div key={b.id} className="bill-item">
                <div>
                  <div className="bill-name" style={{color:paid?"#6E6E73":"#1D1D1F"}}>{name}</div>
                  <div className="bill-date">{dueDate ? formatDatePT(dueDate) : ""}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div className={paid?"bill-paid":"bill-amount"} style={{fontSize:12,fontWeight:600}}>
                    {paid?"✓ Pago":`📅 ${b.status ?? "Pendente"}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transactions */}
      <div style={{marginTop:bills.filter(b=>!!b.data_vencimento).length>0?20:4}}>
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
                const { icon, bg } = getCategoryStyle(`${tx.category} ${tx.name}`);
                return (
                  <div key={tx.id} className="tx-item tx-enter" style={{animationDelay:`${i*0.04}s`}} onClick={()=>onEditTx(tx)}>
                    <div className="tx-icon" style={{background:bg}}>{icon}</div>
                    <div className="tx-info">
                      <div className="tx-name">{tx.name}</div>
                      <div className="tx-category" style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                        <span className={`badge ${tx.type==="income"?"badge-income":"badge-expense"}`}>{tx.category}</span>
                        {tx.meio_pagamento && (()=>{const pm=getPaymentStyle(tx.meio_pagamento);return pm.label?<span className={`badge ${pm.badgeClass}`}>{pm.label}</span>:null;})()}
                        {tx.tipo_escopo && (()=>{
                          const cls = tx.tipo_escopo==="Despesa Familiar"?"badge-escopo-familiar":tx.tipo_escopo==="Lazer Familiar"?"badge-escopo-lazer":tx.tipo_escopo==="Gasto Pessoal"?"badge-escopo-pessoal":tx.tipo_escopo==="Giro de Revenda"?"badge-escopo-revenda":"badge-escopo-familiar";
                          return <span className={`badge ${cls}`}>{tx.tipo_escopo}</span>;
                        })()}
                      </div>
                    </div>
                    <div className="tx-right">
                      <div className={`tx-value ${tx.type==="income"?"income":"expense"}`}>
                        {tx.type==="income"?"+":"−"}{formatBRL(tx.value)}
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

interface TxForm { name:string; value:string; category:string; date:string; accountId:string; tipo:"receita"|"despesa"; beneficiario_real:string; meio_pagamento:string; tipo_escopo:string; }
const EMPTY_FORM: TxForm = { name:"", value:"", category:"", date:"", accountId:"", tipo:"despesa", beneficiario_real:"", meio_pagamento:"Pix", tipo_escopo:"Despesa Familiar" };

const ESCOPO_OPTIONS = ["Despesa Familiar", "Lazer Familiar", "Gasto Pessoal", "Giro de Revenda"] as const;

const PAYMENT_METHODS: { label:string; dbValue:string; color:string; badgeClass:string }[] = [
  { label:"Pix",      dbValue:"pix",      color:"#00C7BE", badgeClass:"badge-pix"      },
  { label:"Débito",   dbValue:"debito",   color:"#007AFF", badgeClass:"badge-debito"   },
  { label:"Crédito",  dbValue:"credito",  color:"#5856D6", badgeClass:"badge-credito"  },
  { label:"Dinheiro", dbValue:"dinheiro", color:"#34C759", badgeClass:"badge-dinheiro" },
  { label:"TED/DOC",  dbValue:"ted_doc",  color:"#FF9500", badgeClass:"badge-teddoc"   },
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

  const cards = bills.filter(b => b.recorrente && (b.categoria ?? "").toLowerCase() === "cartão de crédito");

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
    if (noAccounts) { setErr("Nenhuma conta disponível."); return; }
    setSaving(true); setErr(null);

    const valorTotal = parseFloat(form.value);
    const pessoas    = parseInt(numPessoas) || 1;
    const minhaParte = form.tipo === "despesa" && pessoas > 1 ? valorTotal / pessoas : null;

    const isCredito = form.meio_pagamento === "Crédito";
    const payload: Record<string,unknown> = {
      user_id:        userId,
      descricao,
      categoria:      buildCategoria(),
      valor:          valorTotal,
      tipo:           form.tipo,
      data_transacao: form.date,
      account_id:     form.accountId || accounts[0]?.id || null,
      meio_pagamento: PAYMENT_METHODS.find(p=>p.label===form.meio_pagamento)?.dbValue ?? "pix",
      tipo_escopo:    form.tipo_escopo || (form.tipo==="receita"?"Despesa Familiar":"Despesa Familiar"),
      ...(form.beneficiario_real ? { beneficiario_real: form.beneficiario_real } : {}),
      ...(paraQuem ? { beneficiario_real: paraQuem } : {}),
      ...(minhaParte !== null ? { observacao: `Dividido entre ${pessoas} pessoas. Sua parte: R$${minhaParte.toFixed(2)}` } : {}),
      ...(isCredito && cartaoId ? { cartao_id: cartaoId, parcela_total: Math.max(1, parseInt(parcelas,10) || 1) } : {}),
    };

    const { error } = await supabase.from("transactions").insert(payload);
    setSaving(false);
    if (error) {
      setErr(error.code==="42501" ? "Sem permissão. Verifique as políticas RLS." : `Erro: ${error.message}`);
      return;
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

        {/* Tipo Despesa/Receita */}
        <div className="form-field">
          <label className="form-label">Tipo</label>
          <div className="type-toggle">
            <button className={`type-btn${form.tipo==="despesa"?" expense":""}`} onClick={()=>setForm(f=>({...f,tipo:"despesa"}))}>⬇ Despesa</button>
            <button className={`type-btn${form.tipo==="receita"?" income":""}`}  onClick={()=>setForm(f=>({...f,tipo:"receita"}))}>⬆ Receita</button>
          </div>
        </div>

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
                Nenhum cartão cadastrado ainda. Cadastre em <strong>Fixas</strong> (categoria "Cartão de Crédito") para vincular a fatura automaticamente.
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
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : "Salvar Transação"}
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

  async function handleSave() {
    if (!descricao.trim() || !valor || !data) {
      setErr("Preencha todos os campos obrigatórios."); return;
    }
    setSaving(true); setErr(null);
    const { error } = await supabase.from("transactions").update({
      descricao:      descricao.trim(),
      valor:          parseFloat(valor),
      data_transacao: data,
      categoria,
      tipo,
      account_id:     accountId || null,
      meio_pagamento: PAYMENT_METHODS.find(p=>p.label===meioPag)?.dbValue ?? "pix",
    }).eq("id", tx.id);
    setSaving(false);
    if (error) { setErr(`Erro ao salvar: ${error.message}`); return; }
    onSaved(); onClose();
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    const { error } = await supabase.from("transactions").delete().eq("id", tx.id);
    setDeleting(false);
    if (error) { setErr(`Erro ao excluir: ${error.message}`); return; }
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

        {/* Salvar */}
        <button className="btn-primary" onClick={handleSave} disabled={saving||deleting}>
          {saving ? "Salvando…" : "💾 Salvar Alterações"}
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

const CATEGORIAS_FIXAS = ["Moradia","Utilidades","Assinaturas","Cartão de Crédito","Dívidas","Transporte","Saúde","Educação","Outros"];

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
function monthKeyLabel(key: string): string {
  const [y,m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m-1]} ${y}`;
}
// Soma o valor de todas as transações de cartão que caem numa fatura específica (respeitando parcelamento)
function invoiceTotalFor(cardId: string, targetMonthKey: string, transactions: NormTx[], diaFechamento: number): { total: number; count: number } {
  let total = 0, count = 0;
  for (const t of transactions) {
    if (t.cartao_id !== cardId || t.type !== "expense") continue;
    const first = invoiceMonthKey(t.date, diaFechamento);
    const n = t.parcela_total ?? 1;
    for (let i = 0; i < n; i++) {
      if (addMonthsToKey(first, i) === targetMonthKey) { total += t.value / n; count += 1; break; }
    }
  }
  return { total, count };
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}
function dueDateForMonthKey(monthKey: string, dia: number): string {
  const [y,m] = monthKey.split("-").map(Number);
  const clamped = Math.min(dia, daysInMonth(y, m-1));
  return `${monthKey}-${String(clamped).padStart(2,"0")}`;
}

function ContasFixasPage({ userId, transactions }: { userId: string; transactions: NormTx[] }) {
  const [all, setAll] = useState<BillToPay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BillToPay | null>(null);
  const [historyFor, setHistoryFor] = useState<BillToPay | null>(null);
  const [form, setForm] = useState({ nome:"", valor_base:"", dia_vencimento:"5", primeira_data:"", categoria:CATEGORIAS_FIXAS[0], dia_fechamento:"", limite:"", parcelas_totais:"" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:"success"|"error"}|null>(null);
  const [payingBill, setPayingBill] = useState<BillToPay | null>(null);
  const [payForm, setPayForm] = useState({ data_pagamento:"", motivo_atraso:"", juros:"" });
  const formSheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showForm && formSheetRef.current) {
      formSheetRef.current.scrollTop = 0;
    }
  }, [showForm]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("bills_to_pay").select("*").order("nome", { ascending: true });
    if (!error) setAll((data ?? []) as BillToPay[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(()=>setToast(null), toast.type==="error"?8000:3000); return () => clearTimeout(t); } }, [toast]);

  const templates = all.filter(b => b.recorrente);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  const instanceForTemplateThisMonth = (tplId: string) =>
    all.find(b => b.template_id === tplId && (b.data_vencimento ?? "").startsWith(monthKey));

  const historyForTemplate = (tplId: string) =>
    all.filter(b => b.template_id === tplId).sort((a,b)=>(b.data_vencimento??"").localeCompare(a.data_vencimento??""));

  const isPlanCompleted = (tpl: BillToPay) =>
    !!tpl.parcelas_totais && historyForTemplate(tpl.id).length >= tpl.parcelas_totais;

  const todayIso = now.toISOString().slice(0,10);
  const isOverdue = (b: BillToPay) =>
    !!b.data_vencimento && b.data_vencimento < todayIso && (b.status ?? "").toLowerCase() !== "pago";
  const overdueBills = all.filter(b => !!b.data_vencimento && isOverdue(b));

  const isCardForm = form.categoria === "Cartão de Crédito";

  async function saveTemplate() {
    if (!form.nome.trim()) { setToast({msg:"Preencha o nome",type:"error"}); return; }
    if (!isCardForm && !form.valor_base) { setToast({msg:"Preencha o valor",type:"error"}); return; }
    if (!isCardForm && !form.primeira_data) { setToast({msg:"Preencha a primeira data de vencimento",type:"error"}); return; }
    if (isCardForm && !form.dia_fechamento) { setToast({msg:"Preencha o dia de fechamento da fatura",type:"error"}); return; }
    setSaving(true);
    const diaVencimentoCalculado = !isCardForm && form.primeira_data
      ? new Date(form.primeira_data + "T00:00:00").getDate()
      : parseInt(form.dia_vencimento,10);
    const payload: Record<string, unknown> = {
      nome: form.nome.trim(),
      valor_base: form.valor_base ? parseFloat(form.valor_base.replace(",",".")) : 0,
      dia_vencimento: diaVencimentoCalculado,
      categoria: form.categoria,
      recorrente: true,
      user_id: userId,
      status: "pendente",
      ...(isCardForm ? {
        dia_fechamento: parseInt(form.dia_fechamento,10),
        limite: form.limite ? parseFloat(form.limite.replace(",",".")) : null,
      } : {
        parcelas_totais: form.parcelas_totais ? parseInt(form.parcelas_totais,10) : null,
      }),
    };
    if (editing) {
      const { error } = await supabase.from("bills_to_pay").update(payload).eq("id", editing.id);
      if (error) { setToast({msg:`Erro ao salvar: ${error.message}`,type:"error"}); console.error(error); }
      else setToast({msg:"Conta fixa atualizada",type:"success"});
    } else {
      const { data: created, error } = await supabase.from("bills_to_pay").insert(payload).select().single();
      if (error) { setToast({msg:`Erro ao criar: ${error.message}`,type:"error"}); console.error(error); }
      else {
        if (!isCardForm && created && form.primeira_data) {
          const { error: instErr } = await supabase.from("bills_to_pay").insert({
            nome: form.nome.trim(),
            valor_base: form.valor_base ? parseFloat(form.valor_base.replace(",",".")) : 0,
            categoria: form.categoria,
            data_vencimento: form.primeira_data,
            status: "pendente",
            recorrente: false,
            template_id: created.id,
            user_id: userId,
          });
          if (instErr) console.error(instErr);
        }
        setToast({msg:"Conta fixa criada",type:"success"});
      }
    }
    setSaving(false);
    setShowForm(false);
    setEditing(null);
    setForm({ nome:"", valor_base:"", dia_vencimento:"5", primeira_data:"", categoria:CATEGORIAS_FIXAS[0], dia_fechamento:"", limite:"", parcelas_totais:"" });
    load();
  }

  async function generateThisMonth(tpl: BillToPay) {
    if (instanceForTemplateThisMonth(tpl.id)) { setToast({msg:"Já gerada este mês",type:"error"}); return; }
    if (isPlanCompleted(tpl)) { setToast({msg:"Parcelamento já concluído",type:"error"}); return; }
    const data_vencimento = dueDateForMonthKey(monthKey, tpl.dia_vencimento ?? 5);
    const { error } = await supabase.from("bills_to_pay").insert({
      nome: tpl.nome, valor_base: tpl.valor_base, categoria: tpl.categoria,
      data_vencimento, status: "pendente", recorrente: false, template_id: tpl.id, user_id: userId,
    });
    if (error) setToast({msg:"Erro ao gerar",type:"error"});
    else setToast({msg:"Despesa do mês gerada",type:"success"});
    load();
  }

  async function generateAllPending() {
    const pending = templates.filter(t => !t.dia_fechamento && !isPlanCompleted(t) && !instanceForTemplateThisMonth(t.id));
    if (pending.length === 0) { setToast({msg:"Tudo já gerado este mês",type:"success"}); return; }
    for (const tpl of pending) await generateThisMonth(tpl);
  }

  // Gera automaticamente as cobranças do mês assim que a página carrega, sem precisar clicar
  const autoGenRan = useRef(false);
  useEffect(() => {
    if (loading || autoGenRan.current || all.length === 0) return;
    const pending = templates.filter(t => !isPlanCompleted(t) && !instanceForTemplateThisMonth(t.id));
    if (pending.length > 0) {
      autoGenRan.current = true;
      (async () => {
        for (const tpl of pending) {
          if (tpl.dia_fechamento) await syncCardInvoice(tpl, monthKey);
          else await generateThisMonth(tpl);
        }
      })();
    }
  }, [loading, all]); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateInstanceValue(instance: BillToPay, newValue: number) {
    const { error } = await supabase.from("bills_to_pay").update({ valor_base: newValue }).eq("id", instance.id);
    if (error) setToast({msg:"Erro ao atualizar valor",type:"error"});
    else setToast({msg:"Valor atualizado",type:"success"});
    load();
  }

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

  async function syncCardInvoice(tpl: BillToPay, targetMonthKey: string) {
    const { total } = invoiceTotalFor(tpl.id, targetMonthKey, transactions, tpl.dia_fechamento ?? 1);
    const data_vencimento = dueDateForMonthKey(targetMonthKey, tpl.dia_vencimento ?? 10);
    const existing = all.find(b => b.template_id === tpl.id && (b.data_vencimento ?? "").startsWith(targetMonthKey));
    if (existing) {
      await supabase.from("bills_to_pay").update({ valor_base: total }).eq("id", existing.id);
    } else {
      await supabase.from("bills_to_pay").insert({
        nome: tpl.nome, categoria: tpl.categoria, valor_base: total,
        data_vencimento, status: "pendente", recorrente: false, template_id: tpl.id, user_id: userId,
      });
    }
    setToast({msg:"Fatura sincronizada",type:"success"});
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
        <span className="section-link" onClick={()=>{setEditing(null);setForm({nome:"",valor_base:"",dia_vencimento:"5",primeira_data:"",categoria:CATEGORIAS_FIXAS[0],dia_fechamento:"",limite:"",parcelas_totais:""});setShowForm(true);}}>+ Nova conta fixa</span>
      </div>

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

      {loading ? (
        <div style={{textAlign:"center",padding:40,color:"#86868B"}}>Carregando…</div>
      ) : templates.length === 0 ? (
        <div style={{textAlign:"center",padding:"40px 20px",color:"#86868B"}}>
          <div style={{fontSize:40,marginBottom:10}}>📌</div>
          <div style={{fontSize:14}}>Nenhuma conta fixa cadastrada ainda.<br/>Cadastre aluguel, internet, assinaturas etc. e gere a cobrança de cada mês automaticamente.</div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {templates.map(tpl => {
            const isCard = !!tpl.dia_fechamento;
            const instance = instanceForTemplateThisMonth(tpl.id);
            const paid = (instance?.status ?? "").toLowerCase() === "pago";

            if (isCard) {
              const currentInvoice = invoiceTotalFor(tpl.id, monthKey, transactions, tpl.dia_fechamento!);
              const nextKey = addMonthsToKey(monthKey, 1);
              const nextInvoice = invoiceTotalFor(tpl.id, nextKey, transactions, tpl.dia_fechamento!);
              const usoLimite = tpl.limite ? (currentInvoice.total / tpl.limite) * 100 : null;
              const daysToClose = (() => {
                const today = new Date();
                let close = new Date(today.getFullYear(), today.getMonth(), tpl.dia_fechamento!);
                if (close < today) close = new Date(today.getFullYear(), today.getMonth()+1, tpl.dia_fechamento!);
                return Math.ceil((close.getTime()-today.getTime())/86400000);
              })();
              return (
                <div key={tpl.id} style={{background:"#F5F5F7",borderRadius:16,padding:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontSize:15,fontWeight:600,color:"#1D1D1F"}}>💳 {tpl.nome}</div>
                      <div style={{fontSize:12,color:"#86868B",marginTop:2}}>Fecha dia {tpl.dia_fechamento} · vence dia {tpl.dia_vencimento} · fecha em {daysToClose} dia{daysToClose!==1?"s":""}</div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                    <span onClick={()=>{setEditing(tpl);setForm({nome:tpl.nome??"",valor_base:String(tpl.valor_base??""),dia_vencimento:String(tpl.dia_vencimento??5),primeira_data:"",categoria:tpl.categoria??CATEGORIAS_FIXAS[0],dia_fechamento:String(tpl.dia_fechamento??""),limite:String(tpl.limite??""),parcelas_totais:""});setShowForm(true);}} style={{cursor:"pointer",fontSize:16}}>✏️</span>
                      <span onClick={()=>deleteTemplate(tpl)} style={{cursor:"pointer",fontSize:16}}>🗑️</span>
                    </div>
                  </div>

                  <div style={{marginTop:10,paddingTop:10,borderTop:"0.5px solid #E5E5E7"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontSize:12,color:"#86868B"}}>Fatura atual ({currentInvoice.count} compra{currentInvoice.count!==1?"s":""})</span>
                      <span style={{fontSize:15,fontWeight:700,color:"#FF3B30"}}>{formatBRL(currentInvoice.total)}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <span style={{fontSize:12,color:"#86868B"}}>Próxima fatura ({monthKeyLabel(nextKey)})</span>
                      <span style={{fontSize:13,fontWeight:600,color:"#86868B"}}>{formatBRL(nextInvoice.total)}</span>
                    </div>
                    {usoLimite !== null && (
                      <div style={{marginBottom:10}}>
                        <div style={{height:6,background:"#E5E5E7",borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${Math.min(100,usoLimite)}%`,background:usoLimite>90?"#FF3B30":usoLimite>70?"#FF9500":"#34C759"}} />
                        </div>
                        <div style={{fontSize:11,color:"#86868B",marginTop:4}}>{usoLimite.toFixed(0)}% do limite ({formatBRL(tpl.limite!)}) usado nesta fatura</div>
                      </div>
                    )}
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <button onClick={()=>syncCardInvoice(tpl, monthKey)} style={{flex:1,padding:"9px",background:"#007AFF",color:"#FFF",border:"none",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                        Sincronizar fatura
                      </button>
                      {instance && (
                        <span
                          onClick={()=>toggleStatus(instance)}
                          title={paid?"Marcar como pendente":"Marcar como paga"}
                          style={{width:32,height:32,borderRadius:8,border:paid?"none":"1.5px solid #C7C7CC",background:paid?"#34C759":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,color:"#FFF",flexShrink:0}}
                        >{paid?"✓":""}</span>
                      )}
                      <span onClick={()=>setHistoryFor(tpl)} style={{fontSize:12,color:"#007AFF",cursor:"pointer",whiteSpace:"nowrap"}}>Histórico</span>
                    </div>
                  </div>
                </div>
              );
            }

            const geradas = historyForTemplate(tpl.id).length;
            const completed = isPlanCompleted(tpl);
            return (
              <div key={tpl.id} style={{background:"#F5F5F7",borderRadius:16,padding:14,opacity:completed?0.65:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:"#1D1D1F"}}>{tpl.nome}</div>
                    <div style={{fontSize:12,color:"#86868B",marginTop:2}}>
                      {tpl.categoria} · vence dia {tpl.dia_vencimento} · ref. {formatBRL(tpl.valor_base ?? 0)}
                      {tpl.parcelas_totais ? ` · ${geradas}/${tpl.parcelas_totais} parcelas` : " · corrente"}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <span onClick={()=>{setEditing(tpl);const d=new Date();const day=Math.min(tpl.dia_vencimento??5,daysInMonth(d.getFullYear(),d.getMonth()));const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;setForm({nome:tpl.nome??"",valor_base:String(tpl.valor_base??""),dia_vencimento:String(tpl.dia_vencimento??5),primeira_data:iso,categoria:tpl.categoria??CATEGORIAS_FIXAS[0],dia_fechamento:"",limite:"",parcelas_totais:String(tpl.parcelas_totais??"")});setShowForm(true);}} style={{cursor:"pointer",fontSize:16}}>✏️</span>
                    <span onClick={()=>deleteTemplate(tpl)} style={{cursor:"pointer",fontSize:16}}>🗑️</span>
                  </div>
                </div>

                <div style={{marginTop:10,paddingTop:10,borderTop:"0.5px solid #E5E5E7"}}>
                  {completed && (!instance || paid) ? (
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:13,color:"#34C759",fontWeight:600}}>✓ Parcelamento concluído</span>
                      <span onClick={()=>setHistoryFor(tpl)} style={{fontSize:12,color:"#007AFF",cursor:"pointer"}}>Histórico</span>
                    </div>
                  ) : !instance ? (
                    <div style={{fontSize:13,color:"#86868B",padding:"6px 0"}}>Aguardando geração automática deste mês…</div>
                  ) : (
                    <div>
                      {completed && (
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
                        <span onClick={()=>setHistoryFor(tpl)} style={{fontSize:12,color:"#007AFF",cursor:"pointer"}}>Histórico</span>
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
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setShowForm(false)}>
          <div ref={formSheetRef} onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>{editing?"Editar":"Nova"} {isCardForm ? "cartão de crédito" : "conta fixa"}</div>
            <input placeholder={isCardForm ? "Nome do cartão (ex: Nubank)" : "Nome (ex: Aluguel, Internet)"} value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <select value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}
                style={{flex:1,padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,fontFamily:"inherit",background:"#FFF"}}>
                {CATEGORIAS_FIXAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {!isCardForm && (
              <input placeholder="Valor de referência (R$)" value={form.valor_base} onChange={e=>setForm(f=>({...f,valor_base:e.target.value}))}
                style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />
            )}

            {isCardForm ? (
              <>
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
                <input placeholder="Limite do cartão (opcional, R$)" value={form.limite} onChange={e=>setForm(f=>({...f,limite:e.target.value}))}
                  style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />
                <div style={{fontSize:12,color:"#86868B",marginBottom:10,lineHeight:1.5}}>
                  O valor da fatura será calculado automaticamente a partir das compras lançadas nesse cartão — você não precisa digitar manualmente.
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
              </>
            )}

            <button disabled={saving} onClick={saveTemplate} style={{width:"100%",padding:14,background:"#007AFF",color:"#FFF",border:"none",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.6:1}}>
              {saving?"Salvando…":"Salvar"}
            </button>
            <button onClick={()=>setShowForm(false)} style={{width:"100%",padding:12,background:"transparent",color:"#86868B",border:"none",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
          </div>
        </div>,
        document.body
      )}

      {/* Payment modal */}
      {payingBill && createPortal(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setPayingBill(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"85vh",overflowY:"auto"}}>
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
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setHistoryFor(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"70vh",overflowY:"auto"}}>
            <div style={{fontSize:17,fontWeight:600,marginBottom:14}}>Histórico — {historyFor.nome}</div>
            {historyForTemplate(historyFor.id).length === 0 ? (
              <div style={{fontSize:13,color:"#86868B"}}>Nenhuma cobrança gerada ainda.</div>
            ) : (
              historyForTemplate(historyFor.id).map(h => (
                <div key={h.id} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"0.5px solid #E5E5E7"}}>
                  <span style={{fontSize:13,color:"#1D1D1F"}}>{h.data_vencimento ? new Date(h.data_vencimento+"T00:00:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"}) : "—"}</span>
                  <span style={{fontSize:13,fontWeight:600,color:(h.status??"").toLowerCase()==="pago"?"#34C759":"#FF9500"}}>{formatBRL(h.valor_base??0)} · {(h.status??"pendente")}</span>
                </div>
              ))
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

// ─── Investimentos page ───────────────────────────────────────────────────────

const TIPOS_INVESTIMENTO = ["Renda Fixa","Tesouro Direto","Fundos","Ações","Cripto","Poupança","Outros"];

function InvestimentosPage({ userId }: { userId: string }) {
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [lancamentos, setLancamentos] = useState<InvestimentoLancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Investimento | null>(null);
  const [form, setForm] = useState({ nome:"", tipo:TIPOS_INVESTIMENTO[0], valor_inicial:"", instituicao:"" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:"success"|"error"}|null>(null);
  const [detailFor, setDetailFor] = useState<Investimento | null>(null);
  const [lancForm, setLancForm] = useState({ mes:new Date().toISOString().slice(0,7), valor_ganho:"", observacao:"" });
  const [savingLanc, setSavingLanc] = useState(false);
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

  const lancamentosFor = (invId: string) => lancamentos.filter(l => l.investimento_id === invId);
  const totalGanhoFor = (invId: string) => lancamentosFor(invId).reduce((s,l)=>s+(l.valor_ganho??0),0);
  const totalInvestido = investimentos.reduce((s,i)=>s+(i.valor_inicial??0),0);
  const totalGanho = investimentos.reduce((s,i)=>s+totalGanhoFor(i.id),0);

  async function saveInvestimento() {
    if (!form.nome.trim()) { setToast({msg:"Preencha o nome",type:"error"}); return; }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(), tipo: form.tipo,
      valor_inicial: form.valor_inicial ? parseFloat(form.valor_inicial.replace(",",".")) : 0,
      instituicao: form.instituicao.trim() || null,
      user_id: userId,
    };
    const { error } = editing
      ? await supabase.from("investimentos").update(payload).eq("id", editing.id)
      : await supabase.from("investimentos").insert(payload);
    setSaving(false);
    if (error) { setToast({msg:`Erro: ${error.message}`,type:"error"}); return; }
    setToast({msg: editing ? "Investimento atualizado" : "Investimento criado", type:"success"});
    setShowForm(false); setEditing(null);
    setForm({ nome:"", tipo:TIPOS_INVESTIMENTO[0], valor_inicial:"", instituicao:"" });
    load();
  }

  async function deleteInvestimento(inv: Investimento) {
    if (!confirm(`Remover "${inv.nome}" e todo o histórico de rendimentos?`)) return;
    await supabase.from("investimento_lancamentos").delete().eq("investimento_id", inv.id);
    await supabase.from("investimentos").delete().eq("id", inv.id);
    load();
  }

  async function saveLancamento() {
    if (!detailFor || !lancForm.valor_ganho) { setToast({msg:"Preencha o valor ganho",type:"error"}); return; }
    setSavingLanc(true);
    const existing = lancamentosFor(detailFor.id).find(l => l.mes === lancForm.mes);
    const payload = {
      investimento_id: detailFor.id, mes: lancForm.mes,
      valor_ganho: parseFloat(lancForm.valor_ganho.replace(",",".")),
      observacao: lancForm.observacao.trim() || null,
    };
    const { error } = existing
      ? await supabase.from("investimento_lancamentos").update(payload).eq("id", existing.id)
      : await supabase.from("investimento_lancamentos").insert(payload);
    setSavingLanc(false);
    if (error) { setToast({msg:`Erro: ${error.message}`,type:"error"}); return; }
    setToast({msg:"Rendimento registrado",type:"success"});
    setLancForm({ mes:new Date().toISOString().slice(0,7), valor_ganho:"", observacao:"" });
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
        <span className="section-link" onClick={()=>{setEditing(null);setForm({nome:"",tipo:TIPOS_INVESTIMENTO[0],valor_inicial:"",instituicao:""});setShowForm(true);}}>+ Novo</span>
      </div>

      {investimentos.length > 0 && (
        <div style={{background:"#F5F5F7",borderRadius:16,padding:16,marginBottom:16,display:"flex",justifyContent:"space-around",textAlign:"center"}}>
          <div>
            <div style={{fontSize:12,color:"#86868B",marginBottom:4}}>Total investido</div>
            <div style={{fontSize:16,fontWeight:700,color:"#1D1D1F"}}>{formatBRL(totalInvestido)}</div>
          </div>
          <div>
            <div style={{fontSize:12,color:"#86868B",marginBottom:4}}>Rendimento acumulado</div>
            <div style={{fontSize:16,fontWeight:700,color:"#34C759"}}>{formatBRL(totalGanho)}</div>
          </div>
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
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {investimentos.map(inv => {
            const ganho = totalGanhoFor(inv.id);
            const rentabilidade = inv.valor_inicial ? (ganho / inv.valor_inicial) * 100 : 0;
            return (
              <div key={inv.id} onClick={()=>setDetailFor(inv)} style={{background:"#F5F5F7",borderRadius:16,padding:14,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:"#1D1D1F"}}>{inv.nome}</div>
                    <div style={{fontSize:12,color:"#86868B",marginTop:2}}>{inv.tipo}{inv.instituicao?` · ${inv.instituicao}`:""} · aplicado {formatBRL(inv.valor_inicial??0)}</div>
                  </div>
                  <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                    <span onClick={()=>{setEditing(inv);setForm({nome:inv.nome,tipo:inv.tipo??TIPOS_INVESTIMENTO[0],valor_inicial:String(inv.valor_inicial??""),instituicao:inv.instituicao??""});setShowForm(true);}} style={{cursor:"pointer",fontSize:16}}>✏️</span>
                    <span onClick={()=>deleteInvestimento(inv)} style={{cursor:"pointer",fontSize:16}}>🗑️</span>
                  </div>
                </div>
                <div style={{marginTop:10,paddingTop:10,borderTop:"0.5px solid #E5E5E7",display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,color:"#86868B"}}>Rendimento total</span>
                  <span style={{fontSize:14,fontWeight:700,color:ganho>=0?"#34C759":"#FF3B30"}}>{formatBRL(ganho)} ({rentabilidade.toFixed(1)}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form: novo/editar investimento */}
      {showForm && createPortal(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setShowForm(false)}>
          <div ref={formSheetRef} onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontSize:17,fontWeight:600,marginBottom:16}}>{editing?"Editar":"Novo"} investimento</div>
            <input placeholder="Nome (ex: CDB Banco X, Tesouro IPCA+)" value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />
            <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit",background:"#FFF"}}>
              {TIPOS_INVESTIMENTO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Instituição (opcional)" value={form.instituicao} onChange={e=>setForm(f=>({...f,instituicao:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:10,fontFamily:"inherit"}} />
            <input placeholder="Valor investido inicialmente (R$)" value={form.valor_inicial} onChange={e=>setForm(f=>({...f,valor_inicial:e.target.value}))}
              style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E5EA",borderRadius:12,fontSize:15,marginBottom:16,fontFamily:"inherit"}} />
            <button disabled={saving} onClick={saveInvestimento} style={{width:"100%",padding:14,background:"#007AFF",color:"#FFF",border:"none",borderRadius:14,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",opacity:saving?0.6:1}}>
              {saving?"Salvando…":"Salvar"}
            </button>
            <button onClick={()=>setShowForm(false)} style={{width:"100%",padding:12,background:"transparent",color:"#86868B",border:"none",fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
          </div>
        </div>,
        document.body
      )}

      {/* Detail: lançamentos mensais */}
      {detailFor && createPortal(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,zIndex:200}} onClick={()=>setDetailFor(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#FFF",width:"100%",maxWidth:600,margin:"0 auto",borderRadius:20,padding:20,maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontSize:17,fontWeight:600,marginBottom:4}}>{detailFor.nome}</div>
            <div style={{fontSize:13,color:"#86868B",marginBottom:16}}>Rendimento acumulado: <strong style={{color:"#34C759"}}>{formatBRL(totalGanhoFor(detailFor.id))}</strong></div>

            <div style={{background:"#F5F5F7",borderRadius:14,padding:14,marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>Registrar rendimento do mês</div>
              <input type="month" value={lancForm.mes} onChange={e=>setLancForm(f=>({...f,mes:e.target.value}))}
                style={{width:"100%",padding:"10px 12px",border:"1.5px solid #E5E5EA",borderRadius:10,fontSize:14,marginBottom:8,fontFamily:"inherit"}} />
              <input placeholder="Valor ganho no mês (R$)" value={lancForm.valor_ganho} onChange={e=>setLancForm(f=>({...f,valor_ganho:e.target.value}))}
                style={{width:"100%",padding:"10px 12px",border:"1.5px solid #E5E5EA",borderRadius:10,fontSize:14,marginBottom:8,fontFamily:"inherit"}} />
              <input placeholder="Observação (opcional)" value={lancForm.observacao} onChange={e=>setLancForm(f=>({...f,observacao:e.target.value}))}
                style={{width:"100%",padding:"10px 12px",border:"1.5px solid #E5E5EA",borderRadius:10,fontSize:14,marginBottom:10,fontFamily:"inherit"}} />
              <button disabled={savingLanc} onClick={saveLancamento} style={{width:"100%",padding:11,background:"#34C759",color:"#FFF",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:savingLanc?0.6:1}}>
                {savingLanc?"Salvando…":"Salvar rendimento"}
              </button>
            </div>

            <div style={{fontSize:13,fontWeight:600,color:"#86868B",marginBottom:8}}>Histórico mensal</div>
            {lancamentosFor(detailFor.id).length === 0 ? (
              <div style={{fontSize:13,color:"#86868B",padding:"8px 0"}}>Nenhum rendimento registrado ainda.</div>
            ) : (
              [...lancamentosFor(detailFor.id)].reverse().map(l => (
                <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"0.5px solid #E5E5E7"}}>
                  <div>
                    <div style={{fontSize:13,color:"#1D1D1F"}}>{monthKeyLabel(l.mes)}</div>
                    {l.observacao && <div style={{fontSize:11,color:"#86868B",marginTop:2}}>{l.observacao}</div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:14,fontWeight:600,color:l.valor_ganho>=0?"#34C759":"#FF3B30"}}>{formatBRL(l.valor_ganho)}</span>
                    <span onClick={()=>deleteLancamento(l.id)} style={{cursor:"pointer",fontSize:14}}>🗑️</span>
                  </div>
                </div>
              ))
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

type NavPage = "home"|"relatorios"|"fixas"|"cartoes"|"ajustes";

export default function App() {
  // ── Auth state ──────────────────────────────────────────────────────────────
  const [user,        setUser]        = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
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

  const totalIncome  = transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.value,0);
  const totalExpense = transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.value,0);
  const saldo        = totalIncome - totalExpense;

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
    { icon:"⚙️", label:"Ajustes",   page:"ajustes" },
  ];

  return (
    <>
      <style>{STYLE}</style>
      <div className="app">

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
          <div className="summary-bar">
            <div className="summary-item">
              <div className="summary-label">Receitas</div>
              <div className="summary-value income">{loading?"…":formatBRL(totalIncome)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Despesas</div>
              <div className="summary-value expense">{loading?"…":formatBRL(totalExpense)}</div>
            </div>
            <div className="summary-item">
              <div className="summary-label">Saldo</div>
              <div className={`summary-value ${saldo>=0?"income":"expense"}`}>{loading?"…":formatBRL(saldo)}</div>
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
          />
        )}
        {navPage === "home" && view === "eu" && (
          <DespesasMesPage key="despesas-mes" bills={bills} accounts={accounts} />
        )}
        {navPage === "home" && view === "esposa" && (
          <InvestimentosPage key="investimentos" userId={user.id} />
        )}
        {navPage === "relatorios" && (
          <RelatoriosPage key="relatorios" transactions={transactions} bills={bills} loading={loading} />
        )}
        {navPage === "fixas" && (
          <ContasFixasPage key="fixas" userId={user.id} transactions={transactions} />
        )}
        {navPage === "cartoes" && (
          <div className="scroll-content page-fade" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:400,gap:12,textAlign:"center",padding:"0 24px"}}>
            <div style={{fontSize:52}}>🗂️</div>
            <div style={{fontSize:17,fontWeight:600}}>Meus Cartões</div>
            <div style={{fontSize:14,color:"#6E6E73"}}>
              Por enquanto, cadastre suas faturas de cartão em <strong>Fixas</strong>, escolhendo a categoria "Cartão de Crédito". Elas já aparecem separadas no relatório de despesas do mês seguinte.
            </div>
            <button onClick={()=>handleNav("fixas")} style={{marginTop:8,padding:"10px 20px",background:"#007AFF",color:"#FFF",border:"none",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Ir para Fixas
            </button>
          </div>
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
        <div className={`fab-overlay${fabOpen?" open":""}`} onClick={()=>setFabOpen(false)} />

        {/* FAB */}
        <div className="fab-container">
          <div className="fab-actions">
            {([
              { label:"Nova Conta",     icon:"🏦", bg:"#34C759", action:"conta"     as const },
              { label:"Upload Extrato", icon:"📄", bg:"#FF9500", action:"extrato"   as const },
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
          <div className="modal-overlay" onClick={()=>setModal(null)}>
            <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
              <div className="modal-handle" />
              <div className="modal-title">Upload de Extrato</div>
              <div style={{background:"#F5F5F7",borderRadius:16,padding:28,textAlign:"center",marginBottom:20,cursor:"pointer",border:"2px dashed #D1D1D6"}}>
                <div style={{fontSize:40,marginBottom:12}}>📄</div>
                <div style={{fontWeight:600,marginBottom:6}}>Arraste seu extrato aqui</div>
                <div style={{fontSize:13,color:"#6E6E73"}}>Suporta OFX, CSV e PDF</div>
                <div style={{marginTop:14,display:"inline-block",padding:"8px 20px",background:"#007AFF",color:"#FFF",borderRadius:20,fontSize:14,fontWeight:600}}>Escolher Arquivo</div>
              </div>
              <div className="form-field">
                <label className="form-label">Conta de Destino</label>
                <select className="form-input">
                  {accounts.length > 0
                    ? accounts.map(a=><option key={a.id}>{a.name}</option>)
                    : <option>Nubank</option>}
                </select>
              </div>
              <button className="btn-primary" onClick={()=>setModal(null)}>Importar Extrato</button>
            </div>
          </div>
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


