"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
  Zap,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
  const [step, setStep] = useState<"account" | "verify">("account");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState<{
    tone: "info" | "error";
    text: string;
  } | null>(null);

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < 8)
      return setMessage({ tone: "error", text: "密码至少需要 8 个字符。" });
    if (password !== confirmPassword)
      return setMessage({ tone: "error", text: "两次输入的密码不一致。" });
    setPending("create");
    const result = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      callbackURL: "/dashboard",
    });
    setPending("");
    if (result.error)
      return setMessage({
        tone: "error",
        text: result.error.message || "注册失败，请稍后重试。",
      });
    setStep("verify");
    setMessage({ tone: "info", text: "验证码已发送，有效期 10 分钟。" });
  };

  const resend = async () => {
    setPending("resend");
    setMessage(null);
    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    setPending("");
    setMessage(
      result.error
        ? { tone: "error", text: "验证码发送失败，请稍后重试。" }
        : { tone: "info", text: "新的验证码已发送。" },
    );
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending("verify");
    setMessage(null);
    const result = await authClient.emailOtp.verifyEmail({ email, otp });
    if (result.error) {
      setPending("");
      setMessage({ tone: "error", text: "验证码错误、已过期或尝试次数过多。" });
      return;
    }
    window.location.assign("/dashboard");
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-[#f3f6fb] px-5 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="mb-7 inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-[#3157d5]"
        >
          <ArrowLeft size={14} />
          返回登录
        </Link>
        <section className="rounded-[24px] border border-[#e5eaf2] bg-white p-7 shadow-[0_20px_60px_rgba(38,55,89,.08)] sm:p-9">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-[#3157d5] text-white">
              <Zap size={18} fill="currentColor" />
            </span>
            <div>
              <p className="text-xs font-medium tracking-[.12em] text-[#3157d5]">
                ACCESSHUB
              </p>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-[-.03em]">
                {step === "account" ? "创建邮箱账户" : "验证邮箱地址"}
              </h1>
            </div>
          </div>
          {step === "account" ? (
            <>
              <p className="mt-5 text-sm leading-6 text-slate-500">
                设置登录密码后，我们会向你的邮箱发送验证码。验证完成前不能使用密码登录。
              </p>
              <form
                onSubmit={(event) => void createAccount(event)}
                className="mt-6 space-y-3"
              >
                <label className="relative block">
                  <UserRound
                    className="absolute left-3.5 top-3.5 text-slate-400"
                    size={17}
                  />
                  <input
                    required
                    minLength={2}
                    maxLength={64}
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="昵称"
                    className="access-input h-12 w-full pl-10"
                  />
                </label>
                <label className="relative block">
                  <Mail
                    className="absolute left-3.5 top-3.5 text-slate-400"
                    size={17}
                  />
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="邮箱"
                    className="access-input h-12 w-full pl-10"
                  />
                </label>
                <label className="relative block">
                  <KeyRound
                    className="absolute left-3.5 top-3.5 text-slate-400"
                    size={17}
                  />
                  <input
                    required
                    minLength={8}
                    maxLength={128}
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="密码（至少 8 个字符）"
                    className="access-input h-12 w-full pl-10"
                  />
                </label>
                <label className="relative block">
                  <ShieldCheck
                    className="absolute left-3.5 top-3.5 text-slate-400"
                    size={17}
                  />
                  <input
                    required
                    minLength={8}
                    maxLength={128}
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="再次输入密码"
                    className="access-input h-12 w-full pl-10"
                  />
                </label>
                <button
                  disabled={pending !== "" || !name.trim() || !email.trim()}
                  className="h-12 w-full rounded-xl bg-[#182238] text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {pending === "create" ? "正在创建…" : "创建账户并验证邮箱"}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mt-6 rounded-2xl bg-[#f5f7fb] p-4">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#3157d5]">
                    <CheckCircle2 size={17} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      验证码已发送至
                    </p>
                    <p className="mt-1 break-all text-xs text-slate-500">
                      {email}
                    </p>
                  </div>
                </div>
              </div>
              <form
                onSubmit={(event) => void verify(event)}
                className="mt-5 space-y-3"
              >
                <input
                  required
                  autoFocus
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="输入 6 位验证码"
                  className="access-input h-12 w-full text-center tracking-[.2em]"
                />
                <button
                  disabled={pending !== "" || otp.length !== 6}
                  className="h-12 w-full rounded-xl bg-[#182238] text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {pending === "verify" ? "正在验证…" : "验证并进入控制台"}
                </button>
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("account");
                      setOtp("");
                      setMessage(null);
                    }}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    修改资料
                  </button>
                  <button
                    type="button"
                    disabled={pending !== ""}
                    onClick={() => void resend()}
                    className="font-medium text-[#3157d5] disabled:opacity-50"
                  >
                    {pending === "resend" ? "发送中…" : "重新发送验证码"}
                  </button>
                </div>
              </form>
            </>
          )}
          {message && (
            <p
              className={`mt-4 rounded-xl px-4 py-3 text-xs leading-5 ${message.tone === "info" ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-600"}`}
            >
              {message.text}
            </p>
          )}
          <p className="mt-7 border-t border-slate-100 pt-5 text-center text-xs text-slate-400">
            已经有账户？
            <Link
              href="/login"
              className="ml-1 font-medium text-[#3157d5] hover:underline"
            >
              直接登录
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
