import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { GROUPS, GROUP, groupOf, LONG_VAR, splitVars, varsOf, fillText, ago, stamp, newId, useMedia, copyText } from "../lib/prompt.js";
import { I } from "../icons.jsx";

/* ---------- list ---------- */
export function PromptList({ items, selectedId, onSelect, status, onNew, filtered, emptyText, showGroup }) {
  if (status === "loading") {
    return <div className="pane list-pane">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton"><i style={{ width: "60%" }}/><i style={{ width: "35%" }}/></div>)}</div>;
  }
  if (!items.length) {
    return (
      <div className="pane list-pane">
        <div className="empty">
          <h3>{filtered ? "맞는 프롬프트가 없어요" : emptyText[0]}</h3>
          <p>{filtered ? "검색어를 바꿔보세요." : emptyText[1]}</p>
          {!filtered && onNew && <button className="btn btn-primary" onClick={onNew}>{I.plus}새 프롬프트</button>}
        </div>
      </div>
    );
  }
  return (
    <div className="pane list-pane" role="list">
      <div className="list-head"><span>{items.length}개</span></div>
      {items.map(p => {
        const n = varsOf(p.body).length;
        const meta = [
          showGroup && GROUP[groupOf(p)].label,
          n > 0 && `변수 ${n}`,
          p.uses > 0 && `${p.uses}회 사용`,
          !showGroup && (p.tags || []).slice(0, 2).map(t => "#" + t).join(" "),
        ].filter(Boolean);
        return (
          <button key={p.id} role="listitem" className="row" aria-current={p.id === selectedId} onClick={() => onSelect(p.id)}>
            <span className="row-title">{p.title}</span>
            <span className="row-time">{ago(p.updatedAt)}</span>
            <span className="row-meta">
              {p.favorite && <svg className="star" viewBox="0 0 16 16"><path d="M8 1.9l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.1 4.4 13l.7-4L2.2 6.2l4-.6z"/></svg>}
              {meta.map((m, i) => <React.Fragment key={i}>{i > 0 && <span className="dot"/>}<span className="ellipsis">{m}</span></React.Fragment>)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

