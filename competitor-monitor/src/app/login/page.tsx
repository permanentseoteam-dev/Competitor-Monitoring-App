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
        <p className="eyebrow">Competitor Monitor</p>
        <h1>Sign in</h1>
        <p className="lede">Enter your credentials to open the dashboard.</p>
        <LoginForm />
      </section>
    </div>
  );
}
