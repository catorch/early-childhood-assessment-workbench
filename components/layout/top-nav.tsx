import { Bell, ChevronDown, Search } from "lucide-react";

import { Photo } from "@/components/ui/photo";
import { currentUser } from "@/lib/auth";

export function TopNav() {
  return (
    <header className="top-nav">
      <label className="search-shell">
        <Search size={20} />
        <input aria-label="Search videos, prompts, raters" placeholder="Search videos, prompts, raters..." />
        <span className="kbd">⌘ K</span>
      </label>
      <div className="user-menu">
        <button className="button ghost icon-only" aria-label="Notifications">
          <Bell size={22} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Photo className="avatar" src={currentUser.avatarUrl} alt="" />
          <div>
            <strong>{currentUser.name}</strong>
            <p className="muted" style={{ margin: "3px 0 0" }}>
              {currentUser.role}
            </p>
          </div>
          <ChevronDown size={18} />
        </div>
      </div>
    </header>
  );
}
