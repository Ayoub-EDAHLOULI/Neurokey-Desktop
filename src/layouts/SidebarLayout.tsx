import {
  Shield,
  CreditCard,
  Radar,
  Settings,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import TitleBar from "../components/TitleBar";
import UpdatePrompt from "../components/UpdatePrompt";

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-screen bg-background flex overflow-hidden relative">
      <TitleBar />

      <aside className="w-56 bg-card border-r border-border flex flex-col pt-8 z-40 shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
          <Shield className="text-primary w-6 h-6 mr-3" />
          <h1 className="text-lg font-bold text-text tracking-wide">
            NeuroKey
          </h1>
        </div>

        <nav className="flex-1 py-4 flex flex-col gap-2 px-3">
          <NavItem to="/vault" icon={<Shield size={20} />} label="Vault" />
          <NavItem
            to="/wallet"
            icon={<CreditCard size={20} />}
            label="Digital Wallet"
          />
          <NavLink
            to="/generator"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-inputBg"
          >
            <Sparkles size={20} />
            <span>Generator</span>
          </NavLink>
          <NavItem
            to="/radar"
            icon={<Radar size={20} />}
            label="Breach Radar"
          />
          <NavItem
            to="/sync"
            icon={<RefreshCw size={20} />}
            label="Device Sync"
          />
        </nav>

        <UpdatePrompt />

        <div className="p-3 border-t border-border">
          <NavItem
            to="/settings"
            icon={<Settings size={20} />}
            label="Settings"
          />
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-background pt-8 relative z-0">
        {children}
      </main>
    </div>
  );
}

function NavItem({
  icon,
  label,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  to: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center w-full px-3 py-2.5 rounded-lg transition-colors ${
          isActive
            ? "bg-primary text-white"
            : "text-subText hover:bg-inputBg hover:text-text"
        }`
      }
    >
      {icon}
      <span className="ml-3 font-medium text-sm">{label}</span>
    </NavLink>
  );
}
