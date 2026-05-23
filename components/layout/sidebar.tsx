"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, HelpCircle, Home, MessageSquareText, Settings, Video, Building2, ChevronRight, ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Videos", href: "/videos", icon: Video },
  { label: "Review Queue", href: "/review", icon: ClipboardList, count: "32" },
  { label: "Reliability", href: "/reliability", icon: BarChart3 },
  { label: "Prompts", href: "/prompts", icon: MessageSquareText },
  { label: "Settings", href: "/settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <Link href="/dashboard" className="brand" aria-label="Assessment Reliability Workbench dashboard">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="brand-text">Assessment Reliability Workbench</span>
      </Link>

      <nav className="nav-list">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={cn("nav-item", active && "active")} aria-current={active ? "page" : undefined}>
              <Icon size={24} strokeWidth={2} />
              <span className="nav-label">{item.label}</span>
              {item.count ? (
                <span className="count">
                  <Badge tone="blue">{item.count}</Badge>
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="workspace-card">
          <span className="workspace-icon">
            <Building2 size={22} />
          </span>
          <div className="workspace-copy" style={{ minWidth: 0 }}>
            <strong>BrightStart Lab</strong>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Workspace
            </p>
          </div>
          <ChevronDown size={18} style={{ marginLeft: "auto" }} />
        </div>
        <Link className="nav-item" href="/settings#support">
          <HelpCircle size={24} />
          <span className="nav-label">Help & Support</span>
          <ChevronRight className="count" size={18} />
        </Link>
      </div>
    </aside>
  );
}
