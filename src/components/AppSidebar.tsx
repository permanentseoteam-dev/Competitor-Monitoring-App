"use client";

import type { ReactNode } from "react";
import LogoutButton from "@/components/LogoutButton";

export type NavKey =
  | "dashboard"
  | "competitors"
  | "products"
  | "runs"
  | "settings";

const NAV: Array<{ key: NavKey; label: string; icon: ReactNode }> = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 4h7v7H4V4Zm9 0h7v5h-7V4ZM4 13h7v7H4v-7Zm9 3h7v4h-7v-4Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    ),
  },
  {
    key: "competitors",
    label: "Competitors",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3 4 7v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V7l-8-4Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "products",
    label: "New Products",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 7h16v12H4V7Zm2-3h12l2 3H4l2-3Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "runs",
    label: "Scrape Runs",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "settings",
    label: "Settings",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M19.4 13a7.8 7.8 0 0 0 .1-2l2-1.2-2-3.4-2.3.6a7.7 7.7 0 0 0-1.7-1L15 3h-6l-.5 2.9a7.7 7.7 0 0 0-1.7 1L4.5 6.4l-2 3.4 2 1.2a7.8 7.8 0 0 0 0 2l-2 1.2 2 3.4 2.3-.6a7.7 7.7 0 0 0 1.7 1L9 21h6l.5-2.9a7.7 7.7 0 0 0 1.7-1l2.3.6 2-3.4-2-1.2Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

type Props = {
  active: NavKey;
  onNavigate: (key: NavKey) => void;
};

export default function AppSidebar({ active, onNavigate }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand brand-icon-only" aria-label="Competitor Monitor">
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
      </div>

      <button type="button" className="workspace-switch">
        <span className="workspace-left">
          <span className="workspace-dot" aria-hidden />
          Monitor&apos;s
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <ul className="nav-list">
        {NAV.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={`nav-item${active === item.key ? " active" : ""}`}
              onClick={() => onNavigate(item.key)}
            >
              {item.icon}
              {item.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer">
        <a className="help-link" href="#help">
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M9.5 9.5a2.5 2.5 0 1 1 3.7 2.2c-.7.4-1.2.9-1.2 1.8V14"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="12" cy="17" r="0.8" fill="currentColor" />
          </svg>
          Help Center
        </a>
        <div className="profile-row">
          <span className="avatar" aria-hidden>
            CM
          </span>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
