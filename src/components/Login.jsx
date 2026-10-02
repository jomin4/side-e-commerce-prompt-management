import React, { useState } from "react";
import { I } from "../icons.jsx";
import { api } from "../lib/api.js";

export function Login({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!password) { setError("비밀번호를 입력하세요."); return; }
    setBusy(true); setError("");
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setBusy(false);
      setError(
        err.code === "unauthorized" ? "비밀번호가 맞지 않아요." :
        err.code === "no_password" ? "서버에 APP_PASSWORD가 설정되지 않았어요." :
        "로그인하지 못했어요. 잠시 후 다시 시도하세요."
      );
    }
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <span className="mark mark-lg">{I.logo}</span>
        <h1>프롬프트</h1>
        <div className="field">
          <label htmlFor="password">비밀번호</label>
          <input id="password" type="password" className={"input" + (error ? " invalid" : "")} autoFocus
            autoComplete="current-password" value={password} onChange={e => { setPassword(e.target.value); setError(""); }} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? "확인 중" : "로그인"}</button>
      </form>
    </div>
  );
}

export function SetupNeeded({ what }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <span className="mark mark-lg">{I.logo}</span>
        <h1>설정이 필요해요</h1>
        <p className="hint" style={{ margin: 0 }}>
          {what === "password"
            ? "Vercel 프로젝트의 Settings → Environment Variables에 APP_PASSWORD를 추가하고 다시 배포하세요."
            : "Vercel 프로젝트의 Storage에서 Neon 데이터베이스를 연결하고 다시 배포하세요."}
        </p>
      </div>
    </div>
  );
}
