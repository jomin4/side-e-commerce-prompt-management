import { useState, useEffect } from "react";

/* ---------- constants ---------- */
export const GROUPS = [
  { id: "sourcing", label: "상품 소싱" },
  { id: "listing", label: "상품 등록" },
  { id: "marketing", label: "마케팅" },
  { id: "cs", label: "고객 응대" },
  { id: "ops", label: "운영·분석" },
];
export const GROUP = Object.fromEntries(GROUPS.map(g => [g.id, g]));
export const groupOf = p => (GROUP[p.group] ? p.group : "sourcing");
export const VAR_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;
export const LONG_VAR = /텍스트|리뷰|결과|데이터|내용|스펙|요청|메모|목록/;

/* ---------- helpers ---------- */
export function splitVars(text) {
  const out = []; let last = 0; let m;
  VAR_RE.lastIndex = 0;
  while ((m = VAR_RE.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ v: m[1], raw: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
export function varsOf(text) {
  const seen = []; VAR_RE.lastIndex = 0; let m;
  while ((m = VAR_RE.exec(text || ""))) if (!seen.includes(m[1])) seen.push(m[1]);
  return seen;
}
export function fillText(text, values) {
  return (text || "").replace(VAR_RE, (raw, name) => {
    const v = values[name.trim()];
    return v && v.length ? v : raw;
  });
}
export function ago(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
export function stamp(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function newId() { return "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
export function useMedia(q) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q); const on = () => setM(mq.matches);
    mq.addEventListener("change", on); return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    } catch { return false; }
  }
}

