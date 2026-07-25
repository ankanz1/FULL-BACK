import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import logoMark from './assets/logo_mark.png';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import OverviewSection from './components/OverviewSection';

const API_BASE = import.meta.env.VITE_PYTHON_SERVICE_URL || 'http://localhost:8000';

interface Player {
  player_id: string;
  name: string;
  nationality: string;
  position: string;
  market_value_m: number;
  minutes_played: number;
  goals: number;
  assists: number;
  key_passes: number;
  tackles: number;
  interceptions: number;
  pass_accuracy: number;
  cluster?: number;
  archetype?: string;
  pca_x?: number;
  pca_y?: number;
}

interface Highlight {
  id: string;
  timestamp: number;
  description: string;
  duration: number;
  video_url: string;
  thumbnail_url: string;
}

interface Team {
  id: string;
  name: string;
  code: string;
  flag: string;
}

interface MatchStats {
  match_id: string;
  home_team: Team;
  away_team: Team;
  status: string;
  score: { home: number; away: number };
  stats?: any;
  events?: any[];
  date?: string;
  stage?: string;
  group?: string;
  matchday?: number;
}

interface GroupStanding {
  position: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
}

interface TeamForm {
  team_id: string;
  team_name: string;
  form: string;
  recent_matches: Array<{
    match_id: string;
    opponent: string;
    score: string;
    result: "W" | "D" | "L";
    date: string;
  }>;
  goals_scored: number;
  goals_conceded: number;
  clean_sheets: number;
}

interface PlayerStats {
  top_scorers: Player[];
  top_assists: Player[];
}



export default function App() {
  // Custom router state
  const [currentPath, setCurrentPath] = useState('/'); // '/' | '/dashboard' | '/analyst' | '/players' | '/predictions' | '/highlights'
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [, setLoading] = useState(false);
  const [, setProgress] = useState(0);

  // Layout refs for GSAP animations
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const transitionSweepRef = useRef<HTMLDivElement>(null);
  // Hero card — receives cursor-driven rotateX/Y from rAF loop
  const tiltWrapRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Data states
  const [players, setPlayers] = useState<Player[]>([]);
  const [clusterStats, setClusterStats] = useState<{ silhouette_score: number; k: number; clusters: Array<{ cluster_id: number; archetype: string }> } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [playerClusterData, setPlayerClusterData] = useState<any>(null);

  // Match & prediction states
  const [selectedMatchId, setSelectedMatchId] = useState<string>('M001'); // USA vs COL
  const [predictionData, setPredictionData] = useState<any>(null);
  const [breakdownData, setBreakdownData] = useState<any>(null);
  const [highlightsData, setHighlightsData] = useState<Highlight[]>([]);
  const [matchDetail, setMatchDetail] = useState<MatchStats | null>(null);
  const [matchDetailLoading, setMatchDetailLoading] = useState(false);
  const [matchDetailError, setMatchDetailError] = useState('');
  const [modalPrediction, setModalPrediction] = useState<any>(null);
  const [modalPredictionLoading, setModalPredictionLoading] = useState(false);
  const [, setModalPredictionError] = useState('');
  const [modalBreakdown, setModalBreakdown] = useState<any>(null);
  const [modalBreakdownLoading, setModalBreakdownLoading] = useState(false);
  const [, setModalBreakdownError] = useState('');
  const [modalHighlights, setModalHighlights] = useState<Highlight[]>([]);
  const [modalHighlightsLoading, setModalHighlightsLoading] = useState(false);
  const [, setModalHighlightsError] = useState('');

  // New dashboard states
  const [activeTab, setActiveTab] = useState<string>('overview'); // 'overview' | 'table' | 'fixtures' | 'player-stats' | 'team-stats' | 'tactics'
  const [selectedGroup, setSelectedGroup] = useState<string>('A');
  const [matches, setMatches] = useState<MatchStats[]>([]);
  const [standings, setStandings] = useState<GroupStanding[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [teamForms, setTeamForms] = useState<Record<string, TeamForm>>({});
  const [snapshotData, setSnapshotData] = useState<{ image_url?: string; caption?: string } | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState('');

  // Tactical analyst state
  const [analystData, setAnalystData] = useState<{ image_url?: string; caption?: string; formations?: Record<string, string> } | null>(null);
  const [analystLoading, setAnalystLoading] = useState(false);
  const [analystError, setAnalystError] = useState('');

  // Prediction states
  const [allTeams, setAllTeams] = useState<string[]>([]);
  const [predHomeTeam, setPredHomeTeam] = useState('');
  const [predAwayTeam, setPredAwayTeam] = useState('');
  const [predResult, setPredResult] = useState<any>(null);
  const [predLoading, setPredLoading] = useState(false);
  const [predError, setPredError] = useState('');
  const [tournamentOdds, setTournamentOdds] = useState<any>(null);
  const [tournamentOddsLoading, setTournamentOddsLoading] = useState(false);
  const [tournamentOddsError, setTournamentOddsError] = useState('');
  const [dashboardLoading, setDashboardLoading] = useState<Record<string, boolean>>({});
  const [dashboardError, setDashboardError] = useState<Record<string, string>>({});

  const [toolLoading, setToolLoading] = useState<Record<string, boolean>>({});
  const [toolError, setToolError] = useState<Record<string, string>>({});

  // Tooltip state for scatter plot
  const [scatterTooltip, setScatterTooltip] = useState<{ player: Player; x: number; y: number } | null>(null);

  // Chat states
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant' | 'system'; text: string; imageUrl?: string }>>([
    { sender: 'assistant', text: "HELLO. I AM FULL BACK. STANDING BY FOR TACTICAL ANALYSIS OR MATCH DATA INTERROGATIONS. HOW CAN I BACK YOU TODAY?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Asset preloading
  useEffect(() => {
    let loadedCount = 0;
    let totalImages = IMAGE_ASSETS.length;

    const preloadImage = (url: string) => {
      const img = new Image();
      const onDone = () => {
        loadedCount++;
        setProgress(Math.round((loadedCount / totalImages) * 100));
        if (loadedCount >= totalImages) {
          setLoading(false);
          setTimeout(triggerEntranceAnims, 100);
        }
      };
      img.onload = onDone;
      img.onerror = onDone;
      img.src = url;
    };

    IMAGE_ASSETS.forEach(preloadImage);
    fetchPlayers();
    fetchClusterStats();

    setTimeout(() => setLoading(false), 6000);
  }, []);

  // Fetch prediction data on mount and when navigating to predictions
  useEffect(() => {
    fetchAllTeams();
  }, []);

  // Fetch tournament odds when navigating to predictions page
  useEffect(() => {
    if (currentPath === '/predictions') {
      fetchTournamentOdds();
    }
  }, [currentPath]);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // ── Hero 3D canvas cursor-tilt rAF loop ──
  // Drives rotateX / rotateZ on the .canvas-3d via tiltWrapRef.
  // Each .layer gets a parallax translate offset based on depth.
  useEffect(() => {
    if (currentPath !== '/') return;

    const canvas = tiltWrapRef.current;
    if (!canvas) return;

    const layers = Array.from(canvas.querySelectorAll('.layer'));

    const REST_RX = 55;
    const REST_RZ = -25;
    const MAX_D  = 8;

    if (reducedMotion) {
      canvas.style.transform = `rotateX(${REST_RX}deg) rotateZ(${REST_RZ}deg)`;
      layers.forEach((layer, i) => {
        (layer as HTMLElement).style.transform = `translateZ(${(i + 1) * 15}px)`;
      });
      return;
    }

    let targetRX = REST_RX;
    let targetRZ = REST_RZ;
    let curRX = REST_RX;
    let curRZ = REST_RZ;
    let rafId: number;

    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth)  * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      targetRX = REST_RX - ny * MAX_D;
      targetRZ = REST_RZ + nx * MAX_D;
    };

    const onLeave = () => { targetRX = REST_RX; targetRZ = REST_RZ; };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);

    const tick = () => {
      curRX += (targetRX - curRX) * 0.07;
      curRZ += (targetRZ - curRZ) * 0.07;
      if (tiltWrapRef.current) {
        tiltWrapRef.current.style.transform =
          `rotateX(${curRX.toFixed(3)}deg) rotateZ(${curRZ.toFixed(3)}deg)`;
        const layers = Array.from(tiltWrapRef.current.querySelectorAll('.layer'));
        layers.forEach((layer, i) => {
          const depth = (i + 1) * 15;
          const moveX = (curRZ - REST_RZ) * (i + 1) * 0.03;
          const moveY = (curRX - REST_RX) * (i + 1) * 0.03;
          (layer as HTMLElement).style.transform =
            `translateZ(${depth}px) translate(${moveX.toFixed(2)}px, ${moveY.toFixed(2)}px)`;
        });
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(rafId);
    };
  }, [currentPath, reducedMotion]);

  // GSAP Entrance Animations
  const triggerEntranceAnims = () => {
    const canvas = tiltWrapRef.current;
    if (canvas) {
      gsap.set(canvas, { opacity: 0, scale: 0.8, rotateX: 90, rotateZ: 0 });
      gsap.to(canvas, {
        opacity: 1, scale: 1, rotateX: 55, rotateZ: -25,
        duration: 2.5, ease: 'power3.out', delay: 0.3
      });
    }
    gsap.fromTo('.hero-title',
      { clipPath: 'polygon(0 0, 0 0, 0 100%, 0% 100%)' },
      { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', duration: 1.5, ease: 'power4.inOut', delay: 0.5 }
    );
    gsap.fromTo('.hero-bottombar > *',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.8, stagger: 0.15 }
    );
  };

  // Route transition sweep logic
  const handleNavigate = (path: string) => {
    if (path === currentPath || isTransitioning) return;
    setIsTransitioning(true);

    const sweep = transitionSweepRef.current;
    if (!sweep) {
      setCurrentPath(path);
      setIsTransitioning(false);
      return;
    }

    // GSAP diagonal orange sweep wipe in a single continuous timeline
    const tl = gsap.timeline({
      onComplete: () => {
        setIsTransitioning(false);
      }
    });

    tl.set(sweep, { xPercent: -101, skewX: -20 })
      .to(sweep, { xPercent: 0, skewX: 0, duration: 0.5, ease: 'power3.out' })
      .call(() => {
        // Change route in the middle when screen is fully covered
        setCurrentPath(path);
      })
      .to(sweep, { xPercent: 101, skewX: 20, duration: 0.5, ease: 'power3.in', delay: 0.1 });
  };

  // Fetch players list
  const fetchPlayers = async () => {
    try {
      const res = await fetch(`${API_BASE}/players`);
      if (res.ok) {
        const data = await res.json();
        setPlayers(data);
        if (data.length > 0) setSelectedPlayer(data[0].player_id);
      }
    } catch (e) {
      console.error('Error fetching players:', e);
    }
  };

  const fetchClusterStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/cluster/stats`);
      if (res.ok) {
        const data = await res.json();
        setClusterStats({
          silhouette_score: data.silhouette_score,
          k: data.clusters?.length || 5,
          clusters: (data.clusters || []).map((c: any) => ({
            cluster_id: c.cluster_id,
            archetype: c.archetype,
          })),
        });
      }
    } catch (e) {
      console.error('Error fetching cluster stats:', e);
    }
  };

  const CLUSTER_COLORS = ['#D9622B', '#6ba642', '#3b82f6', '#a855f7', '#eab308', '#ec4899', '#06b6d4', '#f97316'];

  // Fetch all matches (fixtures)
  const fetchMatches = async () => {
    const key = 'matches';
    setDashboardLoading(prev => ({ ...prev, [key]: true }));
    setDashboardError(prev => ({ ...prev, [key]: '' }));
    try {
      const res = await fetch(`${API_BASE}/matches`);
      if (!res.ok) throw new Error('Failed to fetch matches');
      const data = await res.json();
      setMatches(data);
    } catch (e) {
      setDashboardError(prev => ({ ...prev, [key]: (e as Error).message }));
    } finally {
      setDashboardLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Fetch single match detail
  const fetchMatchDetail = async (matchId: string) => {
    setMatchDetailLoading(true);
    setMatchDetailError('');
    setMatchDetail(null);
    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}`);
      if (!res.ok) throw new Error(`Failed to fetch match ${matchId}`);
      const data = await res.json();
      setMatchDetail(data);
    } catch (e) {
      setMatchDetailError((e as Error).message);
    } finally {
      setMatchDetailLoading(false);
    }
  };

  const handleMatchClick = (matchId: string) => {
    setSelectedMatchId(matchId);
    setMatchDetail(null);
    setModalPrediction(null);
    setModalBreakdown(null);
    setModalHighlights([]);
    setModalPredictionError('');
    setModalBreakdownError('');
    setModalHighlightsError('');
    fetchMatchDetail(matchId);

    const fetchPred = async () => {
      setModalPredictionLoading(true);
      try {
        const res = await fetch(`${API_BASE}/predict/match/${matchId}`);
        if (!res.ok) throw new Error('Failed');
        setModalPrediction(await res.json());
      } catch (e) { setModalPredictionError((e as Error).message); }
      finally { setModalPredictionLoading(false); }
    };
    const fetchBrk = async () => {
      setModalBreakdownLoading(true);
      try {
        const res = await fetch(`${API_BASE}/tactical/match/${matchId}`);
        if (!res.ok) throw new Error('Failed');
        setModalBreakdown(await res.json());
      } catch (e) { setModalBreakdownError((e as Error).message); }
      finally { setModalBreakdownLoading(false); }
    };
    const fetchHl = async () => {
      setModalHighlightsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/highlights/match/${matchId}`);
        if (!res.ok) throw new Error('Failed');
        const d = await res.json();
        setModalHighlights(d.highlights || []);
      } catch (e) { setModalHighlightsError((e as Error).message); }
      finally { setModalHighlightsLoading(false); }
    };
    fetchPred();
    fetchBrk();
    fetchHl();
  };

  // Fetch standings for a group
  const fetchStandings = async (group: string) => {
    const key = `standings-${group}`;
    setDashboardLoading(prev => ({ ...prev, [key]: true }));
    setDashboardError(prev => ({ ...prev, [key]: '' }));
    try {
      const res = await fetch(`${API_BASE}/standings/${group}`);
      if (!res.ok) throw new Error(`Failed to fetch standings for group ${group}`);
      const data = await res.json();
      setStandings(data);
    } catch (e) {
      setDashboardError(prev => ({ ...prev, [key]: (e as Error).message }));
    } finally {
      setDashboardLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Fetch player stats (top scorers/assists)
  const fetchPlayerStats = async () => {
    const key = 'player-stats';
    setDashboardLoading(prev => ({ ...prev, [key]: true }));
    setDashboardError(prev => ({ ...prev, [key]: '' }));
    try {
      const res = await fetch(`${API_BASE}/wc/stats`);
      if (!res.ok) throw new Error('Failed to fetch WC player stats');
      const data = await res.json();
      setPlayerStats(data);
    } catch (e) {
      setDashboardError(prev => ({ ...prev, [key]: (e as Error).message }));
    } finally {
      setDashboardLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Fetch team form for a specific team
  const fetchTeamForm = async (teamId: string) => {
    const key = `team-form-${teamId}`;
    setDashboardLoading(prev => ({ ...prev, [key]: true }));
    setDashboardError(prev => ({ ...prev, [key]: '' }));
    try {
      const res = await fetch(`${API_BASE}/team-form/${teamId}`);
      if (!res.ok) throw new Error(`Failed to fetch form for team ${teamId}`);
      const data = await res.json();
      setTeamForms(prev => ({ ...prev, [teamId]: data }));
    } catch (e) {
      setDashboardError(prev => ({ ...prev, [key]: (e as Error).message }));
    } finally {
      setDashboardLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const fetchTactics = async () => {
    setSnapshotLoading(true);
    setSnapshotError('');
    try {
      const res = await fetch(`${API_BASE}/tactics/snapshot`);
      if (!res.ok) throw new Error('Failed to fetch tactical snapshot');
      const data = await res.json();
      setSnapshotData(data);
    } catch (e) {
      setSnapshotError((e as Error).message);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const fetchAnalystTactical = async () => {
    setAnalystLoading(true);
    setAnalystError('');
    try {
      const res = await fetch(`${API_BASE}/analyst/tactical`);
      if (!res.ok) throw new Error('Failed to fetch tactical analysis');
      const data = await res.json();
      setAnalystData(data);
    } catch (e) {
      setAnalystError((e as Error).message);
    } finally {
      setAnalystLoading(false);
    }
  };

  const authenticatedFetch = async (url: string): Promise<any> => {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Service returned error ${res.status}: ${text}`);
    }
    return await res.json();
  };

  // Fetch clustering results
  const fetchClustering = async (playerId: string) => {
    const path = `/cluster/player/${playerId}`;
    setToolLoading(prev => ({ ...prev, [path]: true }));
    setToolError(prev => ({ ...prev, [path]: '' }));
    setPlayerClusterData(null);
    try {
      const res = await fetch(`${API_BASE}${path}`);
      if (!res.ok) throw new Error(`Failed to fetch clustering data: ${res.statusText}`);
      const data = await res.json();
      setPlayerClusterData(data);
    } catch (e: any) {
      setToolError(prev => ({ ...prev, [path]: e?.message || 'Request failed' }));
    } finally {
      setToolLoading(prev => ({ ...prev, [path]: false }));
    }
  };

  // Fetch prediction results
  const fetchPrediction = async (matchId: string) => {
    const path = `/predict/match/${matchId}`;
    setToolLoading(prev => ({ ...prev, [path]: true }));
    setToolError(prev => ({ ...prev, [path]: '' }));
    setPredictionData(null);
    try {
      const res = await fetch(`${API_BASE}${path}`);
      if (!res.ok) throw new Error(`Failed to fetch prediction data: ${res.statusText}`);
      const data = await res.json();
      setPredictionData(data);
    } catch (e: any) {
      setToolError(prev => ({ ...prev, [path]: e?.message || 'Request failed' }));
    } finally {
      setToolLoading(prev => ({ ...prev, [path]: false }));
    }
  };

  // Fetch all teams for prediction dropdown
  const fetchAllTeams = async () => {
    try {
      const res = await fetch(`${API_BASE}/predict/teams`);
      if (res.ok) {
        const data = await res.json();
        setAllTeams(data.teams.map((t: any) => t.team));
      }
    } catch (e) {
      console.error('Error fetching teams:', e);
    }
  };

  // Fetch match prediction
  const fetchMatchPredict = async (home: string, away: string) => {
    setPredLoading(true);
    setPredError('');
    setPredResult(null);
    try {
      const res = await fetch(`${API_BASE}/predict/match?home_team=${encodeURIComponent(home)}&away_team=${encodeURIComponent(away)}`);
      if (!res.ok) throw new Error(`Prediction failed: ${res.statusText}`);
      const data = await res.json();
      setPredResult(data);
    } catch (e: any) {
      setPredError(e?.message || 'Prediction request failed');
    } finally {
      setPredLoading(false);
    }
  };

  // Fetch tournament odds
  const fetchTournamentOdds = async () => {
    setTournamentOddsLoading(true);
    setTournamentOddsError('');
    setTournamentOdds(null);
    try {
      const res = await fetch(`${API_BASE}/predict/tournament`);
      if (!res.ok) throw new Error(`Failed to load tournament odds: ${res.statusText}`);
      const data = await res.json();
      setTournamentOdds(data);
    } catch (e: any) {
      setTournamentOddsError(e?.message || 'Failed to load tournament odds');
    } finally {
      setTournamentOddsLoading(false);
    }
  };

  // Fetch tactical breakdown results
  const fetchTacticalBreakdown = async (matchId: string) => {
    const path = `/tactical/match/${matchId}`;
    setToolLoading(prev => ({ ...prev, [path]: true }));
    setToolError(prev => ({ ...prev, [path]: '' }));
    setBreakdownData(null);
    try {
      const res = await fetch(`${API_BASE}${path}`);
      if (!res.ok) throw new Error(`Failed to fetch tactical breakdown: ${res.statusText}`);
      const data = await res.json();
      setBreakdownData(data);
    } catch (e: any) {
      setToolError(prev => ({ ...prev, [path]: e?.message || 'Request failed' }));
    } finally {
      setToolLoading(prev => ({ ...prev, [path]: false }));
    }
  };

  // Fetch match highlights
  const fetchHighlights = async (matchId: string) => {
    const path = `/highlights/match/${matchId}`;
    setToolLoading(prev => ({ ...prev, [path]: true }));
    setToolError(prev => ({ ...prev, [path]: '' }));
    setHighlightsData([]);
    try {
      const res = await fetch(`${API_BASE}${path}`);
      if (!res.ok) throw new Error(`Failed to fetch highlights: ${res.statusText}`);
      const data = await res.json();
      setHighlightsData(data.highlights || []);
    } catch (e: any) {
      setToolError(prev => ({ ...prev, [path]: e?.message || 'Request failed' }));
    } finally {
      setToolLoading(prev => ({ ...prev, [path]: false }));
    }
  };

  // Re-load data when route/selection changes
  useEffect(() => {
    if (currentPath === '/players' && selectedPlayer) {
      fetchClustering(selectedPlayer);
    } else if (currentPath === '/analyst') {
      if (matches.length === 0) fetchMatches();
      if (selectedMatchId) {
        fetchAnalystTactical();
        fetchTacticalBreakdown(selectedMatchId);
      }
    } else if (currentPath === '/highlights' && selectedMatchId) {
      fetchHighlights(selectedMatchId);
    }
  }, [currentPath, selectedPlayer, selectedMatchId]);

  // Fetch dashboard data based on active tab and selected group
  useEffect(() => {
    if (currentPath !== '/dashboard') return;

    // Always fetch matches for fixtures
    if (activeTab === 'fixtures') {
      if (matches.length === 0) fetchMatches();
    }

    // Fetch standings for table tab (overview has its own now)
    if (activeTab === 'table') {
      fetchStandings(selectedGroup);
    }

    // Fetch player stats for player-stats tab
    if (activeTab === 'player-stats') {
      if (!playerStats) fetchPlayerStats();
    }

    // Fetch tactics snapshot
    if (activeTab === 'tactics') {
      fetchTactics();
    }

    // Fetch team forms for team-stats tab (fetch for all teams in standings)
    if (activeTab === 'team-stats') {
      if (standings.length > 0) {
        standings.forEach(standing => {
          const teamKey = standing.team.code || standing.team.id;
          if (!teamForms[teamKey]) {
            fetchTeamForm(teamKey);
          }
        });
      } else {
        fetchStandings(selectedGroup); // first get standings to get team IDs
      }
    }
  }, [currentPath, activeTab, selectedGroup]);

  // Handle chat submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput;
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const cleanText = userText.toLowerCase();
      let reply = '';
      let path = '';
      let toolName = '';

      if (cleanText.includes('cluster') || cleanText.includes('type of player') || cleanText.includes('similar to')) {
        toolName = 'player_style_cluster';
        const targetPlayer = players.find(p => cleanText.includes(p.name.toLowerCase())) || players[0];
        path = `/cluster/player/${targetPlayer.player_id}`;
      } else if (cleanText.includes('breakdown') || cleanText.includes('tactical') || cleanText.includes('tactics')) {
        toolName = 'tactical_breakdown';
        path = `/tactical/match/${selectedMatchId}`;
      } else       if (cleanText.includes('highlight') || cleanText.includes('video') || cleanText.includes('clip')) {
        toolName = 'generate_highlights';
        path = `/highlights/match/${selectedMatchId}`;
      } else if (cleanText.includes('snapshot') || cleanText.includes('tactical image') || cleanText.includes('position map') || (cleanText.includes('player') && cleanText.includes('position'))) {
        toolName = 'tactical_snapshot';
        path = `/tactics/snapshot`;
      }

      if (toolName) {
        setMessages(prev => [...prev, {
          sender: 'system',
          text: `INVOKING_TOOL: ${toolName}()`
        }]);

        try {
          const result = await authenticatedFetch(`${API_BASE}${path}`);
          reply = `MCP_TOOL_EXECUTION :: SUCCESS\n\n`;
          if (toolName === 'player_style_cluster') {
            reply += `Player Similarity Report for **${result.player.name}**:\n`;
            reply += `- Archetype: ${result.player.archetype}\n`;
            reply += `- Silhouette Confidence: ${result.silhouette_score.toFixed(3)}\n\n`;
            reply += `Nearest Similar Players:\n`;
            result.similar_players.forEach((p: any) => {
              reply += `• ${p.name} (${p.position}) — Value: €${p.market_value_m}M (Dist: ${p.similarity_distance.toFixed(2)})\n`;
            });
          } else if (toolName === 'tactical_breakdown') {
            reply += `Tactical Breakdown:\n${result.tactical_breakdown}`;
          } else if (toolName === 'generate_highlights') {
            reply += `Highlights generation successful. Found ${result.highlights.length} events inside the audio telemetry.`;
          } else if (toolName === 'tactical_snapshot') {
            const caption = result.caption || "Tactical snapshot generated.";
            const imageUrl = `${API_BASE}${result.image_url}`;
            setMessages(prev => [...prev, { sender: 'assistant', text: caption, imageUrl }]);
            return;
          }

          setMessages(prev => [...prev, { sender: 'assistant', text: reply }]);
        } catch (err: any) {
          setMessages(prev => [...prev, { sender: 'system', text: `MCP_TOOL_EXECUTION :: FAILED\nReason: ${err.message}` }]);
        }
      } else {
          if (cleanText.includes('hello') || cleanText.includes('hi')) {
          reply = "HELLO. STANDING BY FOR World Cup telemetry analysis. Ask about player clustering, tactical breakdowns, or match data.";
        } else if (cleanText.includes('match') || cleanText.includes('fixture') || cleanText.includes('score')) {
          if (matches.length > 0) {
            const recent = [...matches].sort((a, b) => ((b.date||'') > (a.date||'') ? 1 : -1)).slice(0, 5);
            reply = recent.map(m => `Match ${m.match_id}: ${m.home_team.name} ${m.score.home} - ${m.score.away} ${m.away_team.name} (${m.status})`).join('\n');
            reply += "\n\nAsk 'tactical breakdown' to invoke AI tools.";
          } else {
            reply = "Fetching match data... try asking for 'standings' or browse the Dashboard tab.";
          }
        } else if (cleanText.includes('standing') || cleanText.includes('group')) {
          if (standings.length > 0) {
            reply = standings.map((s: any) => `${s.position}. ${s.team.name} - ${s.points} pts`).join('\n');
          } else {
            reply = "Standings data not loaded yet. Try the Dashboard tab.";
          }
        } else {
          reply = "UNDERSTOOD. Try asking for 'player similarity to Erling Haaland', 'tactical breakdown', or 'match standings'.";
        }
        setTimeout(() => {
          setMessages(prev => [...prev, { sender: 'assistant', text: reply }]);
        }, 800);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div ref={pageContainerRef} className="min-h-screen bg-[#0E0E0E] text-[#ECEAE3] relative font-jetbrains selection:bg-[#D9622B]/30 flex flex-col">
      {/* Film Grain Filter */}
      <svg className="absolute w-0 h-0 pointer-events-none">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>
      <div className="fixed inset-0 pointer-events-none opacity-[0.04] z-50 bg-repeat" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />

      {/* Global Background Elements */}
      <div className="fixed inset-0 bg-[#0E0E0E] z-0" />
      <div className="fixed top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#D9622B]/2 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Route transition sweep curtain */}
      <div
        ref={transitionSweepRef}
        style={{ display: isTransitioning ? 'block' : 'none' }}
        className="fixed top-0 left-0 w-full h-full bg-[#D9622B] z-50 pointer-events-none transition-curtain"
      />

      {/* Sticky Header Navigation */}
      {currentPath !== '/' && (
        <header className="fixed top-0 left-0 w-full h-16 border-b border-[#2A2A28] bg-[#0E0E0E]/80 backdrop-blur-md z-60 px-6 md:px-12 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigate('/')}>
            <img src={logoMark} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-syncopate text-[0.8rem] tracking-widest font-bold hidden sm:inline-block">FULL BACK</span>
          </div>

          <nav className="flex items-center gap-1 sm:gap-6">
            <button
              onClick={() => handleNavigate('/')}
              className={`text-[0.7rem] uppercase tracking-widest font-semibold px-2 py-1.5 transition relative ${currentPath === '/' ? 'text-[#D9622B]' : 'text-[#8B8A85] hover:text-[#ECEAE3]'}`}
            >
              HOME
              {currentPath === '/' && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#D9622B]" />}
            </button>
            <button
              onClick={() => handleNavigate('/dashboard')}
              className={`text-[0.7rem] uppercase tracking-widest font-semibold px-2 py-1.5 transition relative ${currentPath === '/dashboard' ? 'text-[#D9622B]' : 'text-[#8B8A85] hover:text-[#ECEAE3]'}`}
            >
              DASHBOARD
              {currentPath === '/dashboard' && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#D9622B]" />}
            </button>
            <button
              onClick={() => handleNavigate('/analyst')}
              className={`text-[0.7rem] uppercase tracking-widest font-semibold px-2 py-1.5 transition relative ${currentPath === '/analyst' ? 'text-[#D9622B]' : 'text-[#8B8A85] hover:text-[#ECEAE3]'}`}
            >
              ANALYST
              {currentPath === '/analyst' && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#D9622B]" />}
            </button>
            <button
              onClick={() => handleNavigate('/players')}
              className={`text-[0.7rem] uppercase tracking-widest font-semibold px-2 py-1.5 transition relative ${currentPath === '/players' ? 'text-[#D9622B]' : 'text-[#8B8A85] hover:text-[#ECEAE3]'}`}
            >
              PLAYERS
              {currentPath === '/players' && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#D9622B]" />}
            </button>
            <button
              onClick={() => handleNavigate('/predictions')}
              className={`text-[0.7rem] uppercase tracking-widest font-semibold px-2 py-1.5 transition relative ${currentPath === '/predictions' ? 'text-[#D9622B]' : 'text-[#8B8A85] hover:text-[#ECEAE3]'}`}
            >
              PREDICTIONS
              {currentPath === '/predictions' && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#D9622B]" />}
            </button>
            <button
              onClick={() => handleNavigate('/highlights')}
              className={`text-[0.7rem] uppercase tracking-widest font-semibold px-2 py-1.5 transition relative ${currentPath === '/highlights' ? 'text-[#D9622B]' : 'text-[#8B8A85] hover:text-[#ECEAE3]'}`}
            >
              HIGHLIGHTS
              {currentPath === '/highlights' && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#D9622B]" />}
            </button>
          </nav>
        </header>
      )}

      {/* Main Content Body */}
      <main className={`flex-grow z-10 flex flex-col relative ${currentPath === '/' ? 'pt-0' : 'pt-16'}`}>

        {/* 1. HOME PATH */}
        {currentPath === '/' && (
          <div className="hero-root">

            {/* SVG grain filter */}
            <svg style={{position:'absolute',width:0,height:0}}>
              <filter id="grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
                <feColorMatrix type="saturate" values="0" />
              </filter>
            </svg>

            {/* Fixed backdrop */}
            <div className="hero-backdrop" />
            <div className="hero-grain" style={{filter:'url(#grain)'}} />

            {/* Interface grid (z-10) */}
            <div className="hero-interface">
              <div className="hero-topbar">
                <div className="flex items-center gap-3">
                  <img src={logoMark} alt="" className="w-7 h-7 object-contain" />
                  <span className="font-syncopate text-[0.72rem] tracking-[0.22em] font-bold uppercase text-[#ECEAE3]">FULL BACK</span>
                </div>
                <div className="mono text-[0.58rem] text-[#D9622B] text-right leading-relaxed select-none hidden md:flex flex-col items-end">
                  <span>LATITUDE: 41.8623° N</span>
                  <span>FLOODLIGHT: 4000K</span>
                </div>
              </div>

              <div className="hero-body">
                <div className="hero-title-block">
                  <h1 className="hero-title font-syncopate uppercase select-none">
                    EMPTY<br />GRIDIRON
                  </h1>
                </div>
              </div>
              <div className="hero-bottombar">
                <div className="select-none">
                  <div className="mono text-[0.62rem] text-[#D9622B] tracking-widest mb-0.5">[ SEASON 2026 — NIGHT MATCH ]</div>
                  <div className="mono text-[0.62rem] text-[#8B8A85] tracking-wider">SILENT GRIDIRON &amp; STADIUM LIGHT AT REST</div>
                </div>
                <button
                  onClick={() => handleNavigate('/dashboard')}
                  className="hero-cta"
                >
                  ENTER THE FIELD →
                </button>
              </div>
            </div>

            {/* 3D canvas (z-5) */}
            <div className="hero-viewport">
              <div ref={tiltWrapRef} className="canvas-3d" style={{ willChange: 'transform' }}>
                <div className="layer layer-1" />
                <div className="layer layer-2" />
                <div className="layer layer-3" />
                <svg className="pitch-lines" viewBox="0 0 1050 680" preserveAspectRatio="none" fill="none" stroke="rgba(236,234,227,0.55)" strokeWidth="1.2">
                  <rect x="20" y="20" width="1010" height="640" rx="2" />
                  <line x1="525" y1="20" x2="525" y2="660" />
                  <circle cx="525" cy="340" r="80" />
                  <circle cx="525" cy="340" r="2" fill="rgba(236,234,227,0.7)" />
                  <rect x="20" y="170" width="140" height="340" />
                  <rect x="20" y="250" width="50" height="180" />
                  <circle cx="110" cy="340" r="2" fill="rgba(236,234,227,0.7)" />
                  <path d="M160 280 A 70 70 0 0 1 160 400" />
                  <rect x="890" y="170" width="140" height="340" />
                  <rect x="980" y="250" width="50" height="180" />
                  <circle cx="940" cy="340" r="2" fill="rgba(236,234,227,0.7)" />
                  <path d="M890 280 A 70 70 0 0 0 890 400" />
                  <path d="M20 40 A 20 20 0 0 0 40 20" />
                  <path d="M1010 40 A 20 20 0 0 1 1030 20" />
                  <path d="M20 640 A 20 20 0 0 1 40 660" />
                  <path d="M1010 640 A 20 20 0 0 0 1030 660" />
                </svg>
                <div className="contours" />
              </div>
            </div>

            {/* Scroll hint */}
            <div className="scroll-hint" />
          </div>
        )}


        {/* 2. DASHBOARD PATH */}
        {currentPath === '/dashboard' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-8 animate-fade-in flex-grow">
            <div className="border-b border-[#2A2A28] pb-4 flex justify-between items-end">
              <div>
                <span className="mono text-[0.65rem] text-[#D9622B] tracking-widest block mb-1">[ STAGE_GROUP_A_&_B ]</span>
                <h1 className="font-syncopate text-[1.2rem] md:text-[1.5rem] font-bold tracking-widest text-[#ECEAE3]">LIVE SCORES &amp; STANDINGS</h1>
              </div>
              <span className="mono text-[0.6rem] text-neutral-500">REFRESHED: 15/07/2026 LIVE TELEMETRY</span>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-[#2A2A28]">
              <nav role="tablist" className="flex gap-8">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'table', label: 'Table' },
                  { id: 'fixtures', label: 'Fixtures' },
                  { id: 'player-stats', label: 'Player Stats' },
                  { id: 'team-stats', label: 'Team Stats' },
                  { id: 'tactics', label: 'Tactics' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`pb-3 text-[0.75rem] uppercase tracking-widest font-semibold transition-colors relative ${
                      activeTab === tab.id
                        ? 'text-[#D9622B]'
                        : 'text-[#8B8A85] hover:text-[#ECEAE3]'
                    }`}
                  >
                    {tab.label}
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#D9622B]" />
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <OverviewSection />
              )}

              {/* Table Tab */}
              {activeTab === 'table' && (
                <div className="space-y-6">
                  {/* Stage Selector — groups + knockout rounds */}
                  <div className="flex flex-wrap gap-2">
                    {'ABCDEFGHIJKL'.split('').map((g) => (
                      <button
                        key={g}
                        onClick={() => setSelectedGroup(g)}
                        className={`mono text-[0.7rem] px-3 py-1.5 rounded border transition-colors ${
                          selectedGroup === g
                            ? 'border-[#D9622B] bg-[#D9622B]/10 text-[#D9622B]'
                            : 'border-[#2A2A28] text-[#8B8A85] hover:border-[#ECEAE3] hover:text-[#ECEAE3]'
                        }`}
                      >
                        GROUP {g}
                      </button>
                    ))}
                    {[{ id: 'QF', label: 'QF' }, { id: 'SF', label: 'SF' }, { id: 'F', label: 'FINAL' }].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedGroup(item.id)}
                        className={`mono text-[0.7rem] px-3 py-1.5 rounded border transition-colors ${
                          selectedGroup === item.id
                            ? 'border-[#D9622B] bg-[#D9622B]/10 text-[#D9622B]'
                            : 'border-[#2A2A28] text-[#8B8A85] hover:border-[#ECEAE3] hover:text-[#ECEAE3]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* Table content: standings for groups, match list for knockout */}
                  {(() => {
                    const isGroup = selectedGroup.length === 1;

                    if (isGroup) {
                      return (
                        <>
                          {dashboardLoading[`standings-${selectedGroup}`] ? (
                            <LoadingState label="Loading standings..." />
                          ) : dashboardError[`standings-${selectedGroup}`] ? (
                            <ErrorState message={dashboardError[`standings-${selectedGroup}`]} onRetry={() => fetchStandings(selectedGroup)} />
                          ) : (
                            <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6">
                              <table className="w-full text-left mono text-[0.7rem] text-neutral-300">
                                <thead>
                                  <tr className="text-neutral-500 border-b border-[#2A2A28]">
                                    <th className="py-2">POS</th>
                                    <th className="py-2">TEAM</th>
                                    <th className="py-2 text-center">P</th>
                                    <th className="py-2 text-center">W</th>
                                    <th className="py-2 text-center">D</th>
                                    <th className="py-2 text-center">L</th>
                                    <th className="py-2 text-center">GF</th>
                                    <th className="py-2 text-center">GA</th>
                                    <th className="py-2 text-center">GD</th>
                                    <th className="py-2 text-right">PTS</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#2A2A28]/50">
                                  {standings.map((standing) => (
                                    <tr key={standing.team.id} className="hover:bg-neutral-900/30">
                                      <td className="py-2.5 text-[#D9622B]">{standing.position}</td>
                                      <td className="py-2.5 font-semibold text-white">
                                        {standing.team.flag} {standing.team.name}
                                      </td>
                                      <td className="py-2.5 text-center">{standing.played}</td>
                                      <td className="py-2.5 text-center">{standing.won}</td>
                                      <td className="py-2.5 text-center">{standing.drawn}</td>
                                      <td className="py-2.5 text-center">{standing.lost}</td>
                                      <td className="py-2.5 text-center">{standing.goals_for}</td>
                                      <td className="py-2.5 text-center">{standing.goals_against}</td>
                                      <td className="py-2.5 text-center">
                                        {standing.goals_for - standing.goals_against > 0 ? '+' : ''}
                                        {standing.goals_for - standing.goals_against}
                                      </td>
                                      <td className="py-2.5 text-right font-bold">{standing.points}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </>
                      );
                    }

                    const stageMap: Record<string, string> = { QF: 'QUARTER_FINALS', SF: 'SEMI_FINALS', F: 'FINAL' };
                    const stageTarget = stageMap[selectedGroup];
                    const stageMatches = matches.filter((m) => m.stage === stageTarget);

                    return (
                      <div className="space-y-4">
                        {stageMatches.length === 0 ? (
                          <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-8 text-center">
                            <span className="mono text-[0.65rem] text-neutral-500">
                              No matches found for {selectedGroup === 'F' ? 'the Final' : selectedGroup === 'SF' ? 'Semi-Finals' : 'Quarter-Finals'}.
                            </span>
                          </div>
                        ) : (
                          [...stageMatches]
                            .sort((a, b) => (b.date||'').localeCompare(a.date||''))
                            .map((match) => (
                              <div
                                key={match.match_id}
                                className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6 hover:bg-[#171715]/60 transition-colors cursor-pointer"
                                onClick={() => handleMatchClick(match.match_id)}
                              >
                                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                  <div className="flex items-center gap-6">
                                    <span className="mono text-[0.75rem] text-[#D9622B] font-bold">[ {match.match_id} ]</span>
                                    <div>
                                      <div className="flex items-center gap-4 text-[0.95rem] font-semibold text-white">
                                        <span>{match.home_team.flag} {match.home_team.name}</span>
                                        <span className="text-neutral-500">vs</span>
                                        <span>{match.away_team.flag} {match.away_team.name}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-6">
                                    <div className="mono text-xl font-bold text-[#D9622B] border border-[#D9622B]/20 bg-[#D9622B]/5 px-4 py-2 rounded">
                                      {match.score.home} - {match.score.away}
                                    </div>
                                    <span className={`mono text-[0.65rem] px-2 py-0.5 rounded ${
                                      match.status === 'Finished'
                                        ? 'bg-neutral-700 text-neutral-300'
                                        : 'bg-[#D9622B]/20 text-[#D9622B] animate-pulse'
                                    }`}>
                                      {match.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Fixtures Tab */}
              {activeTab === 'fixtures' && (
                <div className="space-y-6">
                  {dashboardLoading['matches'] ? (
                    <LoadingState label="Loading fixtures..." />
                  ) : dashboardError['matches'] ? (
                    <ErrorState message={dashboardError['matches']} onRetry={fetchMatches} />
                  ) : (
                    <div className="space-y-4">
                      {[...matches].sort((a, b) => (b.date||'').localeCompare(a.date||'')).map((match) => (
                        <div
                          key={match.match_id}
                          className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6 hover:bg-[#171715]/60 transition-colors cursor-pointer"
                          onClick={() => handleMatchClick(match.match_id)}
                        >
                          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex items-center gap-6">
                              <span className="mono text-[0.75rem] text-[#D9622B] font-bold">[ {match.match_id} ]</span>
                              <div>
                                <div className="flex items-center gap-4 text-[0.95rem] font-semibold text-white">
                                  <span>{match.home_team.flag} {match.home_team.name}</span>
                                  <span className="text-neutral-500">vs</span>
                                  <span>{match.away_team.flag} {match.away_team.name}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="mono text-xl font-bold text-[#D9622B] border border-[#D9622B]/20 bg-[#D9622B]/5 px-4 py-2 rounded">
                                {match.score.home} - {match.score.away}
                              </div>
                              <div className="flex flex-col items-end">
                                <span className={`mono text-[0.65rem] px-2 py-0.5 rounded ${
                                  match.status === 'Finished'
                                    ? 'bg-neutral-700 text-neutral-300'
                                    : 'bg-[#D9622B]/20 text-[#D9622B] animate-pulse'
                                }`}>
                                  {match.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Player Stats Tab */}
              {activeTab === 'player-stats' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Top Scorers */}
                  <div className="space-y-4">
                    <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase">[ TOP_SCORERS ]</h3>
                    {dashboardLoading['player-stats'] ? (
                      <LoadingState label="Loading player stats..." />
                    ) : dashboardError['player-stats'] ? (
                      <ErrorState message={dashboardError['player-stats']} onRetry={fetchPlayerStats} />
                    ) : playerStats ? (
                      <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-4">
                        <table className="w-full text-left mono text-[0.7rem] text-neutral-300">
                          <thead>
                            <tr className="text-neutral-500 border-b border-[#2A2A28]">
                              <th className="py-2">#</th>
                              <th className="py-2">PLAYER</th>
                              <th className="py-2 text-right">GOALS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2A2A28]/50">
                            {playerStats.top_scorers.slice(0, 10).map((player, index) => (
                              <tr
                                key={player.player_id}
                                className="hover:bg-neutral-900/30 cursor-pointer"
                                onClick={() => {
                                  setSelectedPlayer(player.player_id);
                                  handleNavigate('/players');
                                }}
                              >
                                <td className="py-2.5 text-[#D9622B]">{index + 1}</td>
                                <td className="py-2.5 font-semibold text-white">{player.name}</td>
                                <td className="py-2.5 text-right font-bold">{player.goals}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>

                  {/* Top Assists */}
                  <div className="space-y-4">
                    <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase">[ TOP_ASSISTS ]</h3>
                    {dashboardLoading['player-stats'] ? (
                      <LoadingState label="Loading player stats..." />
                    ) : dashboardError['player-stats'] ? (
                      <ErrorState message={dashboardError['player-stats']} onRetry={fetchPlayerStats} />
                    ) : playerStats ? (
                      <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-4">
                        <table className="w-full text-left mono text-[0.7rem] text-neutral-300">
                          <thead>
                            <tr className="text-neutral-500 border-b border-[#2A2A28]">
                              <th className="py-2">#</th>
                              <th className="py-2">PLAYER</th>
                              <th className="py-2 text-right">ASSISTS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2A2A28]/50">
                            {playerStats.top_assists.slice(0, 10).map((player, index) => (
                              <tr
                                key={player.player_id}
                                className="hover:bg-neutral-900/30 cursor-pointer"
                                onClick={() => {
                                  setSelectedPlayer(player.player_id);
                                  handleNavigate('/players');
                                }}
                              >
                                <td className="py-2.5 text-[#D9622B]">{index + 1}</td>
                                <td className="py-2.5 font-semibold text-white">{player.name}</td>
                                <td className="py-2.5 text-right font-bold">{player.assists}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Team Stats Tab */}
              {activeTab === 'team-stats' && (
                <div className="space-y-6">
                  <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase">[ TEAM_FORM ]</h3>
                  {dashboardLoading[`standings-${selectedGroup}`] ? (
                    <LoadingState label="Loading team stats..." />
                  ) : dashboardError[`standings-${selectedGroup}`] ? (
                    <ErrorState message={dashboardError[`standings-${selectedGroup}`]} onRetry={() => fetchStandings(selectedGroup)} />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {standings.map((standing) => {
                        const teamKey = standing.team.code || standing.team.id;
                        const teamForm = teamForms[teamKey];
                        return (
                          <div key={teamKey} className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <span className="text-3xl">{standing.team.flag}</span>
                              <div>
                                <h4 className="font-syncopate text-[0.9rem] font-bold text-white">{standing.team.name}</h4>
                                <div className="mono text-[0.65rem] text-neutral-500 mt-1">{teamForm?.form || '---'}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-center mono text-[0.7rem]">
                              <div>
                                <div className="text-[#D9622B] font-bold text-lg">{teamForm?.goals_scored || 0}</div>
                                <div className="text-neutral-500">GOALS FOR</div>
                              </div>
                              <div>
                                <div className="text-white font-bold text-lg">{teamForm?.goals_conceded || 0}</div>
                                <div className="text-neutral-500">GOALS AGAINST</div>
                              </div>
                              <div>
                                <div className="text-[#8B8A85] font-bold text-lg">{teamForm?.clean_sheets || 0}</div>
                                <div className="text-neutral-500">CLEAN SHEETS</div>
                              </div>
                            </div>
                            {teamForm?.recent_matches && teamForm.recent_matches.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-[#2A2A28]/50">
                                <div className="mono text-[0.6rem] text-neutral-500 mb-2">RECENT MATCHES</div>
                                <div className="space-y-2">
                                  {teamForm.recent_matches.map((match, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-[0.65rem] mono">
                                      <span className="text-neutral-300">vs {match.opponent}</span>
                                      <span className={`font-semibold ${
                                        match.result === 'W' ? 'text-green-400' :
                                        match.result === 'L' ? 'text-red-400' : 'text-yellow-400'
                                      }`}>
                                        {match.score}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tactics Tab */}
              {activeTab === 'tactics' && (
                <div className="space-y-6">
                  <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase mb-4">[ TACTICAL_SNAPSHOT ]</h3>
                  {snapshotLoading ? (
                    <LoadingState label="Generating tactical snapshot..." />
                  ) : snapshotError ? (
                    <ErrorState message={snapshotError} onRetry={fetchTactics} />
                  ) : snapshotData ? (
                    <div className="space-y-4">
                      <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-4">
                        <img
                          src={`${API_BASE}${snapshotData.image_url}`}
                          alt="Tactical Snapshot"
                          className="w-full max-w-3xl mx-auto rounded"
                        />
                      </div>
                      <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-4">
                        <p className="mono text-[0.7rem] text-[#ECEAE3] leading-relaxed">{snapshotData.caption}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <button
                        onClick={fetchTactics}
                        className="mono text-[0.7rem] text-[#D9622B] border border-[#D9622B]/40 rounded px-4 py-2 hover:bg-[#D9622B]/10 transition-colors"
                      >
                        GENERATE SNAPSHOT
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. AI CHAT / ANALYST PATH */}
        {currentPath === '/analyst' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-8 animate-fade-in flex-grow flex flex-col">
            <div className="border-b border-[#2A2A28] pb-4 flex justify-between items-end">
              <div>
                <span className="mono text-[0.65rem] text-[#D9622B] tracking-widest block mb-1">[ TACTICAL_ANALYSIS_HUD ]</span>
                <h1 className="font-syncopate text-[1.2rem] md:text-[1.5rem] font-bold tracking-widest text-[#ECEAE3]">AI MATCH ANALYST</h1>
              </div>

              {/* Match selector */}
              <div className="flex items-center gap-2 max-w-[50%] overflow-x-auto">
                <span className="mono text-[0.6rem] text-neutral-500 uppercase tracking-widest mr-2 shrink-0">TARGET_ID:</span>
                {matches.length === 0 ? (
                  <span className="mono text-[0.6rem] text-neutral-600">Loading...</span>
                ) : (
                  [...matches].sort((a, b) => ((b.date||'') > (a.date||'') ? 1 : -1)).slice(0, 12).map(m => (
                    <button
                      key={m.match_id}
                      onClick={() => setSelectedMatchId(m.match_id)}
                      className={`mono text-[0.6rem] px-2 py-1 rounded border transition whitespace-nowrap ${selectedMatchId === m.match_id ? 'border-[#D9622B] text-[#D9622B] bg-[#D9622B]/5' : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'}`}
                    >
                      {m.home_team.code} vs {m.away_team.code}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Tactical Visualization panel */}
              <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6 flex flex-col justify-between relative overflow-hidden">
                <div>
                  <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase mb-4">[ TACTICAL_VISUALIZATION ]</h3>

                  {analystLoading ? (
                    <LoadingState label="RUNNING DETECTION PIPELINE..." />
                  ) : analystError ? (
                    <ErrorState message={analystError} onRetry={fetchAnalystTactical} />
                  ) : analystData ? (
                    <div className="space-y-4">
                      <img
                        src={`${API_BASE}${analystData.image_url}`}
                        alt="Tactical Analysis"
                        className="w-full rounded border border-[#2A2A28]"
                      />
                      <div className="space-y-2">
                        {analystData.formations && Object.entries(analystData.formations).map(([team, formation]) => (
                          <div key={team} className="flex items-center gap-3 text-[0.75rem] mono">
                            <span className={`font-bold ${team === '0' ? 'text-[#D9622B]' : 'text-[#5DA0FC]'}`}>
                              TEAM_{team === '0' ? 'A' : 'B'}
                            </span>
                            <span className="text-neutral-400">FORMATION:</span>
                            <span className="text-white font-semibold">{formation as string}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-[#2A2A28] pt-3">
                        <p className="text-[0.7rem] text-neutral-300 leading-relaxed font-jetbrains">
                          {analystData.caption}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-[#2A2A28] bg-black/20 rounded p-6 text-[0.75rem] text-neutral-400">
                      Tactical visualization not yet generated.
                    </div>
                  )}
                </div>

                <div className="border-t border-[#2A2A28] pt-4 mt-6">
                  <button
                    onClick={fetchAnalystTactical}
                    disabled={analystLoading}
                    className="mono text-[0.7rem] text-[#D9622B] border border-[#D9622B]/40 rounded px-4 py-2 hover:bg-[#D9622B]/10 transition-colors disabled:opacity-40 w-full"
                  >
                    {analystLoading ? 'RUNNING...' : analystData ? 'REFRESH ANALYSIS' : 'GENERATE ANALYSIS'}
                  </button>
                </div>
              </div>

              {/* Post-match Breakdown */}
              <div className="lg:col-span-2 border border-[#2A2A28] bg-[#171715]/40 rounded p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="flex-1 flex flex-col min-h-0">
                  <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase mb-4">[ POST_MATCH_TACTICAL_BREAKDOWN ]</h3>

                  {(() => {
                    const path = `/tactical/match/${selectedMatchId}`;
                    if (toolLoading[path]) return <LoadingState label="COMPILING TELEMETRY STATS..." />;
                    if (toolError[path]) {
                      return <ErrorState message={toolError[path]} onRetry={() => fetchTacticalBreakdown(selectedMatchId)} />;
                    }
                    if (!breakdownData) {
                      return (
                        <div className="border border-[#2A2A28] bg-black/20 rounded p-6 text-[0.75rem] text-neutral-400">
                          Tactical breakdown is not ready yet. Please wait for the analysis service or try again.
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-4 flex-grow overflow-y-auto max-h-[350px] pr-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-black/30 p-4 border border-[#2A2A28] rounded mb-4 text-[0.65rem] mono">
                          <div>
                            <div className="text-neutral-500 uppercase">POSSESSION</div>
                            <div className="text-white font-bold">{breakdownData.stats_snapshot.possession.home}% / {breakdownData.stats_snapshot.possession.away}%</div>
                          </div>
                          <div>
                            <div className="text-neutral-500 uppercase">SHOTS (ON_TARGET)</div>
                            <div className="text-white font-bold">{breakdownData.stats_snapshot.shots.home}({breakdownData.stats_snapshot.shots_on_target.home})</div>
                          </div>
                          <div>
                            <div className="text-neutral-500 uppercase">PASS_ACCURACY</div>
                            <div className="text-white font-bold">{breakdownData.stats_snapshot.pass_accuracy.home}%</div>
                          </div>
                          <div>
                            <div className="text-neutral-500 uppercase">CORNERS</div>
                            <div className="text-[#D9622B] font-bold">{breakdownData.stats_snapshot.corners.home} / {breakdownData.stats_snapshot.corners.away}</div>
                          </div>
                        </div>

                        <p className="text-[0.75rem] text-neutral-300 leading-relaxed font-jetbrains whitespace-pre-wrap">
                          {breakdownData.tactical_breakdown}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                <div className="border-t border-[#2A2A28] pt-4 mt-6 flex justify-between items-center">
                  <span className="mono text-[0.6rem] text-neutral-500">ANALYSIS_PIPELINE: READY</span>
                </div>
              </div>

            </div>

            {/* Chat Analyst HUD terminal */}
            <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6 flex flex-col justify-between min-h-[350px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase">[ ANALYST_CHAT_TERMINAL ]</h3>
                <span className="mono text-[0.6rem] text-neutral-500">SESSION: ACTIVE_SECURE</span>
              </div>

              <div className="flex-grow overflow-y-auto space-y-4 mb-4 pr-2 font-mono text-[0.7rem] max-h-[250px]">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`p-3 rounded border ${msg.sender === 'user' ? 'bg-black/30 border-[#2A2A28] text-[#ECEAE3]' : msg.sender === 'system' ? 'bg-[#D9622B]/5 border-[#D9622B]/20 text-[#D9622B]' : 'bg-neutral-900/40 border-[#2A2A28]/50 text-neutral-300'}`}>
                    <div className="text-[0.65rem] text-neutral-500 uppercase tracking-widest mb-1">
                      {msg.sender === 'user' ? 'USER_SHELL' : msg.sender === 'system' ? 'SYSTEM_LOG' : 'ANALYST_RESP'}
                    </div>
                    <div className="whitespace-pre-wrap font-jetbrains">{msg.text}</div>
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="Tactical Snapshot" className="mt-3 w-full rounded border border-[#2A2A28]" />
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="text-neutral-500 animate-pulse mono text-[0.65rem]">ANALYST IS COMPUTING...</div>
                )}
              </div>

              <form onSubmit={handleChatSubmit} className="flex gap-3">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="INTERROGATE FULL BACK (e.g. 'predict outcome' or 'similar to Christian Pulisic')..."
                  className="flex-grow bg-[#0E0E0E] border border-[#2A2A28] rounded px-4 py-2.5 text-[0.75rem] text-white focus:outline-none focus:border-[#D9622B] font-jetbrains"
                />
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="mono bg-[#D9622B] text-white px-6 py-2.5 hover:bg-[#D9622B]/90 transition tracking-wider text-[0.7rem] font-bold rounded cursor-pointer"
                >
                  SEND
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 4. PLAYER INSIGHTS PATH */}
        {currentPath === '/players' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-8 animate-fade-in flex-grow">
            <div className="border-b border-[#2A2A28] pb-4 flex justify-between items-end">
              <div>
                <span className="mono text-[0.65rem] text-[#D9622B] tracking-widest block mb-1">[ K-MEANS_CLUSTERING_Archetypes ]</span>
                <h1 className="font-syncopate text-[1.2rem] md:text-[1.5rem] font-bold tracking-widest text-[#ECEAE3]">PLAYER STYLE ANALYSIS</h1>
              </div>
              <span className="mono text-[0.6rem] text-neutral-500">COMPILER: SCIKIT-LEARN KMeans · K={clusterStats?.k ?? '?'}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Left Selector pane */}
              <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6 flex flex-col justify-between">
                <div>
                  <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase mb-4">[ TARGET_SELECTOR ]</h3>
                  <p className="mono text-[0.65rem] text-neutral-500 leading-relaxed mb-6">
                    SELECT A TARGET ATHLETE TO QUERY STYLE CORRELATION CENTROIDS.
                  </p>

                  <div className="space-y-2">
                    <label className="mono text-[0.6rem] text-neutral-400">PLAYER_ID_NAME:</label>
                    <select
                      value={selectedPlayer}
                      onChange={(e) => setSelectedPlayer(e.target.value)}
                      className="w-full bg-[#0E0E0E] border border-[#2A2A28] rounded px-3 py-2 text-[0.75rem] text-white focus:outline-none focus:border-[#D9622B] font-jetbrains"
                    >
                      {players.length > 0 ? (
                        players.map(p => (
                          <option key={p.player_id} value={p.player_id}>
                            {p.name} ({p.position})
                          </option>
                        ))
                      ) : (
                        <option>Loading player list...</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-[#2A2A28] mt-6">
                  <div className="mono text-[0.6rem] text-neutral-500 flex justify-between">
                    <span>SILHOUETTE_SCORE:</span>
                    <span className="text-[#D9622B] font-bold">{clusterStats?.silhouette_score?.toFixed(3) ?? '—'}</span>
                  </div>
                  <div className="mono text-[0.6rem] text-neutral-500 flex justify-between mt-1.5">
                    <span>ARCHETYPE_CLUSTERS:</span>
                    <span className="text-white">K={clusterStats?.k ?? '—'}</span>
                  </div>
                </div>
              </div>

              {/* Center results pane */}
              <div className="lg:col-span-2 border border-[#2A2A28] bg-[#171715]/40 rounded p-6 flex flex-col justify-between min-h-[300px]">
                {(() => {
                  const path = `/cluster/player/${selectedPlayer}`;
                  if (toolLoading[path]) {
                    return <LoadingState label="RETRIEVING MULTIVARIATE DATA..." className="flex-1" />;
                  }
                  if (toolError[path]) {
                    return <ErrorState message={toolError[path]} onRetry={() => fetchClustering(selectedPlayer)} />;
                  }
                  if (!playerClusterData) {
                    const selectedMeta = players.find((p) => p.player_id === selectedPlayer);
                    return (
                      <div className="border border-[#2A2A28] bg-black/20 rounded p-6 text-[0.75rem] text-neutral-400">
                        Player style analysis is being prepared for <span className="font-semibold text-white">{selectedMeta?.name || selectedPlayer}</span>.
                        Please retry in a moment if the data does not appear automatically.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-6 flex-grow flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start border-b border-[#2A2A28] pb-3">
                          <div>
                            <h2 className="text-[1.1rem] font-bold text-white uppercase">{playerClusterData.player.name}</h2>
                            <div className="mono text-[0.6rem] text-neutral-500 mt-1">
                              NAT: {playerClusterData.player.nationality.toUpperCase()} · POSITION: {playerClusterData.player.position.toUpperCase()}
                            </div>
                          </div>

                          <div className="mono text-[0.6rem] text-neutral-500">PLAYER_ANALYSIS: ACTIVE</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                          <div>
                            <div className="text-[0.6rem] text-neutral-500 uppercase tracking-widest font-semibold mb-2">ARCHETYPE_CENTROID</div>
                            <div className="border border-[#D9622B]/20 bg-[#D9622B]/5 rounded p-3 text-[0.75rem] font-bold text-[#D9622B] tracking-wide">
                              {playerClusterData.player.archetype.toUpperCase()}
                            </div>
                            <p className="mono text-[0.65rem] text-neutral-400 leading-relaxed mt-2.5">
                              Assigned from {playerClusterData.model?.k ?? '?'} clusters across {(playerClusterData.model?.features ?? []).length} dimensions (Goals, Assists, Key Passes, Tackles, Interceptions, Pass Acc. per 90).
                            </p>
                          </div>

                          <div>
                            <div className="text-[0.6rem] text-neutral-500 uppercase tracking-widest font-semibold mb-2">NEAREST_NEIGHBOR_MATRICES</div>
                            <div className="space-y-1.5">
                              {playerClusterData.similar_players.slice(0, 3).map((p: any) => (
                                <button
                                  type="button"
                                  key={p.player_id}
                                  onClick={() => setSelectedPlayer(p.player_id)}
                                  className="w-full flex justify-between items-center text-[0.7rem] bg-[#0E0E0E] border border-[#2A2A28] px-3 py-2 rounded hover:border-[#D9622B]/40 text-left"
                                >
                                  <span className="font-semibold text-white">{p.name}</span>
                                  <span className="mono text-[0.6rem] text-[#D9622B]">DIST: {p.similarity_distance.toFixed(3)}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-[#2A2A28] pt-4 flex justify-between items-center text-[0.65rem] mono text-neutral-500">
                        <span>VAL: €{playerClusterData.player.market_value_m}M</span>
                        <span>MIN: {playerClusterData.player.minutes_played}m</span>
                        <span>GOALS/90: {((playerClusterData.player.goals / playerClusterData.player.minutes_played) * 90).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* Interactive Scatter Plot */}
            <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6">
              <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase mb-4">[ PCA_2D_PROJECTION_MATRIX ]</h3>
              <div className="relative aspect-[21/9] w-full border border-[#2A2A28] bg-black/40 rounded overflow-hidden flex items-center justify-center">

                {players.length === 0 ? (
                  <span className="mono text-[0.65rem] text-neutral-500">LOADING PCA DIMENSION MAP...</span>
                ) : (
                  <svg className="w-full h-full" viewBox="0 0 1000 400">
                    <line x1="500" y1="0" x2="500" y2="400" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    <line x1="0" y1="200" x2="1000" y2="200" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

                    {players.map((p) => {
                      const px = p.pca_x || 0;
                      const py = p.pca_y || 0;
                      const cx = 500 + px * 90;
                      const cy = 200 - py * 90;
                      const isSelected = p.player_id === selectedPlayer;
                      const clusterIdx = p.cluster ?? 0;
                      const clusterColor = CLUSTER_COLORS[clusterIdx % CLUSTER_COLORS.length];

                      return (
                        <circle
                          key={p.player_id}
                          cx={cx}
                          cy={cy}
                          r={isSelected ? 6 : 2.5}
                          fill={isSelected ? '#D9622B' : clusterColor}
                          stroke={isSelected ? 'white' : 'transparent'}
                          strokeWidth={2}
                          className="cursor-pointer transition hover:r-5 opacity-75"
                          onClick={() => setSelectedPlayer(p.player_id)}
                          onMouseEnter={(e) => {
                            const rect = (e.target as SVGElement).closest('svg')?.getBoundingClientRect();
                            if (rect) setScatterTooltip({ player: p, x: e.clientX - rect.left, y: e.clientY - rect.top });
                          }}
                          onMouseMove={(e) => {
                            const rect = (e.target as SVGElement).closest('svg')?.getBoundingClientRect();
                            if (rect) setScatterTooltip(t => t ? { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
                          }}
                          onMouseLeave={() => setScatterTooltip(null)}
                        />
                      );
                    })}

                    {scatterTooltip && (
                      <g>
                        <rect
                          x={scatterTooltip.x + 12}
                          y={scatterTooltip.y - 20}
                          width={180}
                          height={38}
                          rx={4}
                          fill="black"
                          fillOpacity={0.85}
                          stroke="#D9622B"
                          strokeWidth={0.5}
                        />
                        <text x={scatterTooltip.x + 18} y={scatterTooltip.y - 4} fill="white" className="mono" fontSize="11" fontWeight="bold">
                          {scatterTooltip.player.name}
                        </text>
                        <text x={scatterTooltip.x + 18} y={scatterTooltip.y + 12} fill="#aaa" className="mono" fontSize="10">
                          {scatterTooltip.player.archetype || '—'}
                        </text>
                      </g>
                    )}

                    {(() => {
                      const target = players.find(p => p.player_id === selectedPlayer);
                      if (!target) return null;
                      const cx = 500 + (target.pca_x || 0) * 90;
                      const cy = 200 - (target.pca_y || 0) * 90;
                      return (
                        <g>
                          <circle cx={cx} cy={cy} r={14} fill="none" stroke="#D9622B" strokeWidth="1.5" className="animate-pulse" />
                          <text x={cx + 18} y={cy + 4} fill="white" className="mono text-[0.55rem] font-bold uppercase">{target.name}</text>
                        </g>
                      );
                    })()}
                  </svg>
                )}

                {/* Plot legend */}
                <div className="absolute bottom-4 left-4 flex flex-wrap gap-4 bg-black/80 border border-neutral-800 p-3 rounded max-w-[90%]">
                  {(clusterStats?.clusters ?? []).map((c) => (
                    <div key={c.cluster_id} className="flex items-center gap-1.5 text-[0.6rem] mono">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CLUSTER_COLORS[c.cluster_id % CLUSTER_COLORS.length] }} />
                      <span>{c.archetype.toUpperCase()}</span>
                    </div>
                  ))}
                  {!clusterStats && (
                    <>
                      <div className="flex items-center gap-1.5 text-[0.6rem] mono"><span className="w-2 h-2 bg-[#D9622B] rounded-full" /><span>ELITE GOALSCORER</span></div>
                      <div className="flex items-center gap-1.5 text-[0.6rem] mono"><span className="w-2 h-2 bg-[#6ba642] rounded-full" /><span>PLAYMAKER</span></div>
                      <div className="flex items-center gap-1.5 text-[0.6rem] mono"><span className="w-2 h-2 bg-[#3b82f6] rounded-full" /><span>BALL WINNER</span></div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. HIGHLIGHT DETECTOR PATH */}
        {currentPath === '/highlights' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-8 animate-fade-in flex-grow">
            <div className="border-b border-[#2A2A28] pb-4 flex justify-between items-end">
              <div>
                <span className="mono text-[0.65rem] text-[#D9622B] tracking-widest block mb-1">[ RMS_VOLUME_SPIKE_CLIPPER ]</span>
                <h1 className="font-syncopate text-[1.2rem] md:text-[1.5rem] font-bold tracking-widest text-[#ECEAE3]">HIGHLIGHT TELEMETRY</h1>
              </div>
              <span className="mono text-[0.6rem] text-neutral-500">HIGHLIGHT_DETECTOR: ACTIVE</span>
            </div>

            <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6">
              {(() => {
                const path = `/highlights/match/${selectedMatchId}`;
                if (toolLoading[path]) {
                  return <LoadingState label="EXTRACTING DECIBEL SPIKES..." className="py-20" />;
                }
                if (toolError[path]) {
                  return <ErrorState message={toolError[path]} onRetry={() => fetchHighlights(selectedMatchId)} />;
                }
                if (highlightsData.length === 0) {
                  return (
                    <div className="border border-[#2A2A28] bg-black/20 rounded p-6 text-[0.75rem] text-neutral-400">
                      Highlight telemetry is not available yet. Please retry or wait while the service prepares the match clip data.
                    </div>
                  );
                }
                return (
                  <div className="space-y-8">
                    <div className="flex justify-end">
                      <span className="mono text-[0.55rem] text-neutral-500">HIGHLIGHTS_STATUS: READY</span>
                    </div>
                    <div className="border border-[#2A2A28] bg-black/40 p-4 rounded">
                      <div className="mono text-[0.55rem] text-neutral-500 mb-2 uppercase">AUDIO_RMS_ENERGY (SPIKES LOCATED)</div>
                      <svg className="w-full h-16" viewBox="0 0 1000 64" preserveAspectRatio="none">
                        <path
                          d="M 0 32 L 50 28 L 100 35 L 150 20 L 180 8 L 220 30 L 300 27 L 400 33 L 500 25 L 580 6 L 650 28 L 750 31 L 820 9 L 900 29 L 1000 32"
                          fill="none"
                          stroke="rgba(217, 98, 43, 0.35)"
                          strokeWidth="1.5"
                        />
                        <circle cx="180" cy="12" r="4" fill="#D9622B" />
                        <line x1="180" y1="12" x2="180" y2="64" stroke="#D9622B" strokeDasharray="3,3" />
                        <circle cx="580" cy="8" r="4" fill="#D9622B" />
                        <line x1="580" y1="8" x2="580" y2="64" stroke="#D9622B" strokeDasharray="3,3" />
                        <circle cx="820" cy="10" r="4" fill="#D9622B" />
                        <line x1="820" y1="10" x2="820" y2="64" stroke="#D9622B" strokeDasharray="3,3" />
                      </svg>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {highlightsData.map((clip) => (
                        <div key={clip.id} className="border border-[#2A2A28] bg-[#0E0E0E] rounded overflow-hidden flex flex-col justify-between hover:border-[#D9622B]/30 transition">
                          <div className="relative aspect-video bg-neutral-900">
                            <video
                              src={clip.video_url}
                              controls
                              poster={clip.thumbnail_url}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-4 space-y-2">
                            <div className="flex justify-between items-center text-[0.65rem] mono text-neutral-500">
                              <span>TIMESTAMP: {intToTime(clip.timestamp)}</span>
                              <span>DURATION: {clip.duration}s</span>
                            </div>
                            <p className="text-[0.7rem] text-neutral-300 leading-relaxed font-jetbrains">
                              {clip.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* 5. PREDICTIONS PATH */}
        {currentPath === '/predictions' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-8 animate-fade-in flex-grow">
            <div className="border-b border-[#2A2A28] pb-4 flex justify-between items-end">
              <div>
                <span className="mono text-[0.65rem] text-[#D9622B] tracking-widest block mb-1">[ ELO_POISSON_MONTE_CARLO ]</span>
                <h1 className="font-syncopate text-[1.2rem] md:text-[1.5rem] font-bold tracking-widest text-[#ECEAE3]">PREDICTIONS</h1>
              </div>
              <span className="mono text-[0.6rem] text-neutral-500">MODE: PRECOMPUTED_STATIC</span>
            </div>

            {/* Match Predictor */}
            <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6">
              <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase mb-4">[ MATCH_PREDICTOR ]</h3>
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="mono text-[0.55rem] text-neutral-500 block mb-1">HOME TEAM</label>
                  <select
                    value={predHomeTeam}
                    onChange={e => setPredHomeTeam(e.target.value)}
                    className="w-full bg-[#0E0E0E] border border-[#2A2A28] rounded px-3 py-2 text-[0.75rem] text-[#ECEAE3] mono focus:outline-none focus:border-[#D9622B]"
                  >
                    <option value="">Select home team...</option>
                    {allTeams.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 w-full">
                  <label className="mono text-[0.55rem] text-neutral-500 block mb-1">AWAY TEAM</label>
                  <select
                    value={predAwayTeam}
                    onChange={e => setPredAwayTeam(e.target.value)}
                    className="w-full bg-[#0E0E0E] border border-[#2A2A28] rounded px-3 py-2 text-[0.75rem] text-[#ECEAE3] mono focus:outline-none focus:border-[#D9622B]"
                  >
                    <option value="">Select away team...</option>
                    {allTeams.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => fetchMatchPredict(predHomeTeam, predAwayTeam)}
                  disabled={!predHomeTeam || !predAwayTeam || predLoading}
                  className="mono text-[0.7rem] text-white bg-[#D9622B] rounded px-6 py-2 hover:bg-[#D9622B]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {predLoading ? 'COMPUTING...' : 'PREDICT'}
                </button>
              </div>

              {predError && (
                <div className="mt-4 border border-red-900/50 bg-red-900/10 rounded p-3">
                  <span className="mono text-[0.65rem] text-red-400">{predError}</span>
                </div>
              )}

              {predResult && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-center gap-6 py-3">
                    <div className="text-center font-syncopate text-[0.85rem] text-white font-bold">{predResult.home_team}</div>
                    <span className="mono text-[0.6rem] text-neutral-500">vs</span>
                    <div className="text-center font-syncopate text-[0.85rem] text-white font-bold">{predResult.away_team}</div>
                  </div>
                  <div className="flex gap-4">
                    {[
                      { key: 'home_win_pct', label: `${predResult.home_team} WIN`, color: '#D9622B' },
                      { key: 'draw_pct', label: 'DRAW', color: '#eab308' },
                      { key: 'away_win_pct', label: `${predResult.away_team} WIN`, color: '#8B8A85' },
                    ].map(({ key, label, color }) => (
                      <div key={key} className="flex-1 border border-[#2A2A28] rounded p-3 bg-[#0E0E0E]/60">
                        <div className="mono text-[0.55rem] text-neutral-500 uppercase mb-1">{label}</div>
                        <div className="mono text-xl font-bold mb-2" style={{ color }}>{predResult[key]}%</div>
                        <div className="h-2 bg-neutral-900 rounded overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${predResult[key]}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[#2A2A28] pt-3 mt-2">
                    <div className="grid grid-cols-2 gap-4 text-[0.65rem] mono">
                      <div><span className="text-neutral-500">Expected Goals:</span> <span className="text-[#D9622B]">{predResult.home_team} {predResult.expected_goals?.home}</span> - <span className="text-neutral-400">{predResult.expected_goals?.away} {predResult.away_team}</span></div>
                      <div><span className="text-neutral-500">Elo Rating:</span> <span className="text-white">{predResult.elo_home}</span> vs <span className="text-white">{predResult.elo_away}</span></div>
                      <div><span className="text-neutral-500">Simulations:</span> <span className="text-white">{predResult.n_simulations?.toLocaleString()}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tournament Odds */}
            <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase">[ TOURNAMENT_ODDS ]</h3>
                {tournamentOdds && (
                  <span className="mono text-[0.55rem] text-neutral-500">{tournamentOdds.total_simulations?.toLocaleString()} simulations</span>
                )}
              </div>
              {tournamentOddsLoading ? (
                <LoadingState label="Loading tournament odds..." />
              ) : tournamentOddsError ? (
                <ErrorState message={tournamentOddsError} onRetry={fetchTournamentOdds} />
              ) : tournamentOdds ? (
                <div className="max-h-[600px] overflow-y-auto space-y-1">
                  {Object.entries(tournamentOdds.teams as Record<string, any>)
                    .sort(([, a]: any, [, b]: any) => b.title_pct - a.title_pct)
                    .map(([team, odds]: [string, any], idx) => (
                      <div key={team} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-[#2A2A28]/30 transition-colors">
                        <span className="mono text-[0.6rem] text-neutral-500 w-6 text-right">{idx + 1}</span>
                        <span className="mono text-[0.7rem] text-white font-semibold w-28 truncate">{team}</span>
                        <div className="flex-1 flex items-center gap-1">
                          <div className="flex-1 h-3 bg-neutral-900 rounded overflow-hidden">
                            <div className="h-full bg-[#D9622B] rounded" style={{ width: `${odds.title_pct}%` }} />
                          </div>
                          <span className="mono text-[0.65rem] text-[#D9622B] font-bold w-12 text-right">{odds.title_pct}%</span>
                        </div>
                        <div className="hidden md:flex gap-3 text-[0.55rem] mono text-neutral-500">
                          <span className="w-10 text-right">{odds.final_pct}%</span>
                          <span className="w-10 text-right">{odds.semi_pct}%</span>
                          <span className="w-10 text-right">{odds.quarter_pct}%</span>
                          <span className="w-10 text-right">{odds.round16_pct}%</span>
                        </div>
                        <div className="hidden lg:block mono text-[0.55rem] text-neutral-600 w-16 text-right">ELO {odds.elo}</div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <button
                    onClick={fetchTournamentOdds}
                    className="mono text-[0.7rem] text-[#D9622B] border border-[#D9622B]/40 rounded px-4 py-2 hover:bg-[#D9622B]/10 transition-colors"
                  >
                    LOAD TOURNAMENT ODDS
                  </button>
                </div>
              )}
              {tournamentOdds && (
                <div className="mt-3 flex gap-4 text-[0.55rem] mono text-neutral-500 border-t border-[#2A2A28] pt-3">
                  <span className="text-[#D9622B]">■</span> Title
                  <span className="text-neutral-600">│</span>
                  <span>Final</span>
                  <span>Semi</span>
                  <span>QF</span>
                  <span>R16</span>
                  <span className="text-neutral-600">│</span>
                  <span className="italic">Lower match count = less reliable rating. Teams with &lt;20 historical matches may have inflated/deflated Elo.</span>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Shared Footer component */}
      {currentPath !== '/' && (
        <footer className="h-16 border-t border-[#2A2A28] bg-[#0E0E0E]/40 px-8 flex items-center justify-between text-[0.6rem] text-neutral-500 z-10">
          <span className="mono">© 2026 FULL BACK //</span>
          <span className="mono">ENJOY ALL FEATURES</span>
        </footer>
      )}

      {/* Match Detail Modal */}
      {matchDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none animate-fade-in" onClick={() => { setMatchDetail(null); setModalPrediction(null); setModalBreakdown(null); setModalHighlights([]); }}>
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#2A2A28] bg-[#171715] rounded shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <div className="sticky top-0 z-10 flex justify-end p-3 bg-[#171715]/90">
              <button onClick={() => setMatchDetail(null)} className="mono text-[0.65rem] text-neutral-500 hover:text-[#D9622B] transition px-3 py-1 border border-[#2A2A28] rounded">
                CLOSE [X]
              </button>
            </div>

            {/* Match header */}
            <div className="px-6 pb-6 border-b border-[#2A2A28]">
              <div className="flex justify-between items-center mb-4">
                <span className="mono text-[0.6rem] text-[#D9622B] tracking-widest">[ MATCH_{matchDetail.match_id} ]</span>
                <span className={`mono text-[0.6rem] px-2 py-0.5 rounded ${
                  matchDetail.status === 'Finished'
                    ? 'bg-neutral-700 text-neutral-300'
                    : 'bg-[#D9622B]/20 text-[#D9622B] animate-pulse'
                }`}>{matchDetail.status}</span>
              </div>

              <div className="flex items-center justify-center gap-6 py-6">
                <div className="text-center flex-1">
                  <div className="text-4xl mb-2">{matchDetail.home_team.flag || '⚽'}</div>
                  <div className="font-syncopate text-[0.85rem] font-bold text-white tracking-wider">{matchDetail.home_team.name}</div>
                  <div className="mono text-[0.6rem] text-neutral-500 mt-1">{matchDetail.home_team.code}</div>
                </div>
                <div className="text-center">
                  <div className="mono text-3xl font-bold text-[#D9622B] border border-[#D9622B]/30 bg-[#D9622B]/5 px-6 py-3 rounded">
                    {matchDetail.score.home} - {matchDetail.score.away}
                  </div>
                </div>
                <div className="text-center flex-1">
                  <div className="text-4xl mb-2">{matchDetail.away_team.flag || '⚽'}</div>
                  <div className="font-syncopate text-[0.85rem] font-bold text-white tracking-wider">{matchDetail.away_team.name}</div>
                  <div className="mono text-[0.6rem] text-neutral-500 mt-1">{matchDetail.away_team.code}</div>
                </div>
              </div>

              {matchDetail.date && (
                <div className="text-center mono text-[0.6rem] text-neutral-500">
                  {new Date(matchDetail.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>

            {/* Stats section — only show if stats exist and not all zero */}
            {(() => {
              const s = matchDetail.stats;
              if (!s) return null;
              const hasData = Object.values(s).some((v: any) => v?.home || v?.away);
              if (!hasData) return null;
              return (
                <div className="px-6 py-5 border-b border-[#2A2A28]">
                  <h3 className="mono text-[0.65rem] text-[#D9622B] tracking-widest uppercase mb-4">[ MATCH_STATS ]</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'POSSESSION', key: 'possession' },
                      { label: 'SHOTS', key: 'shots' },
                      { label: 'SHOTS ON TARGET', key: 'shots_on_target' },
                      { label: 'PASSES', key: 'passes' },
                      { label: 'PASS ACCURACY', key: 'pass_accuracy' },
                      { label: 'FOULS', key: 'fouls' },
                      { label: 'CORNERS', key: 'corners' },
                      { label: 'SAVES', key: 'saves' },
                    ].map(({ label, key }) => {
                      const stat = matchDetail.stats?.[key];
                      if (!stat) return null;
                      return (
                        <div key={key} className="flex items-center gap-3 text-[0.7rem] mono">
                          <span className="w-10 text-right font-semibold text-white">{stat.home}</span>
                          <div className="flex-1 h-1.5 bg-neutral-900 rounded overflow-hidden">
                            <div
                              className="h-full bg-[#D9622B] rounded"
                              style={{ width: `${Math.min(100, (stat.home / (stat.home + stat.away || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="w-20 text-center text-neutral-500 uppercase tracking-wider">{label}</span>
                          <div className="flex-1 h-1.5 bg-neutral-900 rounded overflow-hidden">
                            <div
                              className="h-full bg-neutral-400 rounded"
                              style={{ width: `${Math.min(100, (stat.away / (stat.home + stat.away || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="w-10 text-left font-semibold text-white">{stat.away}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Events timeline */}
            {matchDetail.events && matchDetail.events.length > 0 && (
              <div className="px-6 py-5">
                <h3 className="mono text-[0.65rem] text-[#D9622B] tracking-widest uppercase mb-4">[ EVENTS ]</h3>
                <div className="relative border-l border-[#2A2A28] ml-3 space-y-5">
                  {matchDetail.events.map((evt: any, idx: number) => (
                    <div key={idx} className="relative pl-6">
                      <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 ${
                        evt.type === 'goal'
                          ? 'bg-[#D9622B] border-[#D9622B]'
                          : evt.type === 'card' && evt.detail?.includes('Yellow')
                          ? 'bg-yellow-400 border-yellow-400'
                          : evt.type === 'card'
                          ? 'bg-red-400 border-red-400'
                          : 'bg-neutral-600 border-neutral-600'
                      }`} />
                      <div className="flex items-center gap-3">
                        <span className="mono text-[0.65rem] text-[#D9622B] font-bold w-10">{evt.time}'</span>
                        <span className="mono text-[0.7rem] text-white font-semibold">{evt.player}</span>
                        <span className="mono text-[0.6rem] text-neutral-500 capitalize">{evt.detail?.toLowerCase() || evt.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prediction */}
            {modalPrediction && (
              <div className="px-6 py-5 border-b border-[#2A2A28]">
                <h3 className="mono text-[0.65rem] text-[#D9622B] tracking-widest uppercase mb-3">[ OUTCOME_PREDICTION ]</h3>
                <div className="flex gap-4 mb-3">
                  {['home_win','draw','away_win'].map((k) => (
                    <div key={k} className="flex-1 text-center border border-[#2A2A28] rounded p-2 bg-[#0E0E0E]/60">
                      <div className="mono text-[0.55rem] text-neutral-500 uppercase">{k.replace('_',' ')}</div>
                      <div className="mono text-lg font-bold text-[#D9622B]">{modalPrediction.probabilities?.[k] ?? 0}%</div>
                    </div>
                  ))}
                </div>
                <div className="mono text-[0.65rem] text-neutral-300 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {modalPrediction.prediction_analysis?.split('\n').slice(0, 8).join('\n')}
                </div>
              </div>
            )}
            {modalPredictionLoading && (
              <div className="px-6 py-4 text-center border-b border-[#2A2A28]">
                <div className="w-5 h-5 border-2 border-t-[#D9622B] border-neutral-800 rounded-full animate-spin inline-block mr-2" />
                <span className="mono text-[0.55rem] text-neutral-500">LOADING PREDICTION...</span>
              </div>
            )}

            {/* Tactical Breakdown */}
            {modalBreakdown && (
              <div className="px-6 py-5 border-b border-[#2A2A28]">
                <h3 className="mono text-[0.65rem] text-[#D9622B] tracking-widest uppercase mb-3">[ TACTICAL_BREAKDOWN ]</h3>
                <div className="mono text-[0.65rem] text-neutral-300 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {modalBreakdown.tactical_breakdown?.split('\n').slice(0, 8).join('\n')}
                </div>
              </div>
            )}
            {modalBreakdownLoading && (
              <div className="px-6 py-4 text-center border-b border-[#2A2A28]">
                <div className="w-5 h-5 border-2 border-t-[#D9622B] border-neutral-800 rounded-full animate-spin inline-block mr-2" />
                <span className="mono text-[0.55rem] text-neutral-500">LOADING BREAKDOWN...</span>
              </div>
            )}

            {/* Highlights */}
            {modalHighlights.length > 0 && (
              <div className="px-6 py-5 border-b border-[#2A2A28]">
                <h3 className="mono text-[0.65rem] text-[#D9622B] tracking-widest uppercase mb-3">[ HIGHLIGHTS ]</h3>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {modalHighlights.slice(0, 5).map((hl: Highlight) => (
                    <div key={hl.id} className="flex items-start gap-3 border border-[#2A2A28]/50 rounded p-2.5 bg-[#0E0E0E]/40">
                      <div className="w-16 h-10 rounded overflow-hidden flex-shrink-0 bg-[#2A2A28]">
                        {hl.thumbnail_url && <img src={hl.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="mono text-[0.6rem] text-[#D9622B]">{intToTime(hl.timestamp)}</div>
                        <div className="mono text-[0.6rem] text-neutral-300 truncate">{hl.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {modalHighlightsLoading && (
              <div className="px-6 py-4 text-center border-b border-[#2A2A28]">
                <div className="w-5 h-5 border-2 border-t-[#D9622B] border-neutral-800 rounded-full animate-spin inline-block mr-2" />
                <span className="mono text-[0.55rem] text-neutral-500">LOADING HIGHLIGHTS...</span>
              </div>
            )}

            {!matchDetail.stats && !matchDetail.events && matchDetailLoading && (
              <div className="px-6 py-12 text-center">
                <div className="w-6 h-6 border-2 border-t-[#D9622B] border-neutral-800 rounded-full animate-spin mx-auto mb-3" />
                <span className="mono text-[0.6rem] text-neutral-500">LOADING MATCH TELEMETRY...</span>
              </div>
            )}

            {matchDetailError && (
              <div className="px-6 py-5 text-center">
                <span className="mono text-[0.65rem] text-red-400">ERROR: {matchDetailError}</span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// Helpers
const intToTime = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const IMAGE_ASSETS = [
  'https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&q=90&w=2600',
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=90&w=2000',
  'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&q=90&w=2000',
  'https://images.unsplash.com/photo-1486286701208-1d58e9338013?auto=format&fit=crop&q=90&w=2000'
];
