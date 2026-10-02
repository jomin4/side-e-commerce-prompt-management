import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { GROUPS, GROUP, groupOf, LONG_VAR, splitVars, varsOf, fillText, ago, stamp, newId, useMedia, copyText } from "../lib/prompt.js";
import { I } from "../icons.jsx";
import { BodyEditor } from "./BodyEditor.jsx";

/* ---------- detail ---------- */
export function Detail({ prompt, isNew, onSave, onCancelNew, onDelete, onDuplicate, onToggleFav, onCopied, onBack, onTagClick, onDirty, toast }) {
  const [tab, setTab] = useState(isNew ? "edit" : "use");
  const [values, setValues] = useState(() => ({ ...(prompt.lastValues || {}) }));
  const [form, setForm] = useState(() => toForm(prompt));
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openVer, setOpenVer] = useState(null);
  const [saving, setSaving] = useState(false);
  const menuRef = useRef(null);

  const vars = useMemo(() => varsOf(prompt.body), [prompt.body]);
  const filled = useMemo(() => fillText(prompt.body, values), [prompt.body, values]);
  const missing = vars.filter(v => !(values[v] || "").length).length;
  const versions = prompt.versions || [];
  const dirty = isNew || JSON.stringify(form) !== JSON.stringify(toForm(prompt));
  const editingDirty = tab === "edit" && dirty;

  useEffect(() => { onDirty && onDirty(editingDirty); }, [editingDirty]);
  useEffect(() => () => { onDirty && onDirty(false); }, []);

  useEffect(() => {
    if (!menu) return;
    const close = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  function toForm(p) {
    return { title: p.title || "", group: groupOf(p), tags: (p.tags || []).join(", "), body: p.body || "", note: p.note || "" };
  }

  async function save() {
    if (!form.body.trim()) { toast("본문을 입력하세요", "error"); return; }
    setSaving(true);
    try {
      await onSave({
        title: form.title.trim() || "제목 없음",
        group: form.group,
        tags: form.tags.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean),
        body: form.body,
        note: form.note.trim(),
      });
      setTab("use");
      toast(isNew ? "프롬프트를 추가했어요" : "저장했어요");
    } catch (e) {
      toast(e && e.code === "quota_exceeded" ? "저장 공간이 가득 찼어요. 안 쓰는 프롬프트를 삭제하세요" : "저장하지 못했어요. 다시 시도하세요", "error");
    } finally { setSaving(false); }
  }

  function startEdit() { setForm(toForm(prompt)); setTab("edit"); }
  function cancelEdit() { if (isNew) onCancelNew(); else { setForm(toForm(prompt)); setTab("use"); } }

  function onEditorKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); }
    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
  }

  async function doCopy() {
    const ok = await copyText(filled);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1600); onCopied(values); }
    else toast("복사하지 못했어요. 미리보기에서 직접 선택해 복사하세요", "error");
  }

  return (
    <div className="pane">
      <div className="detail-head">
        <div className="detail-top">
          <button className="btn btn-ghost btn-icon back" onClick={onBack} aria-label="목록으로">{I.back}</button>
          <h2 className="detail-title">{isNew ? (form.title || "새 프롬프트") : prompt.title}</h2>
          {!isNew && (
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-ghost btn-icon star-btn" aria-pressed={!!prompt.favorite} aria-label="즐겨찾기" onClick={onToggleFav}>{I.star}</button>
              <div className="menu-wrap" ref={menuRef}>
                <button className="btn btn-ghost btn-icon" aria-label="더보기" aria-expanded={menu} onClick={() => setMenu(m => !m)}>{I.more}</button>
                {menu && (
                  <div className="menu" role="menu">
                    <button role="menuitem" onClick={() => { setMenu(false); onDuplicate(); }}>{I.dup}복제</button>
                    <button role="menuitem" className="danger" onClick={() => { setMenu(false); setConfirm(true); }}>{I.trash}삭제</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {!isNew && (
          <div className="detail-meta">
            <span className="badge">{GROUP[groupOf(prompt)].label}</span>
            <span>변수 {vars.length}</span><span className="dot"/>
            <span>사용 {prompt.uses || 0}회</span><span className="dot"/>
            <span>{ago(prompt.updatedAt)} 수정</span>
          </div>
        )}
        {!isNew && prompt.tags && prompt.tags.length > 0 && (
          <div className="tags">{prompt.tags.map(t => <button key={t} type="button" className="tag" onClick={() => onTagClick(t)}>{t}</button>)}</div>
        )}
        {confirm && (
          <div className="confirm">
            <span>이 프롬프트와 수정 기록을 삭제할까요?</span>
            <div className="actions">
              <button className="btn btn-sm" onClick={() => setConfirm(false)}>취소</button>
              <button className="btn btn-sm btn-danger" onClick={onDelete}>삭제</button>
            </div>
          </div>
        )}
      </div>

      {!isNew && (
        <div className="dtabs" role="tablist">
          <button role="tab" className="tab" aria-selected={tab === "use"} onClick={() => setTab("use")}>사용</button>
          <button role="tab" className="tab" aria-selected={tab === "edit"} onClick={startEdit}>편집</button>
          <button role="tab" className="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>기록 <span className="n">{versions.length}</span></button>
        </div>
      )}

      {tab === "use" && !isNew && (
        <div className="detail-body">
          {vars.length > 0 && (
            <div>
              <div className="section-label">
                <span>변수</span>
                {Object.values(values).some(Boolean) && <button className="btn btn-ghost btn-sm" onClick={() => setValues({})}>비우기</button>}
              </div>
              <div className="vars">
                {vars.map(v => {
                  const long = LONG_VAR.test(v) || (values[v] || "").includes("\n");
                  const id = "v-" + prompt.id + "-" + v;
                  return (
                    <div key={v} className={"field" + (long ? " wide" : "")}>
                      <label htmlFor={id}>{v}</label>
                      {long
                        ? <textarea id={id} className="textarea" value={values[v] || ""} onChange={e => setValues(s => ({ ...s, [v]: e.target.value }))} />
                        : <input id={id} className="input" value={values[v] || ""} onChange={e => setValues(s => ({ ...s, [v]: e.target.value }))} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <div className="section-label">
              <span>미리보기 <span className="mono" style={{ color: "var(--fg-faint)", marginLeft: 6 }}>{filled.length.toLocaleString()}자</span></span>
              <span className="actions">
                {missing > 0 && <span className="hint warn">빈 변수 {missing}개</span>}
                <button className="btn btn-primary btn-sm" onClick={doCopy}>{copied ? I.check : I.copy}{copied ? "복사됨" : "복사"}</button>
              </span>
            </div>
            <div className="preview" id="preview">
              {splitVars(prompt.body || "").map((p, i) => {
                if (!p.v) return <React.Fragment key={i}>{p.text}</React.Fragment>;
                const val = values[p.v];
                return val ? <mark key={i} className="fill">{val}</mark> : <span key={i} className="hole">{p.v}</span>;
              })}
            </div>
          </div>
          {prompt.note && (
            <div>
              <div className="section-label"><span>메모</span></div>
              <div className="hint" style={{ whiteSpace: "pre-wrap", color: "var(--fg)" }}>{prompt.note}</div>
            </div>
          )}
        </div>
      )}

      {tab === "edit" && (
        <div className="detail-body">
          <div className="grid2">
            <div className="field">
              <label htmlFor="f-title">제목</label>
              <input id="f-title" className="input" value={form.title} autoFocus={isNew} onKeyDown={onEditorKey}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="예: 1688 검색어 변환" />
            </div>
            <div className="field">
              <label htmlFor="f-cat">카테고리</label>
              <select id="f-cat" className="select" value={form.group} onChange={e => setForm(f => ({ ...f, group: e.target.value }))}>
                {GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="f-body">본문</label>
            <BodyEditor value={form.body} onChange={body => setForm(f => ({ ...f, body }))} onKeyDown={onEditorKey} />
            {varsOf(form.body).length > 0 && <div className="chips">{varsOf(form.body).map(v => <span key={v} className="chip">{v}</span>)}</div>}
          </div>
          <div className="field">
            <label htmlFor="f-tags">태그</label>
            <input id="f-tags" className="input" value={form.tags} onKeyDown={onEditorKey}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="쉼표로 구분 · 1688, 시즌상품" />
          </div>
          <div className="field">
            <label htmlFor="f-note">메모</label>
            <textarea id="f-note" className="textarea" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="어떤 모델에서 잘 됐는지, 주의할 점" />
          </div>
          <div className="footer-bar">
            <span className="hint hide-sm"><span className="mono">⌘S</span> 저장 · <span className="mono">Esc</span> 취소</span>
            <div className="actions">
              <button className="btn" onClick={cancelEdit}>취소</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>{saving ? "저장 중" : "저장"}</button>
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="detail-body">
          <div className="timeline">
            <div className="ver">
              <div className="ver-head" style={{ cursor: "default" }}>
                <span className="badge">현재</span>
                <span className="when">{stamp(prompt.updatedAt || Date.now())}</span>
                <span className="snippet">{(prompt.body || "").split("\n")[0]}</span>
              </div>
            </div>
            {versions.map((v, i) => (
              <div key={v.savedAt + "-" + i} className={"ver" + (openVer === i ? " open" : "")}>
                <button className="ver-head" aria-expanded={openVer === i} onClick={() => setOpenVer(o => o === i ? null : i)}>
                  {I.chev}
                  <span className="when">{stamp(v.savedAt)}</span>
                  <span className="snippet">{(v.body || "").split("\n")[0]}</span>
                </button>
                {openVer === i && (
                  <div className="ver-body">
                    <pre>{v.body}</pre>
                    <button className="btn btn-sm" onClick={async () => {
                      try {
                        await onSave({ ...toFormSaved(prompt), body: v.body });
                        setOpenVer(null); toast("이 버전으로 되돌렸어요");
                      } catch { toast("되돌리지 못했어요. 다시 시도하세요", "error"); }
                    }}>이 버전으로 되돌리기</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {versions.length === 0 && <p className="hint" style={{ margin: 0 }}>본문을 수정하면 이전 버전이 여기에 쌓여요.</p>}
        </div>
      )}
    </div>
  );
}
export function toFormSaved(p) { return { title: p.title, group: groupOf(p), tags: p.tags || [], body: p.body, note: p.note || "" }; }

