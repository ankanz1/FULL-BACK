import { useState, useEffect, useRef } from 'react';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';

const API_BASE = 'https://full-back-1.onrender.com';

interface Team {
  id: string; name: string; code: string; flag: string;
}

interface MatchStats {
  match_id: string;
  home_team: Team;
  away_team: Team;
  status: string;
  score: { home: number; away: number; penalties?: { home: number; away: number } };
  stage?: string;
  date?: string;
}

interface PlayerEntry {
  player_id: string;
  name: string;
  nationality: string;
  position: string;
  goals: number;
  assists: number;
}

interface NewsItem {
  title: string;
  link: string;
  source: string;
  published: string;
}

const STAGE_ORDER: Record<string, number> = {
  'LAST_16': 0, 'ROUND_16': 0,
  'QUARTER_FINALS': 1,
  'SEMI_FINALS': 2,
  'THIRD_PLACE': 3, 'BRONZE_FINAL': 3,
  'FINAL': 4,
};

const STAGE_LABELS: Record<string, string> = {
  'LAST_16': 'ROUND OF 16',
  'ROUND_16': 'ROUND OF 16',
  'QUARTER_FINALS': 'QUARTERFINALS',
  'SEMI_FINALS': 'SEMIFINALS',
  'THIRD_PLACE': 'BRONZE FINAL',
  'BRONZE_FINAL': 'BRONZE FINAL',
  'FINAL': 'FINAL',
};

const WORLD_CUP_ALL_TIME_TOP_SCORERS = [
  { rank: 1, name: 'Lionel Messi', nationality: 'Argentina', goals: 19, years: '2006–2026' },
  { rank: 2, name: 'Kylian Mbappé', nationality: 'France', goals: 18, years: '2018–2026' },
  { rank: 3, name: 'Miroslav Klose', nationality: 'Germany', goals: 16, years: '2002–2014' },
  { rank: 4, name: 'Ronaldo Nazário', nationality: 'Brazil', goals: 15, years: '1994–2006' },
  { rank: 5, name: 'Gerd Müller', nationality: 'West Germany', goals: 14, years: '1970–1974' },
  { rank: 6, name: 'Just Fontaine', nationality: 'France', goals: 13, years: '1958' },
  { rank: 7, name: 'Pelé', nationality: 'Brazil', goals: 12, years: '1958–1970' },
  { rank: 8, name: 'Sándor Kocsis', nationality: 'Hungary', goals: 11, years: '1954' },
  { rank: 9, name: 'Jürgen Klinsmann', nationality: 'Germany', goals: 11, years: '1990–1998' },
  { rank: 10, name: 'Helmut Rahn', nationality: 'West Germany', goals: 10, years: '1954–1958' },
];

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function isDecided(m: MatchStats): boolean {
  return m.status === 'Finished' || !!m.score.penalties;
}

function winnerTeam(m: MatchStats): string | null {
  if (!isDecided(m)) return null;
  if (m.score.penalties) {
    return m.score.penalties.home > m.score.penalties.away ? m.home_team.id : m.away_team.id;
  }
  if (m.score.home > m.score.away) return m.home_team.id;
  if (m.score.away > m.score.home) return m.away_team.id;
  return null;
}

function displayScore(m: MatchStats): string {
  if (m.score.penalties) {
    return `${m.score.home} (${m.score.penalties.home}) - (${m.score.penalties.away}) ${m.score.away}`;
  }
  return `${m.score.home} - ${m.score.away}`;
}

function BracketMatch({ match, side }: { match: MatchStats; side: 'left' | 'right' }) {
  const decided = isDecided(match);
  const winner = winnerTeam(match);
  const isHome = side === 'left';

  return (
    <div className={`border border-[#2A2A28] bg-[#171715]/40 rounded p-2.5 ${decided ? 'opacity-100' : 'opacity-70'}`}>
      <div className="flex items-center gap-2 text-[0.65rem]">
        <div className={`flex items-center gap-1.5 flex-1 ${isHome ? '' : 'flex-row-reverse'}`}>
          <span className="text-base">{match.home_team.flag}</span>
          <span className={`mono ${winner === match.home_team.id ? 'text-[#ECEAE3] font-bold' : 'text-[#8B8A85]'}`}>
            {match.home_team.code}
          </span>
        </div>
        <span className="mono text-[0.7rem] text-[#D9622B] font-bold">{decided ? displayScore(match) : '?'}</span>
        <div className={`flex items-center gap-1.5 flex-1 ${!isHome ? '' : 'flex-row-reverse'}`}>
          <span className="text-base">{match.away_team.flag}</span>
          <span className={`mono ${winner === match.away_team.id ? 'text-[#ECEAE3] font-bold' : 'text-[#8B8A85]'}`}>
            {match.away_team.code}
          </span>
        </div>
      </div>
      <div className="mono text-[0.5rem] text-neutral-600 text-center mt-1">
        {formatDate(match.date)}
      </div>
    </div>
  );
}

function BracketRound({
  label,
  matches,
  side,
}: {
  label: string;
  matches: MatchStats[];
  side: 'left' | 'right';
}) {
  if (!matches.length) return null;
  return (
    <div className="space-y-3">
      <div className="mono text-[0.6rem] text-[#D9622B] tracking-widest text-center">{label}</div>
      <div className="space-y-2">
        {matches.map((m) => (
          <BracketMatch key={m.match_id} match={m} side={side} />
        ))}
      </div>
    </div>
  );
}

function KnockoutBracket({
  matches,
  loading,
  error,
  onRetry,
}: {
  matches: MatchStats[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading) return <LoadingState label="Loading bracket..." />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  const byStage: Record<string, MatchStats[]> = {};
  for (const m of matches) {
    const stage = m.stage || '';
    if (stage in STAGE_ORDER || stage === 'GROUP_STAGE' || stage === 'LAST_32') continue;
    const key = stage in STAGE_LABELS ? stage : stage;
    if (!byStage[key]) byStage[key] = [];
    byStage[key].push(m);
  }

  const stages = Object.entries(byStage)
    .filter(([k]) => k in STAGE_ORDER)
    .sort(([a], [b]) => (STAGE_ORDER[a] ?? 99) - (STAGE_ORDER[b] ?? 99));

  if (!stages.length) {
    return <div className="mono text-[0.7rem] text-neutral-500 text-center py-8">No knockout matches available.</div>;
  }

  const leftStages = stages.filter(([, ms]) => ms.some(m => STAGE_ORDER[m.stage!] !== undefined && STAGE_ORDER[m.stage!] < 2));
  const rightStages = stages.filter(([, ms]) => ms.some(m => STAGE_ORDER[m.stage!] !== undefined && STAGE_ORDER[m.stage!] >= 2));
  const finalStage = stages.find(([k]) => k === 'FINAL');
  const bronzeStage = stages.find(([k]) => k === 'THIRD_PLACE' || k === 'BRONZE_FINAL');

  const champion = finalStage?.[1]?.[0] ? winnerTeam(finalStage[1][0]) : null;
  const championName = champion
    ? finalStage![1][0].home_team.id === champion
      ? finalStage![1][0].home_team.name
      : finalStage![1][0].away_team.name
    : null;

  const isFinalDecided = finalStage?.[1]?.[0] ? isDecided(finalStage[1][0]) : false;

  return (
    <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-4 md:p-6">
      <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase mb-5">[ KNOCKOUT_BRACKET ]</h3>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
        {/* Left bracket */}
        <div className="space-y-6">
          {leftStages.map(([key, stageMatches]) => (
            <BracketRound key={key} label={STAGE_LABELS[key] || key} matches={stageMatches} side="left" />
          ))}
        </div>

        {/* Center trophy/champion */}
        <div className="flex flex-col items-center justify-center py-4 px-2">
          <div className="text-3xl mb-1">{isFinalDecided ? '🏆' : '⏳'}</div>
          <div className="mono text-[0.6rem] text-[#D9622B] tracking-widest text-center">
            {isFinalDecided ? 'CHAMPION' : 'TBD'}
          </div>
          {championName && (
            <div className="mono text-[0.7rem] text-[#ECEAE3] font-bold text-center mt-1">{championName}</div>
          )}
          {!isFinalDecided && finalStage?.[1]?.[0] && (
            <div className="mono text-[0.55rem] text-neutral-500 text-center mt-1">
              {finalStage[1][0].home_team.code} vs {finalStage[1][0].away_team.code}
            </div>
          )}

          {/* Bronze final below */}
          {bronzeStage && bronzeStage[1].length > 0 && (
            <div className="mt-4 w-full">
              <div className="mono text-[0.5rem] text-neutral-500 tracking-widest text-center mb-1">BRONZE</div>
              <BracketMatch match={bronzeStage[1][0]} side="left" />
            </div>
          )}
        </div>

        {/* Right bracket */}
        <div className="space-y-6">
          {rightStages.map(([key, stageMatches]) => (
            <BracketRound key={key} label={STAGE_LABELS[key] || key} matches={stageMatches} side="right" />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  players,
  statKey,
  loading,
  error,
  onRetry,
}: {
  title: string;
  players: PlayerEntry[];
  statKey: 'goals' | 'assists';
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading) return <LoadingState label="Loading..." />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  return (
    <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-4 flex flex-col">
      <h4 className="mono text-[0.6rem] text-[#D9622B] tracking-widest uppercase mb-3">{title}</h4>
      {players.length === 0 ? (
        <div className="mono text-[0.65rem] text-neutral-500 py-4 text-center">No data available.</div>
      ) : (
        <div className="space-y-2.5 flex-1">
          {players.slice(0, 3).map((p, i) => (
            <div key={p.player_id} className="flex items-center gap-2.5">
              <span className="mono text-[0.6rem] text-neutral-500 w-4 text-right">#{i + 1}</span>
              <div className="w-7 h-7 rounded-full bg-[#2A2A28] flex items-center justify-center text-xs">
                {p.nationality ? p.nationality.slice(0, 2).toUpperCase() : '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="mono text-[0.65rem] text-[#ECEAE3] truncate">{p.name}</div>
                <div className="mono text-[0.5rem] text-neutral-500">{p.position} · {p.nationality}</div>
              </div>
              <span className="mono text-[0.75rem] text-[#D9622B] font-bold">{p[statKey]}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 pt-2 border-t border-[#2A2A28]/50 text-center">
        <button
          onClick={() => {
            const tabs = document.querySelectorAll('[role=tab]');
            tabs.forEach((t) => {
              if ((t as HTMLElement).textContent?.includes('Player Stats')) (t as HTMLElement).click();
            });
          }}
          className="mono text-[0.6rem] text-[#8B8A85] hover:text-[#D9622B] transition-colors"
        >
          All →
        </button>
      </div>
    </div>
  );
}

function AllTimeTopScorers() {
  return (
    <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-4">
      <h4 className="mono text-[0.6rem] text-[#D9622B] tracking-widest uppercase mb-3">ALL-TIME WORLD CUP GOALS</h4>
      <div className="space-y-1.5">
        {WORLD_CUP_ALL_TIME_TOP_SCORERS.slice(0, 10).map((p) => (
          <div key={p.rank} className="flex items-center gap-2.5">
            <span className="mono text-[0.6rem] text-neutral-500 w-4 text-right">#{p.rank}</span>
            <div className="w-7 h-7 rounded-full bg-[#2A2A28] flex items-center justify-center text-xs">
              {p.nationality.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="mono text-[0.65rem] text-[#ECEAE3] truncate">{p.name}</div>
              <div className="mono text-[0.5rem] text-neutral-500">{p.nationality} · {p.years}</div>
            </div>
            <span className="mono text-[0.75rem] text-[#D9622B] font-bold">{p.goals}</span>
          </div>
        ))}
      </div>
      <div className="mono text-[0.5rem] text-neutral-600 mt-3 pt-2 border-t border-[#2A2A28]/50 text-center">
        Historical data. Does not update live during the tournament.
      </div>
    </div>
  );
}

function NewsSection({
  items,
  loading,
  error,
  onRetry,
}: {
  items: NewsItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading) return <LoadingState label="Loading news..." />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;

  if (!items.length) {
    return <div className="mono text-[0.7rem] text-neutral-500 text-center py-4">No headlines available.</div>;
  }

  return (
    <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-4">
      <h4 className="mono text-[0.6rem] text-[#D9622B] tracking-widest uppercase mb-3">NEWS</h4>
      <div className="space-y-2.5">
        {items.slice(0, 10).map((item, i) => (
          <a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="mono text-[0.7rem] text-[#ECEAE3] group-hover:text-[#D9622B] transition-colors leading-snug">
              {item.title}
            </div>
            <div className="flex gap-2 mt-0.5">
              <span className="mono text-[0.5rem] text-[#D9622B]">{item.source}</span>
              <span className="mono text-[0.5rem] text-neutral-600">{formatDate(item.published)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function OverviewSection() {
  const [knockoutMatches, setKnockoutMatches] = useState<MatchStats[]>([]);
  const [kmLoading, setKmLoading] = useState(true);
  const [kmError, setKmError] = useState('');

  const [playerStats, setPlayerStats] = useState<{ top_scorers: PlayerEntry[]; top_assists: PlayerEntry[] } | null>(null);
  const [psLoading, setPsLoading] = useState(true);
  const [psError, setPsError] = useState('');

  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState('');

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchKnockout = async () => {
      try {
        const res = await fetch(`${API_BASE}/matches`);
        if (!res.ok) throw new Error('Failed to fetch matches');
        const data: MatchStats[] = await res.json();
        const ko = data.filter((m) => {
          const s = m.stage || '';
          return s in STAGE_ORDER;
        });
        setKnockoutMatches(ko);
      } catch (e) {
        setKmError((e as Error).message);
      } finally {
        setKmLoading(false);
      }
    };

    const fetchPlayerStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/wc/stats`);
        if (!res.ok) throw new Error('Failed to fetch WC player stats');
        const data = await res.json();
        setPlayerStats(data);
      } catch (e) {
        setPsError((e as Error).message);
      } finally {
        setPsLoading(false);
      }
    };

    const fetchNews = async () => {
      try {
        const res = await fetch(`${API_BASE}/news`);
        if (!res.ok) throw new Error('Failed to fetch news');
        const data = await res.json();
        setNewsItems(data.headlines || []);
      } catch (e) {
        setNewsError((e as Error).message);
      } finally {
        setNewsLoading(false);
      }
    };

    fetchKnockout();
    fetchPlayerStats();
    fetchNews();
  }, []);

  return (
    <div className="space-y-8">
      {/* Knockout Bracket */}
      <KnockoutBracket
        matches={knockoutMatches}
        loading={kmLoading}
        error={kmError}
        onRetry={() => { setKmLoading(true); setKmError(''); fetchedRef.current = false; }}
      />

      {/* Stat Leader Cards */}
      <div>
        <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase mb-3">[ WC_2026_LEADERS ]</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            title="TOP SCORERS"
            players={playerStats?.top_scorers || []}
            statKey="goals"
            loading={psLoading}
            error={psError}
            onRetry={() => { setPsLoading(true); setPsError(''); }}
          />
          <StatCard
            title="TOP ASSISTS"
            players={playerStats?.top_assists || []}
            statKey="assists"
            loading={psLoading}
            error={psError}
            onRetry={() => { setPsLoading(true); setPsError(''); }}
          />
        </div>
      </div>

      {/* All-Time + News Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AllTimeTopScorers />
        <NewsSection
          items={newsItems}
          loading={newsLoading}
          error={newsError}
          onRetry={() => { setNewsLoading(true); setNewsError(''); }}
        />
      </div>
    </div>
  );
}
