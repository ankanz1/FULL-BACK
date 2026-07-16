import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import logoMark from './assets/logo_mark.png';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import PaymentBadge from './components/PaymentBadge';
import LockedPreview from './components/LockedPreview';
import PaywallModal, { type PaywallRequest } from './components/PaywallModal';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);

  // Custom router state
  const [currentPath, setCurrentPath] = useState('/'); // '/' | '/dashboard' | '/analyst' | '/players' | '/highlights' | '/developers'
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Layout refs for GSAP animations
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const transitionSweepRef = useRef<HTMLDivElement>(null);
  // Hero card — receives cursor-driven rotateX/Y from rAF loop
  const tiltWrapRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Data states
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('PL001'); // Christian Pulisic
  const [playerClusterData, setPlayerClusterData] = useState<any>(null);

  // Match & prediction states
  const [selectedMatchId, setSelectedMatchId] = useState<string>('M001'); // USA vs COL
  const [predictionData, setPredictionData] = useState<any>(null);
  const [breakdownData, setBreakdownData] = useState<any>(null);
  const [highlightsData, setHighlightsData] = useState<Highlight[]>([]);

  // New dashboard states
  const [activeTab, setActiveTab] = useState<string>('overview'); // 'overview' | 'table' | 'fixtures' | 'player-stats' | 'team-stats'
  const [selectedGroup, setSelectedGroup] = useState<string>('A');
  const [matches, setMatches] = useState<MatchStats[]>([]);
  const [standings, setStandings] = useState<GroupStanding[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [teamForms, setTeamForms] = useState<Record<string, TeamForm>>({});
  const [dashboardLoading, setDashboardLoading] = useState<Record<string, boolean>>({});
  const [dashboardError, setDashboardError] = useState<Record<string, string>>({});

  // Paywall states
  const [paywallRequired, setPaywallRequired] = useState<PaywallRequest | null>(null);

  const [paymentStatus, setPaymentStatus] = useState<string>(''); // 'signing' | 'settled' | ''
  const [paymentTx, setPaymentTx] = useState<string>('');
  const [unlockedResources, setUnlockedResources] = useState<Record<string, boolean>>({});
  const [receipts, setReceipts] = useState<Record<string, { amount: string; tx: string }>>({});
  const [premiumLoading, setPremiumLoading] = useState<Record<string, boolean>>({});
  const [premiumError, setPremiumError] = useState<Record<string, string>>({});

  // Chat states
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant' | 'system'; text: string }>>([
    { sender: 'assistant', text: "HELLO. I AM FULL BACK. STANDING BY FOR MATCH DATA OR TACTICAL ANALYSIS INTERROGATIONS. HOW CAN I BACK YOU TODAY?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Asset preloading
  useEffect(() => {
    let loadedCount = 0;
    let hasFailed = false;

    const preloadImage = (url: string) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        if (hasFailed) return;
        loadedCount++;
        setProgress(Math.round((loadedCount / IMAGE_ASSETS.length) * 100));
        if (loadedCount === IMAGE_ASSETS.length) {
          setTimeout(() => {
            setLoading(false);
            // Trigger initial entrance animations
            triggerEntranceAnims();
          }, 600);
        }
      };
      img.onerror = () => {
        if (!hasFailed) {
          hasFailed = true;
          setError(true);
          setLoading(false);
        }
      };
    };

    IMAGE_ASSETS.forEach(preloadImage);
    fetchPlayers();
  }, []);

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // ── Hero card cursor-tilt rAF loop ──
  // Drives rotateX / rotateY on the .hero-card via tiltWrapRef.
  // Bob is NOT used here (card is static except for cursor interaction).
  useEffect(() => {
    if (currentPath !== '/') return;

    const card = tiltWrapRef.current;
    if (!card) return;

    // Resting angles (match the CSS default)
    const REST_RY = 8;   // deg
    const REST_RX = -5;  // deg
    const MAX_D  = 7;    // max delta from rest

    if (reducedMotion) {
      card.style.transform = `perspective(1100px) rotateY(${REST_RY}deg) rotateX(${REST_RX}deg)`;
      return;
    }

    let targetRY = REST_RY;
    let targetRX = REST_RX;
    let curRY = REST_RY;
    let curRX = REST_RX;
    let rafId: number;

    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth)  * 2 - 1; // -1..+1
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      targetRY = REST_RY + nx * MAX_D;
      targetRX = REST_RX - ny * MAX_D;
    };

    const onLeave = () => { targetRY = REST_RY; targetRX = REST_RX; };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);

    const tick = () => {
      curRY += (targetRY - curRY) * 0.07;
      curRX += (targetRX - curRX) * 0.07;
      if (tiltWrapRef.current) {
        tiltWrapRef.current.style.transform =
          `perspective(1100px) rotateY(${curRY.toFixed(3)}deg) rotateX(${curRX.toFixed(3)}deg)`;
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
    // 3D Canvas scale zoom in
    gsap.fromTo('.viewport',
      { scale: 0.9 },
      { scale: 1, duration: 2, ease: 'power3.out' }
    );
    // Micro headlines wipe on
    gsap.fromTo('.hero-title',
      { clipPath: 'polygon(0 0, 0 0, 0 100%, 0% 100%)' },
      { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', duration: 1.5, ease: 'power4.inOut', delay: 0.5 }
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
      const res = await fetch('http://localhost:8000/players');
      if (res.ok) {
        const data = await res.json();
        setPlayers(data);
      }
    } catch (e) {
      console.error('Error fetching players:', e);
    }
  };

  // Fetch all matches (fixtures)
  const fetchMatches = async () => {
    const key = 'matches';
    setDashboardLoading(prev => ({ ...prev, [key]: true }));
    setDashboardError(prev => ({ ...prev, [key]: '' }));
    try {
      const res = await fetch('http://localhost:8000/matches');
      if (!res.ok) throw new Error('Failed to fetch matches');
      const data = await res.json();
      setMatches(data);
    } catch (e) {
      setDashboardError(prev => ({ ...prev, [key]: (e as Error).message }));
    } finally {
      setDashboardLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Fetch standings for a group
  const fetchStandings = async (group: string) => {
    const key = `standings-${group}`;
    setDashboardLoading(prev => ({ ...prev, [key]: true }));
    setDashboardError(prev => ({ ...prev, [key]: '' }));
    try {
      const res = await fetch(`http://localhost:8000/standings/${group}`);
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
      const res = await fetch('http://localhost:8000/player-stats');
      if (!res.ok) throw new Error('Failed to fetch player stats');
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
      const res = await fetch(`http://localhost:8000/team-form/${teamId}`);
      if (!res.ok) throw new Error(`Failed to fetch form for team ${teamId}`);
      const data = await res.json();
      setTeamForms(prev => ({ ...prev, [teamId]: data }));
    } catch (e) {
      setDashboardError(prev => ({ ...prev, [key]: (e as Error).message }));
    } finally {
      setDashboardLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Custom fetch function that handles 402 Payment Required
  const authenticatedFetch = async (url: string, path: string): Promise<any> => {
    const savedSig = unlockedResources[path] ? receipts[path]?.tx : null;
    const headers: Record<string, string> = {};
    if (savedSig) {
      const payload = {
        x402Version: 1,
        amount: path.includes('cluster') ? '10000' : path.includes('predict') ? '50000' : path.includes('tactical') ? '100000' : '80000',
        network: 'eip155:84532',
        asset: '0x036eFd41E265914E01E7574432c40e16414777a8',
        signature: savedSig
      };
      headers['payment-signature'] = btoa(JSON.stringify(payload));
    }

    const res = await fetch(url, { headers });

    if (res.status === 402) {
      const paymentRequiredHeader = res.headers.get('payment-required');
      if (!paymentRequiredHeader) {
        throw new Error('402 returned without requirements header');
      }

      const requirements = JSON.parse(atob(paymentRequiredHeader));
      const accepts = requirements.accepts?.[0];
      if (!accepts) {
        throw new Error('Invalid payment requirements structure');
      }

      return new Promise((resolve, reject) => {
        setPaywallRequired({
          resource: path,
          amount: accepts.maxAmountRequired,
          description: accepts.description,
          resolve: async (signature: string) => {
            try {
              const retryPayload = {
                x402Version: 1,
                amount: accepts.maxAmountRequired,
                network: accepts.network,
                asset: accepts.asset,
                signature: signature
              };
              const retryHeaders = {
                'payment-signature': btoa(JSON.stringify(retryPayload))
              };
              const retryRes = await fetch(url, { headers: retryHeaders });
              if (!retryRes.ok) {
                const text = await retryRes.text();
                reject(new Error(`Failed on retry: ${text}`));
              } else {
                const data = await retryRes.json();
                setUnlockedResources(prev => ({ ...prev, [path]: true }));
                setReceipts(prev => ({ ...prev, [path]: { amount: accepts.maxAmountRequired, tx: signature } }));
                resolve(data);
              }
            } catch (err) {
              reject(err);
            }
          },
          reject: (err) => reject(err)
        });
      });
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Service returned error ${res.status}: ${text}`);
    }

    return await res.json();
  };

  const handlePaywallSettle = () => {
    if (!paywallRequired) return;
    setPaymentStatus('signing');

    // Simulate smart contract interactions (EIP-3009 permit/transfer signature)
    setTimeout(() => {
      const mockTx = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      setPaymentTx(mockTx);
      setPaymentStatus('settled');

      setTimeout(() => {
        const resolveFn = paywallRequired.resolve;
        setPaywallRequired(null);
        setPaymentStatus('');
        setPaymentTx('');
        resolveFn(mockTx);
      }, 1000);
    }, 1500);
  };

  const withPremiumFetch = async <T,>(
    path: string,
    runner: () => Promise<T>,
    onSuccess: (data: T) => void,
    onClear: () => void,
  ) => {
    onClear();
    setPremiumLoading((prev) => ({ ...prev, [path]: true }));
    setPremiumError((prev) => ({ ...prev, [path]: '' }));
    try {
      const data = await runner();
      onSuccess(data);
    } catch (e: any) {
      console.error(e);
      setPremiumError((prev) => ({ ...prev, [path]: e?.message || 'Request failed' }));
    } finally {
      setPremiumLoading((prev) => ({ ...prev, [path]: false }));
    }
  };

  // Fetch clustering results
  const fetchClustering = async (playerId: string) => {
    const path = `/cluster/player/${playerId}`;
    await withPremiumFetch(
      path,
      () => authenticatedFetch(`http://localhost:8000${path}`, path),
      (data) => setPlayerClusterData(data),
      () => setPlayerClusterData(null),
    );
  };

  // Fetch prediction results
  const fetchPrediction = async (matchId: string) => {
    const path = `/predict/match/${matchId}`;
    await withPremiumFetch(
      path,
      () => authenticatedFetch(`http://localhost:8000${path}`, path),
      (data) => setPredictionData(data),
      () => setPredictionData(null),
    );
  };

  // Fetch tactical breakdown results
  const fetchTacticalBreakdown = async (matchId: string) => {
    const path = `/tactical/match/${matchId}`;
    await withPremiumFetch(
      path,
      () => authenticatedFetch(`http://localhost:8000${path}`, path),
      (data) => setBreakdownData(data),
      () => setBreakdownData(null),
    );
  };

  // Fetch match highlights
  const fetchHighlights = async (matchId: string) => {
    const path = `/highlights/match/${matchId}`;
    await withPremiumFetch(
      path,
      () => authenticatedFetch(`http://localhost:8000${path}`, path),
      (data) => setHighlightsData(data.highlights || []),
      () => setHighlightsData([]),
    );
  };

  const isUnlocked = (path: string) => Boolean(unlockedResources[path] || receipts[path]);

  // Re-load already-unlocked premium datasets when path/target changes
  useEffect(() => {
    if (currentPath === '/players' && selectedPlayer) {
      const path = `/cluster/player/${selectedPlayer}`;
      if (isUnlocked(path)) fetchClustering(selectedPlayer);
      else setPlayerClusterData(null);
    } else if (currentPath === '/analyst' && selectedMatchId) {
      const predictPath = `/predict/match/${selectedMatchId}`;
      const tacticalPath = `/tactical/match/${selectedMatchId}`;
      if (isUnlocked(predictPath)) fetchPrediction(selectedMatchId);
      else setPredictionData(null);
      if (isUnlocked(tacticalPath)) fetchTacticalBreakdown(selectedMatchId);
      else setBreakdownData(null);
    } else if (currentPath === '/highlights' && selectedMatchId) {
      const path = `/highlights/match/${selectedMatchId}`;
      if (isUnlocked(path)) fetchHighlights(selectedMatchId);
      else setHighlightsData([]);
    }
  }, [currentPath, selectedPlayer, selectedMatchId]);

  // Fetch dashboard data based on active tab and selected group
  useEffect(() => {
    if (currentPath !== '/dashboard') return;

    // Always fetch matches for overview and fixtures
    if (activeTab === 'overview' || activeTab === 'fixtures') {
      if (matches.length === 0) fetchMatches();
    }

    // Fetch standings for table or overview
    if (activeTab === 'table' || activeTab === 'overview') {
      fetchStandings(selectedGroup);
    }

    // Fetch player stats for player-stats tab
    if (activeTab === 'player-stats') {
      if (!playerStats) fetchPlayerStats();
    }

    // Fetch team forms for team-stats tab (fetch for all teams in standings)
    if (activeTab === 'team-stats') {
      if (standings.length > 0) {
        standings.forEach(standing => {
          if (!teamForms[standing.team.id]) {
            fetchTeamForm(standing.team.id);
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
      let isPremiumTool = false;
      let path = '';
      let amount = '0';
      let desc = '';
      let toolName = '';

      if (cleanText.includes('cluster') || cleanText.includes('type of player') || cleanText.includes('similar to')) {
        isPremiumTool = true;
        toolName = 'player_style_cluster';
        const targetPlayer = players.find(p => cleanText.includes(p.name.toLowerCase())) || players[0];
        path = `/cluster/player/${targetPlayer.player_id}`;
        amount = '10000';
        desc = `Access premium similarity clustering for ${targetPlayer.name}`;
      } else if (cleanText.includes('predict') || cleanText.includes('prediction') || cleanText.includes('who will win')) {
        isPremiumTool = true;
        toolName = 'predict_outcome';
        path = `/predict/match/${selectedMatchId}`;
        amount = '50000';
        desc = `Generate premium AI prediction for match ${selectedMatchId}`;
      } else if (cleanText.includes('breakdown') || cleanText.includes('tactical') || cleanText.includes('tactics')) {
        isPremiumTool = true;
        toolName = 'tactical_breakdown';
        path = `/tactical/match/${selectedMatchId}`;
        amount = '100000';
        desc = `Generate premium post-match tactical breakdown for ${selectedMatchId}`;
      } else if (cleanText.includes('highlight') || cleanText.includes('video') || cleanText.includes('clip')) {
        isPremiumTool = true;
        toolName = 'generate_highlights';
        path = `/highlights/match/${selectedMatchId}`;
        amount = '80000';
        desc = `Generate premium highlights for match ${selectedMatchId}`;
      }

      if (isPremiumTool) {
        setMessages(prev => [...prev, {
          sender: 'system',
          text: `INVOKING_MCP_TOOL: fullback-mcp-server :: ${toolName}()\nSTATUS: 402 PAYMENT REQUIRED (${parseFloat(amount) / 1000000} USDC required) :: ${desc}`
        }]);

        try {
          const result = await authenticatedFetch(`http://localhost:8000${path}`, path);
          reply = `MCP_TOOL_EXECUTION :: SUCCESS\n\n`;
          if (toolName === 'player_style_cluster') {
            reply += `Player Similarity Report for **${result.player.name}**:\n`;
            reply += `- Archetype: ${result.player.archetype}\n`;
            reply += `- Silhouette Confidence: ${result.silhouette_score.toFixed(3)}\n\n`;
            reply += `Nearest Similar Players:\n`;
            result.similar_players.forEach((p: any) => {
              reply += `• ${p.name} (${p.position}) — Value: €${p.market_value_m}M (Dist: ${p.similarity_distance.toFixed(2)})\n`;
            });
          } else if (toolName === 'predict_outcome') {
            reply += `AI Prediction Outcome:\n${result.prediction_analysis}`;
          } else if (toolName === 'tactical_breakdown') {
            reply += `Tactical Breakdown:\n${result.tactical_breakdown}`;
          } else if (toolName === 'generate_highlights') {
            reply += `Highlights generation successful. Found ${result.highlights.length} events inside the audio telemetry. Visual clips unlocked.`;
          }

          setMessages(prev => [...prev, { sender: 'assistant', text: reply }]);
        } catch (err: any) {
          setMessages(prev => [...prev, { sender: 'system', text: `MCP_TOOL_EXECUTION :: FAILED\nReason: ${err.message}` }]);
        }
      } else {
        if (cleanText.includes('hello') || cleanText.includes('hi')) {
          reply = "HELLO. STANDING BY FOR World Cup telemetry analysis. Ask about player clustering, outcome predictions, or post-match breakdowns.";
        } else if (cleanText.includes('match') || cleanText.includes('fixture') || cleanText.includes('score')) {
          reply = "Match M001: USA 2 - 1 Colombia (Finished)\nMatch M002: Germany 3 - 1 Japan (Finished)\nMatch M003: Argentina 2 - 2 England (Finished)\n\nAsk 'predict match' or 'tactical breakdown' to invoke premium AI tools.";
        } else if (cleanText.includes('standing') || cleanText.includes('group')) {
          reply = "Group A:\n1. Germany - 3 pts\n2. United States - 3 pts\n3. Colombia - 0 pts\n4. Japan - 0 pts\n\nGroup B:\n1. France - 3 pts\n2. Argentina - 1 pts\n3. England - 1 pts\n4. Morocco - 0 pts";
        } else {
          reply = "UNDERSTOOD. However, that query lies outside the free tier. Try asking for 'player similarity to Erling Haaland', 'predict match', or 'match standings'.";
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

  // Loading Screen State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#0E0E0E] text-[#ECEAE3] font-syncopate select-none">
        <div className="text-center space-y-6 max-w-xs md:max-w-sm px-6 flex flex-col items-center">
          <img src={logoMark} alt="FULL BACK Logo Mark" className="w-16 h-16 md:w-20 md:h-20 animate-pulse object-contain mb-2" />
          <div className="h-[2px] w-full bg-neutral-900 overflow-hidden relative">
            <div
              className="h-full bg-[#D9622B] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center mono text-[0.65rem] opacity-50 tracking-wider w-full">
            <span>PRELOADING_ASSETS</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>
    );
  }

  // Connection Error State
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#0E0E0E] text-[#ECEAE3] font-syncopate select-none px-6 text-center">
        <div className="max-w-md p-8 border border-red-500/20 bg-black/40 backdrop-blur-md rounded">
          <div className="text-red-500 text-[1.2rem] md:text-[1.5rem] tracking-wider mb-4">▲ CONNECTION ERROR</div>
          <p className="mono text-[0.75rem] opacity-75 mb-6 leading-relaxed">
            FAILED TO INGEST FIELD VISUALIZATIONS. PLEASE CHECK YOUR INTERNET OR REF_RESOURCES PATHS.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mono border border-[#ECEAE3] text-[#ECEAE3] px-4 py-2 hover:bg-[#D9622B] hover:border-[#D9622B] hover:text-white transition duration-300 tracking-wider text-[0.7rem]"
          >
            RETRY_CONNECTION
          </button>
        </div>
      </div>
    );
  }

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
              onClick={() => handleNavigate('/highlights')}
              className={`text-[0.7rem] uppercase tracking-widest font-semibold px-2 py-1.5 transition relative ${currentPath === '/highlights' ? 'text-[#D9622B]' : 'text-[#8B8A85] hover:text-[#ECEAE3]'}`}
            >
              HIGHLIGHTS
              {currentPath === '/highlights' && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#D9622B]" />}
            </button>
            <button
              onClick={() => handleNavigate('/developers')}
              className={`text-[0.7rem] uppercase tracking-widest font-semibold px-2 py-1.5 transition relative ${currentPath === '/developers' ? 'text-[#D9622B]' : 'text-[#8B8A85] hover:text-[#ECEAE3]'}`}
            >
              DEVELOPERS
              {currentPath === '/developers' && <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#D9622B]" />}
            </button>
          </nav>
        </header>
      )}

      {/* Main Content Body */}
      <main className={`flex-grow z-10 flex flex-col relative ${currentPath === '/' ? 'pt-0' : 'pt-16'}`}>

        {/* 1. HOME PATH */}
        {currentPath === '/' && (
          <div className="hero-root">

            {/* ── TOP BAR ── */}
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

            {/* ── BODY: left title / right card ── */}
            <div className="hero-body">

              {/* Left: giant display title — z-20 so it prints over the card */}
              <div className="hero-title-block">
                <h1 className="hero-display font-syncopate uppercase select-none">
                  EMPTY<br />GRIDIRON
                </h1>
              </div>

              {/* Right: 3-D tilt card scene */}
              <div className="hero-card-scene">
                {/* tiltWrapRef — rAF writes perspective rotateX/Y here */}
                <div
                  ref={tiltWrapRef}
                  className="hero-card"
                  style={{ willChange: 'transform' }}
                >
                  {/* Stadium photo */}
                  <div className="hero-card-img" />
                  {/* Glass sheen */}
                  <div className="hero-card-sheen" />
                  {/* Corner HUD micro-labels */}
                  <span className="hero-card-hud hero-card-hud--tl">FIELD_CAM_01 :: LIVE</span>
                  <span className="hero-card-hud hero-card-hud--tr">TELEMETRY_ON</span>
                  <span className="hero-card-hud hero-card-hud--bl">LAT 41.8623°N</span>
                  <span className="hero-card-hud hero-card-hud--br">BASE_SEPOLIA</span>
                </div>
              </div>
            </div>

            {/* ── BOTTOM BAR ── */}
            <div className="hero-bottombar">
              <div className="select-none">
                <div className="mono text-[0.62rem] text-[#D9622B] tracking-widest mb-0.5">[ SEASON 2026 — NIGHT MATCH ]</div>
                <div className="mono text-[0.62rem] text-[#8B8A85] tracking-wider">SILENT GRIDIRON &amp; STADIUM LIGHT AT REST</div>
              </div>
              <button
                onClick={() => handleNavigate('/dashboard')}
                className="mono border border-[#ECEAE3] text-[#ECEAE3] px-8 py-3 bg-transparent hover:bg-[#D9622B] hover:border-[#D9622B] transition-all duration-300 font-semibold tracking-wider text-[0.72rem] cursor-pointer whitespace-nowrap"
              >
                ENTER THE FIELD →
              </button>
            </div>
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
                <div className="space-y-8">
                  {/* Live Matches */}
                  <div>
                    <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase mb-4">[ LIVE_MATCHES ]</h3>
                    {dashboardLoading['matches'] ? (
                      <LoadingState label="Loading matches..." />
                    ) : dashboardError['matches'] ? (
                      <ErrorState message={dashboardError['matches']} onRetry={fetchMatches} />
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {matches.map((match) => (
                          <div
                            key={match.match_id}
                            className="border border-[#2A2A28] bg-[#171715]/40 rounded p-4 hover:bg-[#171715]/60 transition-colors cursor-pointer"
                            onClick={() => setSelectedMatchId(match.match_id)}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className="mono text-[0.6rem] text-neutral-500">[ {match.match_id} ]</span>
                              <span className={`mono text-[0.6rem] px-2 py-0.5 rounded ${
                                match.status === 'Finished'
                                  ? 'bg-neutral-700 text-neutral-300'
                                  : 'bg-[#D9622B]/20 text-[#D9622B] animate-pulse'
                              }`}>
                                {match.status}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <div className="text-center">
                                <div className="text-2xl">{match.home_team.flag}</div>
                                <div className="mono text-[0.65rem] text-neutral-300 mt-1">{match.home_team.code}</div>
                              </div>
                              <div className="mono text-xl font-bold text-[#ECEAE3]">
                                {match.score.home} - {match.score.away}
                              </div>
                              <div className="text-center">
                                <div className="text-2xl">{match.away_team.flag}</div>
                                <div className="mono text-[0.65rem] text-neutral-300 mt-1">{match.away_team.code}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Standings Snippet */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase">[ GROUP {selectedGroup} STANDINGS ]</h3>
                      <button
                        onClick={() => setActiveTab('table')}
                        className="mono text-[0.65rem] text-[#8B8A85] hover:text-[#D9622B] transition-colors"
                      >
                        View Full Table →
                      </button>
                    </div>
                    {dashboardLoading[`standings-${selectedGroup}`] ? (
                      <LoadingState label="Loading standings..." />
                    ) : dashboardError[`standings-${selectedGroup}`] ? (
                      <ErrorState message={dashboardError[`standings-${selectedGroup}`]} onRetry={() => fetchStandings(selectedGroup)} />
                    ) : (
                      <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-4">
                        <table className="w-full text-left mono text-[0.7rem] text-neutral-300">
                          <thead>
                            <tr className="text-neutral-500 border-b border-[#2A2A28]">
                              <th className="py-2">POS</th>
                              <th className="py-2">TEAM</th>
                              <th className="py-2 text-center">P</th>
                              <th className="py-2 text-center">W</th>
                              <th className="py-2 text-center">D</th>
                              <th className="py-2 text-center">L</th>
                              <th className="py-2 text-center">GD</th>
                              <th className="py-2 text-right">PTS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2A2A28]/50">
                            {standings.slice(0, 4).map((standing) => (
                              <tr key={standing.team.id} className="hover:bg-neutral-900/30">
                                <td className="py-2.5 text-[#D9622B]">{standing.position}</td>
                                <td className="py-2.5 font-semibold text-white">
                                  {standing.team.flag} {standing.team.name}
                                </td>
                                <td className="py-2.5 text-center">{standing.played}</td>
                                <td className="py-2.5 text-center">{standing.won}</td>
                                <td className="py-2.5 text-center">{standing.drawn}</td>
                                <td className="py-2.5 text-center">{standing.lost}</td>
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
                  </div>
                </div>
              )}

              {/* Table Tab */}
              {activeTab === 'table' && (
                <div className="space-y-6">
                  {/* Group Selector */}
                  <div className="flex gap-2">
                    {['A', 'B'].map((group) => (
                      <button
                        key={group}
                        onClick={() => setSelectedGroup(group)}
                        className={`mono text-[0.7rem] px-4 py-2 rounded border transition-colors ${
                          selectedGroup === group
                            ? 'border-[#D9622B] bg-[#D9622B]/10 text-[#D9622B]'
                            : 'border-[#2A2A28] text-[#8B8A85] hover:border-[#ECEAE3] hover:text-[#ECEAE3]'
                        }`}
                      >
                        GROUP {group}
                      </button>
                    ))}
                  </div>

                  {/* Standings Table */}
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
                      {matches.map((match) => (
                        <div
                          key={match.match_id}
                          className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6 hover:bg-[#171715]/60 transition-colors cursor-pointer"
                          onClick={() => setSelectedMatchId(match.match_id)}
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
                        const teamForm = teamForms[standing.team.id];
                        return (
                          <div key={standing.team.id} className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6">
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
            </div>
          </div>
        )}

        {/* 3. AI CHAT / ANALYST PATH */}
        {currentPath === '/analyst' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-8 animate-fade-in flex-grow flex flex-col">
            <div className="border-b border-[#2A2A28] pb-4 flex justify-between items-end">
              <div>
                <span className="mono text-[0.65rem] text-[#D9622B] tracking-widest block mb-1">[ PREDICTIVE_TACTICAL_HUD ]</span>
                <h1 className="font-syncopate text-[1.2rem] md:text-[1.5rem] font-bold tracking-widest text-[#ECEAE3]">AI MATCH ANALYST</h1>
              </div>

              {/* Match selector */}
              <div className="flex items-center gap-2">
                <span className="mono text-[0.6rem] text-neutral-500 uppercase tracking-widest mr-2">TARGET_ID:</span>
                {['M001', 'M002', 'M003'].map(id => (
                  <button
                    key={id}
                    onClick={() => setSelectedMatchId(id)}
                    className={`mono text-[0.65rem] px-2.5 py-1 rounded border transition ${selectedMatchId === id ? 'border-[#D9622B] text-[#D9622B] bg-[#D9622B]/5' : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'}`}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Gated Prediction panel */}
              <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6 flex flex-col justify-between relative overflow-hidden">
                <div>
                  <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase mb-4">[ OUTCOME_PREDICTION ]</h3>

                  {(() => {
                    const path = `/predict/match/${selectedMatchId}`;
                    if (premiumLoading[path]) return <LoadingState label="REQUESTING ENGINES..." />;
                    if (premiumError[path]) {
                      return <ErrorState message={premiumError[path]} onRetry={() => fetchPrediction(selectedMatchId)} />;
                    }
                    if (!predictionData) {
                      return (
                        <LockedPreview
                          title="AI MATCH PREDICTION"
                          description="Unlock form-weighted win probabilities and an AI scoreline writeup for this fixture."
                          amountUsdc="0.05"
                          onUnlock={() => fetchPrediction(selectedMatchId)}
                        />
                      );
                    }
                    return (
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-[0.7rem] mono mb-1.5">
                              <span>{predictionData.home_team.toUpperCase()}_WIN</span>
                              <span className="text-[#D9622B] font-semibold">{predictionData.probabilities.home_win}%</span>
                            </div>
                            <div className="h-[2px] bg-neutral-900 overflow-hidden">
                              <div className="h-full bg-[#D9622B]" style={{ width: `${predictionData.probabilities.home_win}%` }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[0.7rem] mono mb-1.5">
                              <span>{predictionData.away_team.toUpperCase()}_WIN</span>
                              <span className="text-white font-semibold">{predictionData.probabilities.away_win}%</span>
                            </div>
                            <div className="h-[2px] bg-neutral-900 overflow-hidden">
                              <div className="h-full bg-neutral-400" style={{ width: `${predictionData.probabilities.away_win}%` }} />
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-[#2A2A28] pt-4">
                          <div className="mono text-[0.55rem] text-neutral-500 mb-2">AI_SUMMARY_WRITEUP:</div>
                          <p className="text-[0.75rem] text-neutral-300 leading-relaxed font-jetbrains">
                            {predictionData.summary}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="border-t border-[#2A2A28] pt-4 mt-6">
                  {receipts[`/predict/match/${selectedMatchId}`] ? (
                    <PaymentBadge
                      amountLabel="0.05 USDC"
                      tx={receipts[`/predict/match/${selectedMatchId}`].tx}
                    />
                  ) : (
                    <div className="mono text-[0.55rem] text-neutral-500">
                      STATUS: PENDING_MICROPAYMENT
                    </div>
                  )}
                </div>
              </div>

              {/* Gated Post-match Breakdown */}
              <div className="lg:col-span-2 border border-[#2A2A28] bg-[#171715]/40 rounded p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="flex-1 flex flex-col min-h-0">
                  <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase mb-4">[ POST_MATCH_TACTICAL_BREAKDOWN ]</h3>

                  {(() => {
                    const path = `/tactical/match/${selectedMatchId}`;
                    if (premiumLoading[path]) return <LoadingState label="COMPILING TELEMETRY STATS..." />;
                    if (premiumError[path]) {
                      return <ErrorState message={premiumError[path]} onRetry={() => fetchTacticalBreakdown(selectedMatchId)} />;
                    }
                    if (!breakdownData) {
                      return (
                        <LockedPreview
                          title="TACTICAL BREAKDOWN"
                          description="Pay to unlock a post-match formation writeup with shot, possession, and set-piece telemetry."
                          amountUsdc="0.10"
                          onUnlock={() => fetchTacticalBreakdown(selectedMatchId)}
                        />
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
                  <span className="mono text-[0.6rem] text-neutral-500">USDC_FACILITATOR: CIRCLE_CCTP</span>
                  {receipts[`/tactical/match/${selectedMatchId}`] && (
                    <PaymentBadge
                      amountLabel="0.10 USDC"
                      tx={receipts[`/tactical/match/${selectedMatchId}`].tx}
                    />
                  )}
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
              <span className="mono text-[0.6rem] text-neutral-500">COMPILERS: SCIKIT-LEARN KMeans</span>
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
                        players.slice(0, 30).map(p => (
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
                    <span className="text-[#D9622B] font-bold">0.226</span>
                  </div>
                  <div className="mono text-[0.6rem] text-neutral-500 flex justify-between mt-1.5">
                    <span>ARCHETYPE_CLUSTERS:</span>
                    <span className="text-white">K=5</span>
                  </div>
                </div>
              </div>

              {/* Center results pane */}
              <div className="lg:col-span-2 border border-[#2A2A28] bg-[#171715]/40 rounded p-6 flex flex-col justify-between min-h-[300px]">
                {(() => {
                  const path = `/cluster/player/${selectedPlayer}`;
                  if (premiumLoading[path]) {
                    return <LoadingState label="RETRIEVING MULTIVARIATE DATA..." className="flex-1" />;
                  }
                  if (premiumError[path]) {
                    return <ErrorState message={premiumError[path]} onRetry={() => fetchClustering(selectedPlayer)} />;
                  }
                  if (!playerClusterData) {
                    const selectedMeta = players.find((p) => p.player_id === selectedPlayer);
                    return (
                      <LockedPreview
                        title="PLAYER STYLE CLUSTER"
                        description={`Unlock archetype + nearest neighbors for ${selectedMeta?.name || selectedPlayer}. Free PCA map stays visible below.`}
                        amountUsdc="0.01"
                        onUnlock={() => fetchClustering(selectedPlayer)}
                      />
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

                          {receipts[path] && (
                            <PaymentBadge amountLabel="0.01 USDC" tx={receipts[path].tx} />
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                          <div>
                            <div className="text-[0.6rem] text-neutral-500 uppercase tracking-widest font-semibold mb-2">ARCHETYPE_CENTROID</div>
                            <div className="border border-[#D9622B]/20 bg-[#D9622B]/5 rounded p-3 text-[0.75rem] font-bold text-[#D9622B] tracking-wide">
                              {playerClusterData.player.archetype.toUpperCase()}
                            </div>
                            <p className="mono text-[0.65rem] text-neutral-400 leading-relaxed mt-2.5">
                              Assigned based on Goals, Assists, Key Passes, and Tackles per 90 telemetry.
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
                      const clusterColor = p.cluster === 0 ? '#D9622B' : p.cluster === 1 ? '#6ba642' : p.cluster === 2 ? '#3b82f6' : p.cluster === 3 ? '#a855f7' : '#eab308';

                      return (
                        <circle
                          key={p.player_id}
                          cx={cx}
                          cy={cy}
                          r={isSelected ? 6 : 2.5}
                          fill={isSelected ? '#D9622B' : clusterColor}
                          stroke={isSelected ? '#white' : 'transparent'}
                          strokeWidth={2}
                          className="cursor-pointer transition hover:r-5 opacity-75"
                          onClick={() => setSelectedPlayer(p.player_id)}
                        />
                      );
                    })}

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
                <div className="absolute bottom-4 left-4 flex flex-wrap gap-4 bg-black/80 border border-neutral-800 p-3 rounded">
                  <div className="flex items-center gap-1.5 text-[0.6rem] mono">
                    <span className="w-2 h-2 bg-[#D9622B] rounded-full" />
                    <span>STRIKER</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[0.6rem] mono">
                    <span className="w-2 h-2 bg-[#6ba642] rounded-full" />
                    <span>PLAYMAKER</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[0.6rem] mono">
                    <span className="w-2 h-2 bg-[#3b82f6] rounded-full" />
                    <span>DEFENDER</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[0.6rem] mono">
                    <span className="w-2 h-2 bg-[#a855f7] rounded-full" />
                    <span>MIDFIELDER</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[0.6rem] mono">
                    <span className="w-2 h-2 bg-[#eab308] rounded-full" />
                    <span>FULLBACK</span>
                  </div>
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
              <span className="mono text-[0.6rem] text-neutral-500">USDC_PRICE: 0.08 USDC</span>
            </div>

            <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6">
              {(() => {
                const path = `/highlights/match/${selectedMatchId}`;
                if (premiumLoading[path]) {
                  return <LoadingState label="EXTRACTING DECIBEL SPIKES..." className="py-20" />;
                }
                if (premiumError[path]) {
                  return <ErrorState message={premiumError[path]} onRetry={() => fetchHighlights(selectedMatchId)} />;
                }
                if (highlightsData.length === 0) {
                  return (
                    <LockedPreview
                      title="HIGHLIGHT TELEMETRY"
                      description="Unlock RMS loudness peak clips for this match. Audio analysis runs after micropayment settles."
                      amountUsdc="0.08"
                      onUnlock={() => fetchHighlights(selectedMatchId)}
                      className="py-8"
                    />
                  );
                }
                return (
                  <div className="space-y-8">
                    <div className="flex justify-end">
                      {receipts[path] && <PaymentBadge amountLabel="0.08 USDC" tx={receipts[path].tx} />}
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

        {/* 6. DEVELOPERS DOCUMENTATION PATH */}
        {currentPath === '/developers' && (
          <div className="p-8 max-w-6xl w-full mx-auto space-y-8 animate-fade-in flex-grow">
            <div className="border-b border-[#2A2A28] pb-4 flex justify-between items-end">
              <div>
                <span className="mono text-[0.65rem] text-[#D9622B] tracking-widest block mb-1">[ AGENT_INTEGRATION_SDK ]</span>
                <h1 className="font-syncopate text-[1.2rem] md:text-[1.5rem] font-bold tracking-widest text-[#ECEAE3]">DEVELOPER PORTAL</h1>
              </div>
              <span className="mono text-[0.6rem] text-neutral-500">SPECIFICATION: MCP v1.0 &amp; Open Skills</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Instructions side panel */}
              <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6 space-y-6">
                <div>
                  <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase mb-4">[ AGENT_SKILL_INSTALL ]</h3>
                  <p className="mono text-[0.65rem] text-neutral-400 leading-relaxed mb-4">
                    Install the packaged skill into Claude Code or other compatible agent environments in one command.
                  </p>

                  <div className="bg-[#0E0E0E] border border-[#2A2A28] p-3 rounded text-[0.65rem] mono text-[#D9622B] font-bold select-all">
                    npx skills add worldcup-analyst
                  </div>
                </div>

                <div className="border-t border-[#2A2A28] pt-6 space-y-2">
                  <div className="text-[0.6rem] text-neutral-500 uppercase tracking-widest font-semibold mb-2">INTEGRATION_STEPS</div>
                  <ol className="list-decimal pl-4 text-[0.65rem] text-neutral-400 space-y-1.5 mono">
                    <li>Add the skill package.</li>
                    <li>Set EVM/SVM private key variables.</li>
                    <li>Query the model context tools directly.</li>
                  </ol>
                </div>
              </div>

              {/* Code blocks reference */}
              <div className="lg:col-span-2 border border-[#2A2A28] bg-[#171715]/40 rounded p-6 space-y-6">
                <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase mb-4">[ CLAUDE_DESKTOP_CONFIG_TEMPLATE ]</h3>

                <div className="bg-[#0E0E0E] border border-[#2A2A28] p-5 rounded font-mono text-[0.65rem] text-neutral-300 overflow-x-auto">
                  <pre>{`{
  "mcpServers": {
    "fullback-analyst": {
      "command": "npx",
      "args": ["-y", "fullback-mcp-server"],
      "env": {
        "EVM_PRIVATE_KEY": "0x9ed482fC5A356964b0405D...",
        "RESOURCE_SERVER_URL": "http://localhost:8000"
      }
    }
  }
}`}</pre>
                </div>

                <div className="border-t border-[#2A2A28] pt-6">
                  <div className="mono text-[0.6rem] text-neutral-500 mb-2 uppercase">AVAILABLE_MCP_SCHEMAS:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[0.65rem] mono">
                    <div className="border border-neutral-900 p-3 rounded">
                      <div className="text-[#D9622B] font-bold">predict_outcome(match_id)</div>
                      <div className="text-neutral-500 mt-1">Gated: 0.05 USDC</div>
                    </div>
                    <div className="border border-neutral-900 p-3 rounded">
                      <div className="text-[#D9622B] font-bold">tactical_breakdown(match_id)</div>
                      <div className="text-neutral-500 mt-1">Gated: 0.10 USDC</div>
                    </div>
                    <div className="border border-neutral-900 p-3 rounded">
                      <div className="text-[#D9622B] font-bold">player_style_cluster(player_id)</div>
                      <div className="text-neutral-500 mt-1">Gated: 0.01 USDC</div>
                    </div>
                    <div className="border border-neutral-900 p-3 rounded">
                      <div className="text-[#D9622B] font-bold">generate_highlights(match_id)</div>
                      <div className="text-neutral-500 mt-1">Gated: 0.08 USDC</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Shared Footer component */}
      <footer className="h-16 border-t border-[#2A2A28] bg-[#0E0E0E]/40 px-8 flex items-center justify-between text-[0.6rem] text-neutral-500 z-10">
        <span className="mono">© 2026 FULL BACK // SUBMISSION FOR INJECTIVE GLOBAL CUP</span>
        <span className="mono">SETTLEMENTS: CIRCLE CCTP EVM v2</span>
      </footer>

      {paywallRequired && (
        <PaywallModal
          paywall={paywallRequired}
          paymentStatus={paymentStatus}
          paymentTx={paymentTx}
          onAbort={() => {
            const rejectFn = paywallRequired.reject;
            setPaywallRequired(null);
            rejectFn(new Error('User aborted payment'));
          }}
          onSettle={handlePaywallSettle}
        />
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
