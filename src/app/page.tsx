"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { register, login } from "@/lib/api";
import { saveUser, getStoredUser } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [pendingToken, setPendingToken] = useState<string | null>(null);

  useEffect(() => {
    // pending crew token 확인
    const token = localStorage.getItem("pending_crew_token");
    if (token) setPendingToken(token);

    const user = getStoredUser();
    if (user) {
      if (token) {
        router.replace(`/join?token=${token}`);
      } else {
        router.replace(user.crew ? "/home" : "/onboarding");
      }
    }
  }, [router]);

  const handleSubmit = async () => {
    setError("");
    if (!username || !password) {
      setError("아이디와 비밀번호를 입력해주세요");
      return;
    }
    if (mode === "register" && !email) {
      setError("이메일을 입력해주세요");
      return;
    }

    setLoading(true);
    try {
      const res = mode === "register"
        ? await register({ username, email, password })
        : await login({ username, password });

      saveUser(res.user);
      // pending crew token이 있으면 크루 가입 페이지로
      const token = localStorage.getItem("pending_crew_token");
      if (token) {
        router.push(`/join?token=${token}`);
      } else {
        router.push(res.user.crew ? "/home" : "/onboarding");
      }
    } catch (e: any) {
      try {
        const err = JSON.parse(e.message);
        if (err.error) setError(err.error);
        else if (err.username) setError(`아이디: ${err.username[0]}`);
        else if (err.email) setError(`이메일: ${err.email[0]}`);
        else if (err.password) setError(`비밀번호: ${err.password[0]}`);
        else setError("요청 실패");
      } catch {
        setError("서버 연결 실패");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg, #1A1A2E, #0D1B2A)" }}
    >
      <div className="text-5xl mb-4">🏃</div>
      <h1 className="text-white text-2xl font-extrabold mb-1">러닝크루</h1>
      <p className="text-gray-400 text-sm mb-8">함께 달리고, 함께 성장</p>

      <div className="w-full space-y-3">
        {/* Mode tabs */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              mode === "login" ? "bg-[var(--primary)] text-white" : "bg-white/10 text-gray-400"
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
              mode === "register" ? "bg-[var(--primary)] text-white" : "bg-white/10 text-gray-400"
            }`}
          >
            회원가입
          </button>
        </div>

        {/* Username */}
        <input
          type="text"
          placeholder="아이디"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white text-sm outline-none placeholder:text-gray-500 focus:border-[var(--primary)]"
        />

        {/* Email (register only) */}
        {mode === "register" && (
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white text-sm outline-none placeholder:text-gray-500 focus:border-[var(--primary)]"
          />
        )}

        {/* Password */}
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="w-full bg-white/10 border border-white/20 rounded-xl py-3 px-4 text-white text-sm outline-none placeholder:text-gray-500 focus:border-[var(--primary)]"
        />

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl py-2 px-4 text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-[var(--primary)] rounded-xl py-3 text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? "처리 중..." : mode === "register" ? "회원가입" : "로그인"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 py-2">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-gray-500 text-xs">또는</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Social login buttons (placeholder) */}
        <button className="w-full bg-white rounded-xl py-3 flex items-center justify-center gap-3 text-sm font-bold text-gray-400 cursor-not-allowed opacity-50">
          <span className="text-lg">🔵</span> Google (준비 중)
        </button>
        <button className="w-full bg-black rounded-xl py-3 flex items-center justify-center gap-3 text-sm font-bold text-gray-500 cursor-not-allowed opacity-50">
          <span className="text-lg"></span> Apple (준비 중)
        </button>
        <button className="w-full rounded-xl py-3 flex items-center justify-center gap-3 text-sm font-bold cursor-not-allowed opacity-50"
          style={{ backgroundColor: "#FEE500", color: "#aaa" }}>
          <span className="text-lg">💬</span> 카카오 (준비 중)
        </button>
      </div>

      {pendingToken && (
        <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl py-3 px-4 mt-4 text-center">
          <p className="text-blue-300 text-xs font-bold">🏃 크루 초대 링크로 접속했습니다</p>
          <p className="text-blue-400/70 text-[10px] mt-1">로그인 또는 회원가입 후 자동으로 크루에 가입됩니다</p>
        </div>
      )}

      <p className="text-gray-500 text-xs mt-4 text-center">
        가입 시 이용약관 및 개인정보처리방침에 동의합니다
      </p>
    </div>
  );
}
