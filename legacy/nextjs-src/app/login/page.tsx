import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in · Competitor Monitor",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="login-shell">
      <section className="login-panel">
        <div className="login-brand">
          <span className="brand-orbit" aria-hidden>
            <span className="brand-core">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7h16v11H4V7Zm3-3h10l1.5 3h-13L7 4Z"
                  fill="currentColor"
                />
              </svg>
            </span>
          </span>
          <span className="brand-copy">
            <strong>Monitor</strong>
            <span>Competitor intel</span>
          </span>
        </div>
        <p className="eyebrow">Secure access</p>
        <h1>Sign in</h1>
        <p className="lede">Enter your credentials to open the dashboard.</p>
        <LoginForm />
      </section>
    </div>
  );
}
