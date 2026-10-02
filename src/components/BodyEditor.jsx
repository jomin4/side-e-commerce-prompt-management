import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { GROUPS, GROUP, groupOf, LONG_VAR, splitVars, varsOf, fillText, ago, stamp, newId, useMedia, copyText } from "../lib/prompt.js";

/* ---------- body editor with {{variable}} highlighting ---------- */
export function BodyEditor({ value, onChange, onKeyDown, id = "f-body", compact }) {
  const parts = splitVars(value);
  return (
    <div className={"editor" + (compact ? " compact" : "")}>
      <pre className="editor-mirror" aria-hidden="true">
        {parts.map((p, i) => p.v ? <span key={i} className="tok">{p.raw}</span> : <React.Fragment key={i}>{p.text}</React.Fragment>)}
        {"\n "}
      </pre>
      <textarea
        id={id} className="editor-input" value={value} spellCheck={false}
        onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown}
        placeholder={"프롬프트 본문\n\n바뀌는 부분은 {{키워드}} 처럼 중괄호 두 개로 감싸세요."}
        aria-label="프롬프트 본문"
      />
    </div>
  );
}

