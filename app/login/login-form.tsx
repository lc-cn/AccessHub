"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Fingerprint,
  GitBranch,
  HeartHandshake,
  KeyRound,
  Mail,
  TicketCheck,
  Zap,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useCodeSendCooldown } from "@/lib/use-code-send-cooldown";

export default function LoginForm({ profileHubEnabled }: { profileHubEnabled: boolean }) {
  const [pending, setPending] = useState<
    | "rbac"
    | "github"
    | "afdian"
    | "email"
    | "otp-send"
    | "otp-verify"
    | "passkey"
    | "forgot"
    | null
  >(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [emailMode, setEmailMode] = useState<"password" | "otp">("otp");
  const otpCooldown = useCodeSendCooldown("sign-in");

  const destination = () => {
    const next = new URLSearchParams(window.location.search).get("next");
    return next?.startsWith("/") && !next.startsWith("//")
      ? next
      : "/dashboard";
  };

  const signIn = async (provider: "github" | "afdian" | "rbac") => {
    setPending(provider);
    setError("");
    const next = new URLSearchParams(window.location.search).get("next");
    const callbackURL =
      next?.startsWith("/") && !next.startsWith("//") ? next : "/";
    const result = await authClient.signIn.social({ provider, callbackURL });
    if (result?.error) {
      setError(
        provider === "rbac"
          ? "ProfileHub 登录暂时不可用，请稍后重试。"
          : provider === "afdian"
          ? "爱发电登录暂时不可用；首次使用请先通过 GitHub 登录并绑定。"
          : "GitHub 登录暂时不可用，请稍后重试。",
      );
      setPending(null);
    }
  };

  const signInWithEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending("email");
    setError("");
    const callbackURL = destination();
    sessionStorage.setItem("accesshub.auth.next", callbackURL);
    const result = await authClient.signIn.email({
      email,
      password,
      callbackURL,
    });
    if (result.error) {
      setError("邮箱或密码不正确，或邮箱尚未完成验证。");
      setPending(null);
    }
  };

  const sendOtp = async () => {
    if (otpCooldown.isCoolingDown) return;
    if (!email) return setError("请先输入邮箱。");
    setPending("otp-send");
    setError("");
    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setPending(null);
    if (!result.error) otpCooldown.startCooldown();
    setError(
      result.error
        ? "验证码暂时无法发送，请稍后重试。"
        : "验证码已发送；新邮箱验证成功后会自动创建账户。",
    );
  };

  const signInWithOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending("otp-verify");
    setError("");
    const result = await authClient.signIn.emailOtp({
      email,
      otp,
      name: email.split("@")[0] || "新用户",
    });
    if (result.error) {
      setError("验证码错误或已失效。");
      setPending(null);
      return;
    }
    window.location.assign(destination());
  };

  const signInWithPasskey = async () => {
    setPending("passkey");
    setError("");
    const result = await authClient.signIn.passkey();
    if (result.error) {
      setError("未能使用 Passkey 登录，请确认浏览器支持并重试。");
      setPending(null);
      return;
    }
    window.location.assign(destination());
  };

  const forgotPassword = async () => {
    if (!email) return setError("请先输入要找回的邮箱。");
    setPending("forgot");
    setError("");
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setPending(null);
    setError(
      result.error
        ? "暂时无法发送重置邮件，请稍后重试。"
        : "如果该邮箱已注册，重置邮件已经发送。",
    );
  };

  return (
    <main className="grid min-h-dvh bg-[#f3f6fb] lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)]">
      <Link
        href="/register"
        className="fixed right-6 top-6 z-10 rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-xs font-medium text-[#3157d5] shadow-sm backdrop-blur hover:bg-white"
      >
        邮箱注册
      </Link>
      <section className="relative hidden overflow-hidden bg-[#182238] p-12 text-white lg:flex lg:flex-col xl:p-16">
        <div className="absolute -left-32 top-1/4 size-96 rounded-full bg-[#3157d5]/25 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#3157d5]">
            <Zap size={18} fill="currentColor" />
          </span>
          <span>
            <strong className="block font-semibold">AccessHub</strong>
            <span className="text-[10px] tracking-[.15em] text-slate-400">
              API ACCESS CONTROL
            </span>
          </span>
        </div>
        <div className="relative my-auto max-w-xl">
          <p className="text-xs font-medium tracking-[.16em] text-[#91a7f3]">
            ACCESS BY POLICY
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.08] tracking-[-.045em] xl:text-6xl">
            清楚地知道
            <br />
            每一次调用的边界。
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-slate-300">
            登录后查看分钟、每日、每周与每月配额，在需要时通过兑换码升级访问权益。
          </p>
          <div className="mt-12 grid grid-cols-3 gap-3">
            <Feature icon={<Activity size={17} />} label="周期用量" />
            <Feature icon={<KeyRound size={17} />} label="身份凭据" />
            <Feature icon={<TicketCheck size={17} />} label="权益兑换" />
          </div>
        </div>
        <p className="relative text-xs text-slate-500">
          AccessHub 支持 ProfileHub、Passkey 与邮箱登录
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="mb-12 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-[#3157d5] text-white">
              <Zap size={18} fill="currentColor" />
            </span>
            <strong>AccessHub</strong>
          </div>
          <p className="text-xs font-medium tracking-wide text-[#3157d5]">
            欢迎回来
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-.035em]">
            登录访问控制台
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            使用 Passkey、邮箱验证码或已绑定的第三方账户登录。
          </p>
          <div className="mt-9 space-y-3">
            {profileHubEnabled && (
              <button
                onClick={() => void signIn("rbac")}
                disabled={pending !== null}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <KeyRound size={18} />
                {pending === "rbac" ? "正在跳转…" : "使用 ProfileHub 登录"}
              </button>
            )}
            <button
              onClick={() => void signInWithPasskey()}
              disabled={pending !== null}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#182238] text-sm font-medium text-white shadow-[0_16px_36px_rgba(24,34,56,.16)] transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:opacity-60"
            >
              <Fingerprint size={18} />
              {pending === "passkey"
                ? "正在验证 Passkey…"
                : "使用 Passkey 登录"}
              <ArrowRight size={15} />
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => void signIn("github")}
                disabled={pending !== null}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <GitBranch size={17} />
                GitHub
              </button>
              <button
                onClick={() => void signIn("afdian")}
                disabled={pending !== null}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <HeartHandshake size={17} />
                爱发电
              </button>
            </div>
          </div>
          <div className="my-6 flex items-center gap-3 text-[11px] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            或使用邮箱
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="mb-3 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setEmailMode("otp");
                setError("");
              }}
              className={`rounded-lg px-3 py-2 ${emailMode === "otp" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400"}`}
            >
              验证码登录
            </button>
            <button
              type="button"
              onClick={() => {
                setEmailMode("password");
                setError("");
              }}
              className={`rounded-lg px-3 py-2 ${emailMode === "password" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400"}`}
            >
              密码登录
            </button>
          </div>
          {emailMode === "otp" ? (
            <form
              onSubmit={(event) => void signInWithOtp(event)}
              className="space-y-3"
            >
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="邮箱"
                className="access-input h-12 w-full"
              />
              <div className="flex gap-2">
                <input
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
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
                  disabled={pending !== null || otpCooldown.isCoolingDown}
                  onClick={() => void sendOtp()}
                  className="rounded-xl border border-slate-200 bg-white px-4 text-xs font-medium text-slate-600 disabled:opacity-60"
                >
                  {pending === "otp-send"
                    ? "发送中…"
                    : otpCooldown.isCoolingDown
                      ? `${otpCooldown.remainingSeconds} 秒后重发`
                      : "发送验证码"}
                </button>
              </div>
              <button
                disabled={pending !== null || otp.length !== 6}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Mail size={17} />
                {pending === "otp-verify" ? "正在验证…" : "使用验证码登录"}
              </button>
            </form>
          ) : (
            <form
              onSubmit={(event) => void signInWithEmail(event)}
              className="space-y-3"
            >
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="邮箱"
                className="access-input h-12 w-full"
              />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="密码"
                className="access-input h-12 w-full"
              />
              <button
                disabled={pending !== null}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <KeyRound size={17} />
                {pending === "email" ? "正在登录…" : "使用邮箱密码登录"}
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void forgotPassword()}
                className="w-full text-center text-xs text-slate-400 hover:text-[#3157d5]"
              >
                {pending === "forgot" ? "正在发送重置邮件…" : "忘记密码？"}
              </button>
            </form>
          )}
          {error && (
            <p
              className={`mt-4 rounded-xl px-4 py-3 text-xs ${error.includes("已发送") ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-600"}`}
            >
              {error}
            </p>
          )}
          <div className="mt-10 border-t border-slate-200 pt-6">
            <p className="text-xs leading-5 text-slate-400">
              继续即表示你同意完成身份验证，并同意
              <Link
                href="/terms"
                className="mx-1 font-medium text-slate-600 underline underline-offset-2 hover:text-[#3157d5]"
              >
                服务条款
              </Link>
              、已阅读
              <Link
                href="/privacy"
                className="ml-1 font-medium text-slate-600 underline underline-offset-2 hover:text-[#3157d5]"
              >
                隐私政策
              </Link>
              。AccessHub 不会读取你的仓库内容。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl bg-white/[0.06] p-4">
      <span className="text-[#91a7f3]">{icon}</span>
      <p className="mt-3 text-xs text-slate-300">{label}</p>
    </div>
  );
}
