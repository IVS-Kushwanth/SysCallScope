import { Link } from "react-router-dom";

/** The mark: a ring (the process) split by the user/kernel boundary, with a lime call crossing it. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0B0F18" stroke="rgba(255,255,255,0.08)" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#1558C9" strokeWidth="2.4" />
      <path d="M3.5 16h25" stroke="#1558C9" strokeWidth="1.6" strokeDasharray="2 2" />
      <circle cx="16" cy="16" r="3" fill="#D4FF24" />
    </svg>
  );
}

export function Logo({ to = "/", compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-md" aria-label="SyscallScope home">
      <LogoMark />
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight">
          Syscall<span className="text-cobalt-300">Scope</span>
        </span>
      )}
    </Link>
  );
}
