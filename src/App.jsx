import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { GROUPS, GROUP, groupOf, newId, useMedia } from "./lib/prompt.js";
import { I } from "./icons.jsx";
import { useStore } from "./useStore.js";
import { Detail } from "./components/Detail.jsx";
import { NewPromptModal } from "./components/NewPromptModal.jsx";
import { PromptList } from "./components/PromptList.jsx";

export function App({ onUnauthorized, onLogout }) {
  const { prompts, status, write } = useStore(onUnauthorized);
  const wide = useMedia("(min-width: 1100px)");
  const [view, setView] = useState("sourcing");
  const [q, setQ] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(false);
  const [modalDraft, setModalDraft] = useState(null);
  const [pending, setPending] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const searchRef = useRef(null);
  const toastTimer = useRef(null);
  const dirtyRef = useRef(false);
  const group = GROUP[view] || null;

  const toast = useCallback((msg, kind) => {
    clearTimeout(toastTimer.current);
    setToastMsg({ msg, kind, k: Date.now() });
    toastTimer.current = setTimeout(() => setToastMsg(null), kind === "error" ? 4000 : 2200);
  }, []);

  const safe = useCallback(async (promise, msg = "저장하지 못했어요. 다시 시도하세요") => {
    try { await promise; return true; }
    catch (e) { toast(e && e.code === "quota_exceeded" ? "저장 공간이 가득 찼어요. 안 쓰는 프롬프트를 삭제하세요" : msg, "error"); return false; }
  }, [toast]);

  // leaving an edit with unsaved changes asks first
  const guard = fn => { if (dirtyRef.current) setPending({ run: fn }); else fn(); };
  const onDirty = useCallback(d => { dirtyRef.current = d; }, []);

  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current && searchRef.current.focus(); }
      if (e.key === "Escape") { setNavOpen(false); setPending(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = useMemo(() => {
    const c = { fav: 0 };
    GROUPS.forEach(g => (c[g.id] = 0));
    prompts.forEach(p => {
      c[groupOf(p)]++;
      if (p.favorite) c.fav++;
    });
    return c;
  }, [prompts]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    const tag = term.startsWith("#") ? term.slice(1) : null;
    let list = prompts.filter(p => {
      if (view === "fav") { if (!p.favorite) return false; }
      else if (groupOf(p) !== view) return false;
      if (!term) return true;
      if (tag) return (p.tags || []).some(t => t.toLowerCase() === tag);
      return [p.title, p.body, p.note, (p.tags || []).join(" ")].join(" ").toLowerCase().includes(term);
    });
    return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [prompts, view, q]);

  const selected = prompts.find(p => p.id === selectedId) || (wide ? items[0] : null);
  const showList = wide || !selected;
  const showDetail = !!selected;
  const viewLabel = group ? group.label : "즐겨찾기";
  const emptyText = group
    ? [`${group.label} 프롬프트가 없어요`, "자주 쓰는 프롬프트를 저장하고 변수만 바꿔서 바로 복사하세요."]
    : ["즐겨찾기한 프롬프트가 없어요", "프롬프트 상단의 별을 눌러 추가하세요."];

  function selectView(v) {
    guard(() => { setView(v); setNavOpen(false); setSelectedId(null); setQ(""); });
  }

  const closeModal = useCallback(form => {
    setModal(false);
    setModalDraft(form && (form.title.trim() || form.body.trim() || form.tags.trim()) ? form : null);
  }, []);

  async function create(fields) {
    const id = newId(); const now = Date.now();
    await write(id, { ...fields, favorite: false, uses: 0, versions: [], lastValues: {}, createdAt: now, updatedAt: now }, "set");
    setModal(false);
    setModalDraft(null);
    if (view !== fields.group) { setView(fields.group); setQ(""); }
    setSelectedId(id);
    toast("프롬프트를 추가했어요");
  }

  async function save(fields) {
    const now = Date.now();
    const prev = selected;
    const patch = { ...fields, updatedAt: now };
    if (prev.body !== fields.body) {
      patch.versions = [{ body: prev.body, savedAt: prev.updatedAt || now }, ...(prev.versions || [])].slice(0, 20);
    }
    await write(prev.id, patch, "update");
    if (view !== "fav" && fields.group !== groupOf(prev)) { setView(fields.group); setSelectedId(prev.id); }
  }

  function copied(values) {
    const clean = {};
    Object.entries(values).forEach(([k, v]) => { if (v) clean[k] = v; });
    safe(write(selected.id, { incrementUses: true, lastUsedAt: Date.now(), lastValues: clean }, "update"), "사용 기록을 저장하지 못했어요");
  }

  function filterTag(t) {
    setQ("#" + t);
    if (!wide) setSelectedId(null);
  }

  async function duplicate() {
    const p = selected; const id = newId(); const now = Date.now();
    if (!(await safe(write(id, { title: p.title + " 사본", group: groupOf(p), tags: p.tags || [], body: p.body, note: p.note || "", favorite: false, uses: 0, versions: [], lastValues: {}, createdAt: now, updatedAt: now }, "set"), "복제하지 못했어요. 다시 시도하세요"))) return;
    setSelectedId(id); toast("복제했어요");
  }

  async function remove() {
    const id = selected.id;
    if (!(await safe(write(id, null, "delete"), "삭제하지 못했어요. 다시 시도하세요"))) return;
    setSelectedId(null); toast("삭제했어요");
  }

  const navItem = (id, label, icon, n) => (
    <button key={id} className="nav-item" aria-current={view === id ? "page" : undefined} onClick={() => selectView(id)}>
      {icon}<span>{label}</span>{n > 0 && <span className="n">{n}</span>}
    </button>
  );

  return (
    <>
      <header className="topbar">
        <div className="topbar-row">
          <button className="btn btn-ghost btn-icon menu-btn" aria-label="메뉴" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>{I.menu}</button>
          <div className="crumb">
            <span className="mark">{I.logo}</span>
            <span className="hide-sm">프롬프트</span>
            <span className="sep hide-sm">/</span>
            <span className="muted">{viewLabel}</span>
          </div>
          <div className="spacer"/>
          <button className="btn btn-primary" aria-label="새 프롬프트" onClick={() => setModal(true)}>{I.plus}<span className="hide-sm">새 프롬프트</span></button>
        </div>
      </header>

      <div className="shell">
        {navOpen && <div className="scrim" onClick={() => setNavOpen(false)}/>}
        <aside className={"sidebar" + (navOpen ? " open" : "")} aria-label="워크스페이스">
          {navItem("fav", "즐겨찾기", I.star, counts.fav)}
          <div className="nav-sep"/>
          {GROUPS.map(g => navItem(g.id, g.label, I[g.id], counts[g.id]))}
          <button className="nav-item nav-bottom" onClick={() => guard(onLogout)}>{I.logout}<span>로그아웃</span></button>
        </aside>

        <div className="main">
          <main className="page">
            {status === "error" && <div className="notice">목록을 불러오지 못했어요. 페이지를 새로고침하세요.</div>}
            {status === "no_db" && <div className="notice">데이터베이스가 연결되지 않았어요. Vercel 프로젝트의 Storage에서 Neon 데이터베이스를 연결한 뒤 다시 배포하세요.</div>}

            {showList && (
              <div className="toolbar">
                <div className="search">
                  {I.search}
                  <input id="search" ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder="제목, 본문, 태그 검색" aria-label="검색"/>
                  <span className="kbd hide-sm">⌘K</span>
                </div>
              </div>
            )}

            <div className="workspace">
              {showList && (
                <PromptList items={items} status={status} selectedId={selected && selected.id}
                  onSelect={id => guard(() => setSelectedId(id))}
                  onNew={group ? () => setModal(true) : null} filtered={!!q.trim()} emptyText={emptyText} showGroup={!group} />
              )}
              {showDetail && (
                <Detail
                  key={selected.id}
                  prompt={selected}
                  isNew={false}
                  toast={toast}
                  onSave={save}
                  onDelete={remove}
                  onDuplicate={duplicate}
                  onToggleFav={() => safe(write(selected.id, { favorite: !selected.favorite }, "update"), "즐겨찾기를 저장하지 못했어요")}
                  onCopied={copied}
                  onTagClick={filterTag}
                  onDirty={onDirty}
                  onBack={() => guard(() => setSelectedId(null))}
                />
              )}
              {wide && !showDetail && status !== "loading" && (
                <div className="pane"><div className="empty"><h3>프롬프트를 선택하세요</h3><p>목록에서 고르거나 새로 만들어 보세요.</p></div></div>
              )}
            </div>
          </main>
        </div>
      </div>

      {modal && <NewPromptModal defaultGroup={group ? group.id : "sourcing"} initial={modalDraft} onClose={closeModal}
        onDiscard={() => { setModal(false); setModalDraft(null); }} onCreate={create} />}
      {pending && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setPending(null); }}>
          <div className="modal modal-sm" role="alertdialog" aria-modal="true" aria-labelledby="g-heading">
            <div className="modal-head"><h2 id="g-heading">저장하지 않은 변경 내용이 있어요</h2></div>
            <div className="modal-body"><p className="hint" style={{ margin: 0 }}>이동하면 편집 중인 내용이 사라져요.</p></div>
            <div className="modal-foot">
              <div className="actions">
                <button className="btn" autoFocus onClick={() => setPending(null)}>계속 편집</button>
                <button className="btn btn-danger" onClick={() => { dirtyRef.current = false; const run = pending.run; setPending(null); run(); }}>버리고 이동</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {toastMsg && (
        <div className={"toast" + (toastMsg.kind === "error" ? " toast-error" : "")} key={toastMsg.k} role={toastMsg.kind === "error" ? "alert" : "status"}>
          {toastMsg.kind === "error" ? I.alert : I.check}{toastMsg.msg}
        </div>
      )}
    </>
  );
}
