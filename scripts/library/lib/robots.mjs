// robots.txt, read the way the standard asks: the group for our own agent
// token if there is one, else the group for *; the longest matching rule
// wins, and Allow beats Disallow on a tie. A crawl delay is honoured, up to
// a minute. (The same rules as supabase/functions/_shared/shop-prices/robots.ts,
// in plain JavaScript for the scripts.)

/** @returns {{groups: {agents: string[], rules: {allow: boolean, path: string}[], crawlDelay: number | null}[]}} */
export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === 'disallow' || field === 'allow') current.rules.push({ allow: field === 'allow', path: value });
    else if (field === 'crawl-delay') {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) current.crawlDelay = Math.min(seconds, 60);
    }
  }
  return { groups };
}

/** The rules that apply to our token: its own group, else the * group, else nothing. */
export function rulesFor(robots, agentToken) {
  const token = agentToken.toLowerCase();
  const own = robots.groups.find((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  const star = robots.groups.find((g) => g.agents.includes('*'));
  return own ?? star ?? { agents: [], rules: [], crawlDelay: null };
}

function matches(rulePath, path) {
  if (!rulePath) return false;
  const anchored = rulePath.endsWith('$');
  const pattern = (anchored ? rulePath.slice(0, -1) : rulePath).split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${pattern}${anchored ? '$' : ''}`).test(path);
}

export function isAllowed(group, path) {
  let best = null;
  for (const rule of group.rules) {
    if (!matches(rule.path, path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow && !best.allow)) best = rule;
  }
  return best ? best.allow : true;
}
