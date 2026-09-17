"use client";

import { useState } from "react";
import { Fingerprint, Mail, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function ReauthenticatePage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const destination = () => {
    const next = new URLSearchParams(window.location.search).get("next");
    return next?.startsWith("/") && !next.startsWith("//")
      ? next
      : "/account/security";
  };
  const passkey = async () => {
    setPending("passkey");
    setMessage("");
    const result = await authClient.signIn.passkey();
    if (result.error) {
      setPending("");
      setMessage("Passkey 验证未完成，请重试或改用邮箱验证码。");
      return;
    }
    window.location.assign(destination());
  };
  const send = async () => {
    if (!email) return setMessage("请先输入账户邮箱。");
    setPending("send");
    setMessage("");
    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setPending("");
    setMessage(
      result.error
        ? "验证码发送失败，请稍后重试。"
        : "验证码已发送，有效期 10 分钟。",
    );
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending("verify");
    setMessage("");
    const result = await authClient.signIn.emailOtp({ email, otp });
    if (result.error) {
      setPending("");
      setMessage("验证码错误或已失效。");
      return;
    }
    window.location.assign(destination());
  };
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f3f6fb] px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_22px_60px_rgba(24,34,56,.1)] sm:p-9">
        <span className="grid size-12 place-items-center rounded-2xl bg-[#edf2ff] text-[#3157d5]">
          <ShieldCheck size={22} />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-[-.03em]">
          再次确认是你本人
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          该操作会影响账户凭据。请使用 Passkey 或主要邮箱完成一次强验证。
        </p>
        <button
          disabled={pending !== ""}
          onClick={() => void passkey()}
          className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#182238] text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          <Fingerprint size={17} />
          {pending === "passkey" ? "正在验证…" : "使用 Passkey 验证"}
        </button>
        <div className="my-5 flex items-center gap-3 text-[11px] text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          或使用邮箱验证码
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <form onSubmit={(event) => void verify(event)} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="账户邮箱"
            className="access-input h-12 w-full"
          />
          <div className="flex gap-2">
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, ""))
              }
              placeholder="6 位验证码"
              className="access-input h-12 min-w-0 flex-1"
            />
            <button
              type="button"
              disabled={pending !== ""}
              onClick={() => void send()}
              className="rounded-xl border border-slate-200 px-4 text-xs font-medium text-slate-600 disabled:opacity-60"
            >
              {pending === "send" ? "发送中…" : "发送验证码"}
            </button>
          </div>
          <button
            disabled={pending !== "" || otp.length !== 6}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <Mail size={16} />
            {pending === "verify" ? "正在验证…" : "确认并继续"}
          </button>
        </form>
        {message && (
          <p
            className={`mt-4 rounded-xl px-4 py-3 text-xs ${message.includes("已发送") ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-600"}`}
          >
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
