"use client";

import { useState } from "react";
import Link from "next/link";
import { Fingerprint, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function TwoFactorPage() {
  const [method, setMethod] = useState<"totp" | "otp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");

  const destination = () => {
    const next = new URLSearchParams(window.location.search).get("next");
    const stored = sessionStorage.getItem("accesshub.auth.next");
    const target =
      next?.startsWith("/") && !next.startsWith("//")
        ? next
        : stored?.startsWith("/") && !stored.startsWith("//")
          ? stored
          : "/dashboard";
    sessionStorage.removeItem("accesshub.auth.next");
    return target;
  };
  const sendEmailCode = async () => {
    setPending("send");
    setMessage("");
    const result = await authClient.twoFactor.sendOtp();
    setPending("");
    setMessage(
      result.error
        ? "验证码发送失败，请重试。"
        : "验证码已发送到你的主要邮箱。",
    );
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending("verify");
    setMessage("");
    const result =
      method === "totp"
        ? await authClient.twoFactor.verifyTotp({ code, trustDevice: false })
        : method === "otp"
          ? await authClient.twoFactor.verifyOtp({ code, trustDevice: false })
          : await authClient.twoFactor.verifyBackupCode({
              code,
              trustDevice: false,
            });
    if (result.error) {
      setPending("");
      setMessage("验证码无效、已过期或尝试次数过多。");
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
        <h1 className="mt-6 text-2xl font-semibold tracking-[-.03em] text-slate-900">
          完成双重验证
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          密码验证已通过。再使用一种已配置的安全方式确认是你本人。
        </p>
        <div className="mt-6 grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-xs font-medium">
          <Method
            active={method === "totp"}
            onClick={() => {
              setMethod("totp");
              setCode("");
              setMessage("");
            }}
            icon={<Fingerprint size={14} />}
            label="验证器"
          />
          <Method
            active={method === "otp"}
            onClick={() => {
              setMethod("otp");
              setCode("");
              setMessage("");
            }}
            icon={<Mail size={14} />}
            label="邮箱"
          />
          <Method
            active={method === "backup"}
            onClick={() => {
              setMethod("backup");
              setCode("");
              setMessage("");
            }}
            icon={<KeyRound size={14} />}
            label="恢复码"
          />
        </div>
        {method === "otp" && (
          <button
            disabled={pending !== ""}
            onClick={() => void sendEmailCode()}
            className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {pending === "send" ? "正在发送…" : "发送邮箱验证码"}
          </button>
        )}
        <form
          onSubmit={(event) => void verify(event)}
          className="mt-4 space-y-3"
        >
          <input
            required
            autoFocus
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value.trim())}
            placeholder={
              method === "backup" ? "输入一组恢复码" : "输入 6 位验证码"
            }
            className="access-input h-12 w-full text-center tracking-[.18em]"
          />
          <button
            disabled={pending !== "" || !code}
            className="h-12 w-full rounded-xl bg-[#182238] text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
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
        <Link
          href="/login"
          className="mt-6 block text-center text-xs text-slate-400 hover:text-[#3157d5]"
        >
          返回登录
        </Link>
      </section>
    </main>
  );
}

function Method({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 ${active ? "bg-white text-slate-800 shadow-sm" : "text-slate-400"}`}
    >
      {icon}
      {label}
    </button>
  );
}
