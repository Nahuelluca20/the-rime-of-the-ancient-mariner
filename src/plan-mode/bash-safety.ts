const WRITE_REDIRECTION_PATTERN = /(^|[^<])>(?!>)|>>/;

const DESTRUCTIVE_PATTERNS = [
	/\brm\b/i,
	/\brmdir\b/i,
	/\bmv\b/i,
	/\bcp\b/i,
	/\bmkdir\b/i,
	/\btouch\b/i,
	/\bchmod\b/i,
	/\bchown\b/i,
	/\bchgrp\b/i,
	/\bln\b/i,
	/\btee\b/i,
	/\bfind\b[\s\S]*\s-delete\b/i,
	/\b(curl|wget)\b[\s\S]*\s(-o|--output|-O|--remote-name)\b/i,
	/\b(curl|wget)\b[\s\S]*\s(-X|--request)\s+(POST|PUT|PATCH|DELETE)\b/i,
	/\|\s*(sh|bash|zsh|fish)\b/i,
	/\btruncate\b/i,
	/\bdd\b/i,
	/\bshred\b/i,
	WRITE_REDIRECTION_PATTERN,
	/\bnpm\s+(install|uninstall|update|ci|link|publish|run\s+(format|lint:fix))/i,
	/\byarn\s+(add|remove|install|publish|upgrade)/i,
	/\bpnpm\s+(add|remove|install|publish|update)/i,
	/\bbun\s+(add|remove|install|update|run\s+(format|lint:fix))/i,
	/\bpip\s+(install|uninstall)/i,
	/\bapt(-get)?\s+(install|remove|purge|update|upgrade)/i,
	/\bbrew\s+(install|uninstall|upgrade|update)/i,
	/\bgit\s+(add|commit|push|pull|merge|rebase|reset|checkout|switch|restore|stash|cherry-pick|revert|tag|init|clone|clean|apply)/i,
	/\bgit\s+branch\s+-[dDmM]/i,
	/\bsudo\b/i,
	/\bsu\b/i,
	/\bkill\b/i,
	/\bpkill\b/i,
	/\bkillall\b/i,
	/\breboot\b/i,
	/\bshutdown\b/i,
	/\bsystemctl\s+(start|stop|restart|enable|disable|reload)/i,
	/\bservice\s+\S+\s+(start|stop|restart|reload)/i,
	/\b(vim?|nano|emacs|code|subl)\b/i,
];

const SAFE_PATTERNS = [
	/^\s*cat\b/i,
	/^\s*head\b/i,
	/^\s*tail\b/i,
	/^\s*less\b/i,
	/^\s*more\b/i,
	/^\s*grep\b/i,
	/^\s*find\b/i,
	/^\s*ls\b/i,
	/^\s*pwd\b/i,
	/^\s*echo\b/i,
	/^\s*printf\b/i,
	/^\s*wc\b/i,
	/^\s*sort\b/i,
	/^\s*uniq\b/i,
	/^\s*diff\b/i,
	/^\s*file\b/i,
	/^\s*stat\b/i,
	/^\s*du\b/i,
	/^\s*df\b/i,
	/^\s*tree\b/i,
	/^\s*which\b/i,
	/^\s*whereis\b/i,
	/^\s*type\b/i,
	/^\s*env\b/i,
	/^\s*printenv\b/i,
	/^\s*uname\b/i,
	/^\s*whoami\b/i,
	/^\s*id\b/i,
	/^\s*date\b/i,
	/^\s*cal\b/i,
	/^\s*uptime\b/i,
	/^\s*ps\b/i,
	/^\s*top\b/i,
	/^\s*htop\b/i,
	/^\s*free\b/i,
	/^\s*git\s+(status|log|diff|show|branch|remote|config\s+--get|ls-files|ls-tree|rev-parse|describe)\b/i,
	/^\s*npm\s+(list|ls|view|info|search|outdated|audit)\b/i,
	/^\s*yarn\s+(list|info|why|audit)\b/i,
	/^\s*pnpm\s+(list|view|info|outdated|audit)\b/i,
	/^\s*bun\s+(--version|pm\s+ls)\b/i,
	/^\s*node\s+--version\b/i,
	/^\s*python\w*\s+--version\b/i,
	/^\s*curl\b/i,
	/^\s*wget\s+-O\s*-/i,
	/^\s*jq\b/i,
	/^\s*sed\s+-n\b/i,
	/^\s*awk\b/i,
	/^\s*rg\b/i,
	/^\s*fd\b/i,
	/^\s*bat\b/i,
	/^\s*eza\b/i,
];

/**
 * Best-effort check for whether a shell command is safe to run in read-only plan mode.
 *
 * Contract:
 * - Returns `true` only when the command matches a {@link SAFE_PATTERNS} entry AND hits no
 *   {@link DESTRUCTIVE_PATTERNS} entry. It therefore **fails closed**: any command not on the
 *   allow-list (or an empty command) is rejected.
 * - Patterns match substrings anywhere on the line, so a safe command that merely mentions a
 *   destructive word in an argument (e.g. `grep "git commit" file`) is conservatively rejected.
 * - It does NOT parse shell control flow — `;`, `&&`, `||`, `$(...)`, and backticks are not
 *   split or evaluated; the whole line is tested as text.
 *
 * This is a heuristic guard for plan mode, NOT a security sandbox. Do not rely on it as a
 * boundary against an adversary.
 */
export function isReadOnlyBashCommand(command: string): boolean {
	const trimmed = command.trim();
	if (trimmed.length === 0) return false;
	if (DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(trimmed))) return false;
	return SAFE_PATTERNS.some((pattern) => pattern.test(trimmed));
}
