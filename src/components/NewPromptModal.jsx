import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { GROUPS, GROUP, groupOf, LONG_VAR, splitVars, varsOf, fillText, ago, stamp, newId, useMedia, copyText } from "../lib/prompt.js";
import { BodyEditor } from "./BodyEditor.jsx";

/* ---------- new prompt modal ---------- */
export function NewPromptModal({ defaultGroup, initial, onClose, onDiscard, onCreate }) {
  const [form, setForm] = useState(() => initial || { title: "", group: defaultGroup, body: "", tags: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const vars = varsOf(form.body);
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = e => { if (e.key === "Escape") { e.stopPropagation(); onClose(formRef.current); } };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  async function submit(e) {
    e && e.preventDefault();
    if (!form.title.trim()) { setError("title"); document.getElementById("m-name").focus(); return; }
    if (!form.body.trim()) { setError("body"); document.getElementById("m-body").focus(); return; }
    setSaving(true);
    try {
      await onCreate({
        title: form.title.trim(),
        group: form.group,
        body: form.body,
        tags: form.tags.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean),
        note: "",
      });
    } catch (err) {
      setSaving(false);
      setError(err && err.code === "quota_exceeded" ? "quota" : "save");
    }
  }

  function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(formRef.current); }}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="m-heading" onSubmit={submit} onKeyDown={onKey}>
        <div className="modal-head">
          <h2 id="m-heading">새 프롬프트</h2>
        </div>
        <div className="modal-body">
          <div className="grid2">
            <div className="field">
              <label htmlFor="m-name">제목</label>
              <input id="m-name" className={"input" + (error === "title" ? " invalid" : "")} autoFocus value={form.title}
                onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setError(""); }} placeholder="예: 1688 검색어 변환" />
            </div>
            <div className="field">
              <label htmlFor="m-group">카테고리</label>
              <select id="m-group" className="select" value={form.group} onChange={e => setForm(f => ({ ...f, group: e.target.value }))}>
                {GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="m-body">본문</label>
            <div className={error === "body" ? "invalid-wrap" : ""}>
              <BodyEditor id="m-body" compact value={form.body} onChange={body => { setForm(f => ({ ...f, body })); setError(""); }} />
            </div>
            {vars.length > 0 && <div className="chips">{vars.map(v => <span key={v} className="chip">{v}</span>)}</div>}
          </div>
          <div className="field">
            <label htmlFor="m-tags">태그</label>
            <input id="m-tags" className="input" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="쉼표로 구분 · 1688, 시즌상품" />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error === "title" ? "제목을 입력하세요." : error === "body" ? "본문을 입력하세요." : error === "quota" ? "저장 공간이 가득 찼어요. 안 쓰는 프롬프트를 삭제하세요." : "추가하지 못했어요. 다시 시도하세요."}
            </p>
          )}
        </div>
        <div className="modal-foot">
          <span className="hint hide-sm"><span className="mono">⌘↵</span> 추가</span>
          <div className="actions">
            <button type="button" className="btn" onClick={onDiscard}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "추가 중" : "추가"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

