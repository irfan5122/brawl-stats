import { useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bolt,
  Check,
  ChevronDown,
  CircleHelp,
  Crown,
  Filter,
  Flame,
  Gem,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { fetchPlayer } from "./api";
import type { Brawler, PlayerResponse } from "./types";

type TrophyTab = "qualified" | "below";

const classIcon: Record<string, typeof Swords> = {
  Assassin: Swords,
  Tank: Shield,
  Marksman: Activity,
  Controller: Layers3,
  "Damage Dealer": Flame,
  Support: Gem,
  Artillery: Bolt,
};

const classColors: Record<string, string> = {
  Assassin: "violet",
  Tank: "blue",
  Marksman: "cyan",
  Controller: "amber",
  "Damage Dealer": "rose",
  Support: "emerald",
  Artillery: "fuchsia",
};

function classColor(name: string): string {
  return classColors[name] ?? "violet";
}

function groupBrawlers(brawlers: Brawler[]) {
  const groups = new Map<string, Brawler[]>();
  for (const brawler of brawlers) {
    const key = brawler.className || "Unknown";
    const current = groups.get(key) ?? [];
    current.push(brawler);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, items]) => ({
      name,
      items: items.sort(
        (a, b) => b.trophies - a.trophies || a.name.localeCompare(b.name),
      ),
    }));
}

function formatNumber(value: number | null | undefined) {
  return value == null ? "—" : value.toLocaleString("en-US");
}

function trophyTier(trophies: number) {
  if (trophies >= 1500) return "trophy-legend";
  if (trophies >= 1250) return "trophy-high";
  if (trophies >= 1100) return "trophy-mid";
  return "trophy-entry";
}

function PowerBadge({ power }: { power: number | null }) {
  if (power == null) return <span className="pill pill-muted">Power —</span>;
  const tier = power === 11 ? "power-max" : power === 10 ? "power-ten" : power >= 8 ? "power-high" : "power-low";
  return <span className={`pill ${tier}`}>PWR {power}</span>;
}

function CountBadge({
  label,
  value,
}: {
  label: string;
  value: { label: string } | null;
}) {
  const text = value?.label ?? "—";
  const isComplete = /^\d+\/\d+$/.test(text) && text.split("/")[0] === text.split("/")[1];
  return (
    <span className={`equipment-chip ${isComplete ? "equipment-complete" : ""}`} title={`${label}: owned / catalogue count where available`}>
      <span>{label}</span>
      <strong>{text}</strong>
    </span>
  );
}

function BrawlerCard({ brawler, index }: { brawler: Brawler; index: number }) {
  const accent = classColor(brawler.className);
  const gears = brawler.gears;
  const hasGears = gears !== null;
  const image = brawler.imageUrl;

  return (
    <article className={`brawler-card accent-${accent}`} style={{ animationDelay: `${Math.min(index * 35, 350)}ms` }}>
      <div className="card-topline">
        <span className="card-class">{brawler.className || "Unknown"}</span>
        <span className="rank-chip">#{index + 1}</span>
      </div>

      <div className="brawler-identity">
        <div className={`brawler-portrait accent-${accent}`}>
          {image ? (
            <img src={image} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />
          ) : (
            <Swords size={34} strokeWidth={1.5} />
          )}
          <span className="portrait-glow" />
        </div>
        <div className="brawler-name-block">
          <h3>{brawler.name}</h3>
          <div className="brawler-subline">
            <PowerBadge power={brawler.power} />
            {brawler.rank != null && <span className="rank-text">Rank {brawler.rank}</span>}
          </div>
        </div>
      </div>

      <div className="trophy-box">
        <div className="trophy-label"><Trophy size={14} /> CURRENT TROPHIES</div>
        <div className={`trophy-value ${trophyTier(brawler.trophies)}`}>
          {formatNumber(brawler.trophies)}
          {brawler.trophies >= 1500 ? <Crown size={17} /> : null}
        </div>
        <div className="trophy-footer">
          <span>Peak {formatNumber(brawler.highestTrophies)}</span>
          <span className="trophy-track"><i style={{ width: `${Math.min(100, Math.max(4, (brawler.trophies / 1500) * 100))}%` }} /></span>
        </div>
      </div>

      <div className="equipment-area">
        <div className="equipment-heading"><Sparkles size={13} /> LOADOUT</div>
        <div className="equipment-grid">
          <CountBadge label="STAR PWR" value={brawler.starPowers} />
          <CountBadge label="GADGETS" value={brawler.gadgets} />
        </div>
        <div className="gear-line">
          <span className="gear-label"><Gem size={13} /> GEARS</span>
          {hasGears && gears.length > 0 ? (
            <span className="gear-values">{gears.join(" · ")}</span>
          ) : (
            <span className="gear-values muted">{hasGears ? "None reported" : "Data unavailable"}</span>
          )}
        </div>
      </div>
    </article>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Trophy;
  tone: string;
}) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-icon"><Icon size={18} /></div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-hint">{hint}</div>
    </div>
  );
}

export default function App() {
  const [tag, setTag] = useState("");
  const [data, setData] = useState<PlayerResponse | null>(null);
  const [tab, setTab] = useState<TrophyTab>("qualified");
  const [classFilter, setClassFilter] = useState("All classes");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadProfile(event?: FormEvent) {
    event?.preventDefault();
    if (!tag.trim()) {
      setError("Enter your player tag to load your brawlers.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await fetchPlayer(tag.trim());
      setData(result);
      setClassFilter("All classes");
      setSearch("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const currentList = useMemo(() => {
    if (!data) return [];
    return data.brawlers.filter((brawler) =>
      tab === "qualified" ? brawler.trophies >= 1000 : brawler.trophies < 1000,
    );
  }, [data, tab]);

  const availableClasses = useMemo(
    () => ["All classes", ...new Set(currentList.map((b) => b.className || "Unknown").sort((a, b) => a.localeCompare(b)))],
    [currentList],
  );

  const visibleList = useMemo(() => currentList.filter((brawler) => {
    const matchesClass = classFilter === "All classes" || brawler.className === classFilter;
    const matchesSearch = brawler.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchesClass && matchesSearch;
  }), [currentList, classFilter, search]);

  const groups = useMemo(() => groupBrawlers(visibleList), [visibleList]);

  function exportCsv() {
    if (!visibleList.length) return;
    const columns = ["Class", "Brawler", "Current Trophies", "Power", "Highest Trophies", "Star Powers", "Gadgets", "Gears"];
    const rows = visibleList.map((b) => [
      b.className, b.name, b.trophies, b.power ?? "", b.highestTrophies ?? "",
      b.starPowers?.label ?? "—", b.gadgets?.label ?? "—",
      b.gears?.join("; ") ?? "Unavailable",
    ]);
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [columns, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `brawl-stats-${tab}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const totalTrophies = data?.player.trophies ?? null;
  const classesCount = new Set(data?.brawlers.map((b) => b.className) ?? []).size;

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#" aria-label="Brawl Stats home">
          <div className="brand-mark"><Swords size={23} /></div>
          <div className="brand-copy"><strong>BRAWL<span>STATS</span></strong><small>PLAYER INTELLIGENCE</small></div>
        </a>
        <div className="topbar-right">
          <span className="live-dot" />
          <span className="topbar-status">PLAYER ANALYTICS</span>
          <span className="version-chip">BETA 1.0</span>
        </div>
      </header>

      <main className="main-content">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> BRAWLER DATABASE / PLAYER PROFILE</div>
            <h1>Your brawlers.<br /><span>Your battlefield.</span></h1>
            <p>Every trophy. Every class. One clean view of your collection.</p>
          </div>
          <div className="hero-emblem"><div className="emblem-ring"><Swords size={54} strokeWidth={1.15} /></div><span>TRACK · COMPARE · CLIMB</span></div>
        </section>

        <section className="search-panel">
          <form className="search-form" onSubmit={loadProfile}>
            <label htmlFor="player-tag">PLAYER TAG</label>
            <div className="input-row">
              <div className="input-wrap"><Search size={17} /><input id="player-tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="#ABC123" autoCapitalize="characters" /></div>
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? <LoaderCircle className="spin" size={17} /> : <Swords size={17} />}
                {loading ? "Loading..." : "Load profile"}
              </button>
            </div>
          </form>
          <div className="search-hint"><Shield size={14} /> Your API key stays on the backend. Only your player tag is entered here.</div>
        </section>

        {error && (
          <div className="error-banner" role="alert"><CircleHelp size={18} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>
        )}

        {data && (
          <>
            <section className="profile-strip">
              <div className="profile-avatar"><Swords size={26} /></div>
              <div className="profile-details"><div className="profile-name">{data.player.name} <span className="verified-mark"><Check size={11} /></span></div><div className="profile-tag">{data.player.tag} <span>·</span> {data.player.expLevel != null ? `XP LEVEL ${data.player.expLevel}` : "BRAWL STARS PLAYER"}</div></div>
              <div className="profile-total"><span>PLAYER TROPHIES</span><strong><Trophy size={16} /> {formatNumber(totalTrophies)}</strong></div>
              <button className="icon-button" onClick={() => loadProfile()} title="Refresh profile" aria-label="Refresh profile"><RefreshCw size={17} className={loading ? "spin" : ""} /></button>
            </section>

            <section className="stats-grid">
              <StatCard label="TOTAL BRAWLERS" value={formatNumber(data.summary.totalBrawlers)} hint="In your collection" icon={Users} tone="violet" />
              <StatCard label="1000+ CLUB" value={formatNumber(data.summary.qualifiedCount)} hint="At least 1,000 trophies" icon={Trophy} tone="gold" />
              <StatCard label="POWER 11" value={formatNumber(data.summary.power11Count)} hint="Fully levelled brawlers" icon={Bolt} tone="cyan" />
              <StatCard label="CLASS GROUPS" value={formatNumber(classesCount)} hint="Distinct catalogue classes" icon={Layers3} tone="pink" />
            </section>

            <section className="collection-section">
              <div className="section-heading">
                <div><div className="eyebrow"><span className="eyebrow-line" /> YOUR COLLECTION</div><h2>Brawler <span>gallery</span></h2><p>Sorted by current trophies inside every class.</p></div>
                <button className="secondary-button" onClick={exportCsv} disabled={!visibleList.length}><ArrowDownRight size={16} /> Export CSV</button>
              </div>

              <div className="toolbar">
                <div className="tabs" role="tablist" aria-label="Trophy threshold">
                  <button role="tab" aria-selected={tab === "qualified"} className={tab === "qualified" ? "active" : ""} onClick={() => { setTab("qualified"); setClassFilter("All classes"); }}><Trophy size={15} /> 1000+ trophies <span>{data.summary.qualifiedCount}</span></button>
                  <button role="tab" aria-selected={tab === "below"} className={tab === "below" ? "active" : ""} onClick={() => { setTab("below"); setClassFilter("All classes"); }}><ArrowDownRight size={15} /> Below 1000 <span>{data.summary.belowCount}</span></button>
                </div>
                <div className="toolbar-filters">
                  <div className="filter-wrap"><Filter size={15} /><select aria-label="Filter class" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>{availableClasses.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={14} /></div>
                  <div className="mini-search"><Search size={15} /><input aria-label="Search brawlers" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find brawler..." />{search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={13} /></button>}</div>
                </div>
              </div>

              <div className="results-line"><span>SHOWING <strong>{visibleList.length}</strong> BRAWLERS</span><span className="sort-indicator"><ArrowUpRight size={14} /> HIGHEST TO LOWEST</span></div>

              {groups.length ? groups.map((group) => {
                const Icon = classIcon[group.name] ?? Sparkles;
                const accent = classColor(group.name);
                return (
                  <section className={`class-section accent-${accent}`} key={group.name}>
                    <div className="class-heading">
                      <div className="class-icon"><Icon size={18} /></div>
                      <div className="class-title-wrap"><h3>{group.name}</h3><span>{group.items.length} {group.items.length === 1 ? "BRAWLER" : "BRAWLERS"}</span></div>
                      <div className="class-heading-line" />
                      <span className="class-best">TOP <strong>{formatNumber(group.items[0]?.trophies)}</strong></span>
                    </div>
                    <div className="brawler-grid">
                      {group.items.map((brawler, index) => <BrawlerCard key={`${group.name}-${brawler.id ?? brawler.name}`} brawler={brawler} index={index} />)}
                    </div>
                  </section>
                );
              }) : (
                <div className="empty-state"><div className="empty-icon"><Search size={25} /></div><h3>No brawlers found</h3><p>Try another class or search term, or switch the trophy tab.</p></div>
              )}
            </section>
          </>
        )}

        {!data && !loading && !error && (
          <section className="welcome-state">
            <div className="welcome-art"><div className="welcome-orbit orbit-a" /><div className="welcome-orbit orbit-b" /><div className="welcome-core"><Swords size={42} /></div><span className="orbit-star star-a">✦</span><span className="orbit-star star-b">✧</span></div>
            <div className="welcome-copy"><div className="eyebrow"><span className="eyebrow-line" /> READY WHEN YOU ARE</div><h2>Unlock your <span>roster.</span></h2><p>Enter your player tag above to map your brawlers, see trophy milestones, and explore your collection class by class.</p><div className="welcome-points"><span><Check size={14} /> Live player stats</span><span><Check size={14} /> Class-based rankings</span><span><Check size={14} /> Loadout overview</span></div></div>
          </section>
        )}

        <footer className="footer"><div className="footer-brand"><Swords size={15} /> BRAWL<span>STATS</span></div><span>Fan-made stats dashboard · Not affiliated with Supercell</span><span className="footer-status"><span className="live-dot" /> API KEY PROTECTED</span></footer>
      </main>
    </div>
  );
}
