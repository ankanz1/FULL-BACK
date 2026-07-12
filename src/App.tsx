import { useState, useEffect, useRef } from 'react';
import logoFull from './assets/logo_full.png';
import logoMark from './assets/logo_mark.png';

const IMAGE_ASSETS = [
  'https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&q=90&w=2600', // Backdrop
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=90&w=2000', // Layer 1
  'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&q=90&w=2000', // Layer 2
  'https://images.unsplash.com/photo-1486286701208-1d58e9338013?auto=format&fit=crop&q=90&w=2000'  // Layer 3
];

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

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [entered, setEntered] = useState(false);
  const [activeTab, setActiveTab] = useState<'fixtures' | 'clustering' | 'analytics' | 'highlights' | 'chat'>('fixtures');

  // Parallax refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const layer3Ref = useRef<HTMLDivElement>(null);

  // Data states
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('PL001'); // Christian Pulisic
  const [playerClusterData, setPlayerClusterData] = useState<any>(null);
  
  // Match & prediction states
  const [selectedMatchId, setSelectedMatchId] = useState<string>('M001'); // USA vs COL
  const [predictionData, setPredictionData] = useState<any>(null);
  const [breakdownData, setBreakdownData] = useState<any>(null);
  const [highlightsData, setHighlightsData] = useState<Highlight[]>([]);
  
  // Paywall states
  const [paywallRequired, setPaywallRequired] = useState<{
    resource: string;
    amount: string;
    description: string;
    resolve: (sig: string) => void;
    reject: (err: any) => void;
  } | null>(null);
  
  const [paymentStatus, setPaymentStatus] = useState<string>(''); // 'signing' | 'settled' | ''
  const [paymentTx, setPaymentTx] = useState<string>('');
  const [unlockedResources, setUnlockedResources] = useState<Record<string, boolean>>({});
  const [receipts, setReceipts] = useState<Record<string, { amount: string; tx: string }>>({});

  // Chat states
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant' | 'system'; text: string; data?: any; paywall?: any }>>([
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
          setTimeout(() => setLoading(false), 600);
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

  // Parallax interaction and entrance animations
  useEffect(() => {
    if (loading || error || entered) return;

    const canvas = canvasRef.current;
    const layer1 = layer1Ref.current;
    const layer2 = layer2Ref.current;
    const layer3 = layer3Ref.current;

    if (!canvas || !layer1 || !layer2 || !layer3) return;

    canvas.style.opacity = '0';
    canvas.style.transform = 'rotateX(90deg) rotateZ(0deg) scale(0.8)';

    const entryTimeout = setTimeout(() => {
      canvas.style.transition = 'all 2.5s cubic-bezier(0.16, 1, 0.3, 1)';
      canvas.style.opacity = '1';
      canvas.style.transform = 'rotateX(55deg) rotateZ(-25deg) scale(1)';
    }, 100);

    const transitionTimeout = setTimeout(() => {
      canvas.style.transition = 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
    }, 2600);

    const handleMouseMove = (e: MouseEvent) => {
      const x = (window.innerWidth / 2 - e.pageX) / 25;
      const y = (window.innerHeight / 2 - e.pageY) / 25;

      canvas.style.transform = `rotateX(${55 + y / 2}deg) rotateZ(${-25 + x / 2}deg)`;
      layer1.style.transform = `translateZ(15px) translate(${x * 0.2}px, ${y * 0.2}px)`;
      layer2.style.transform = `translateZ(30px) translate(${x * 0.4}px, ${y * 0.4}px)`;
      layer3.style.transform = `translateZ(45px) translate(${x * 0.6}px, ${y * 0.6}px)`;
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      clearTimeout(entryTimeout);
      clearTimeout(transitionTimeout);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [loading, error, entered]);

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

  // Custom fetch function that handles 402 Payment Required
  const authenticatedFetch = async (url: string, path: string): Promise<any> => {
    // If resource is already unlocked in this session, attach the saved signature
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

      // Trigger paywall UI modal and await signature
      return new Promise((resolve, reject) => {
        setPaywallRequired({
          resource: path,
          amount: accepts.maxAmountRequired,
          description: accepts.description,
          resolve: async (signature: string) => {
            // Retry request with signature
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
                // Store unlocked state
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
      const mockTx = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
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

  // Fetch clustering results
  const fetchClustering = async (playerId: string) => {
    setPlayerClusterData(null);
    try {
      const data = await authenticatedFetch(
        `http://localhost:8000/cluster/player/${playerId}`,
        `/cluster/player/${playerId}`
      );
      setPlayerClusterData(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch prediction results
  const fetchPrediction = async (matchId: string) => {
    setPredictionData(null);
    try {
      const data = await authenticatedFetch(
        `http://localhost:8000/predict/match/${matchId}`,
        `/predict/match/${matchId}`
      );
      setPredictionData(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch tactical breakdown results
  const fetchTacticalBreakdown = async (matchId: string) => {
    setBreakdownData(null);
    try {
      const data = await authenticatedFetch(
        `http://localhost:8000/tactical/match/${matchId}`,
        `/tactical/match/${matchId}`
      );
      setBreakdownData(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch match highlights
  const fetchHighlights = async (matchId: string) => {
    setHighlightsData([]);
    try {
      const data = await authenticatedFetch(
        `http://localhost:8000/highlights/match/${matchId}`,
        `/highlights/match/${matchId}`
      );
      setHighlightsData(data.highlights);
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger loading when tab changes
  useEffect(() => {
    if (activeTab === 'clustering' && selectedPlayer) {
      fetchClustering(selectedPlayer);
    } else if (activeTab === 'analytics' && selectedMatchId) {
      fetchPrediction(selectedMatchId);
      fetchTacticalBreakdown(selectedMatchId);
    } else if (activeTab === 'highlights' && selectedMatchId) {
      fetchHighlights(selectedMatchId);
    }
  }, [activeTab, selectedPlayer, selectedMatchId]);

  // Handle chat submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput;
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');
    setChatLoading(true);

    try {
      // Simulate real-time MCP tool call orchestration
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
        // Render tool invocation log
        setMessages(prev => [...prev, {
          sender: 'system',
          text: `INVOKING_MCP_TOOL: fullback-mcp-server :: ${toolName}()\nSTATUS: 402 PAYMENT REQUIRED (${parseFloat(amount)/1000000} USDC required on Base Sepolia) :: ${desc}`
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
        // Free basic answers
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

  // Loading Screen
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#070806] text-[#e4e6e1] font-syncopate select-none">
        <div className="text-center space-y-6 max-w-xs md:max-w-sm px-6 flex flex-col items-center">
          <img src={logoMark} alt="FULL BACK Logo Mark" className="w-16 h-16 md:w-20 md:h-20 animate-pulse object-contain mb-2" />
          <div className="h-[2px] w-full bg-neutral-900 overflow-hidden relative">
            <div
              className="h-full bg-[#ff5a1f] transition-all duration-300 ease-out"
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

  // Connection Error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#070806] text-[#e4e6e1] font-syncopate select-none px-6 text-center">
        <div className="max-w-md p-8 border border-red-500/20 bg-black/40 backdrop-blur-md rounded">
          <div className="text-red-500 text-[1.2rem] md:text-[1.5rem] tracking-wider mb-4">▲ CONNECTION ERROR</div>
          <p className="mono text-[0.75rem] opacity-75 mb-6 leading-relaxed">
            FAILED TO INGEST FIELD VISUALIZATIONS. PLEASE CHECK YOUR INTERNET OR REF_RESOURCES PATHS.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mono border border-[#e4e6e1] text-[#e4e6e1] px-4 py-2 hover:bg-[#ff5a1f] hover:border-[#ff5a1f] hover:text-white transition duration-300 tracking-wider text-[0.7rem]"
          >
            RETRY_CONNECTION
          </button>
        </div>
      </div>
    );
  }

  // Dashboard Page
  if (entered) {
    return (
      <div className="flex h-screen w-screen bg-[#070806] text-[#e4e6e1] overflow-hidden relative font-jetbrains selection:bg-[#ff5a1f]/30">
        
        {/* Grain overlay */}
        <div className="fixed inset-0 pointer-events-none opacity-5 mix-blend-overlay z-50 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />

        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#ff5a1f]/3 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[600px] h-[600px] bg-green-500/2 blur-[150px] rounded-full pointer-events-none" />

        {/* Sidebar Nav */}
        <nav className="w-[18rem] shrink-0 border-r border-[#e4e6e1]/10 bg-black/55 backdrop-blur-md flex flex-col p-6 z-10">
          <div className="flex items-center gap-3 mb-10">
            <img src={logoMark} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-syncopate text-[0.8rem] tracking-widest font-bold">FULL BACK</span>
          </div>

          <div className="flex-1 space-y-2">
            <div className="text-[0.6rem] text-neutral-500 uppercase tracking-widest font-semibold mb-3 px-2">FREE_TIER</div>
            <button
              onClick={() => setActiveTab('fixtures')}
              className={`w-full flex items-center justify-between text-left px-4 py-3 rounded text-[0.75rem] tracking-wider transition ${activeTab === 'fixtures' ? 'bg-[#ff5a1f]/10 text-[#ff5a1f] border-l-2 border-[#ff5a1f] font-semibold' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'}`}
            >
              <span>FIXTURES & STANDINGS</span>
              <span className="text-[0.55rem] px-1.5 py-0.5 rounded border border-neutral-700 bg-neutral-900 text-neutral-500">FREE</span>
            </button>

            <div className="text-[0.6rem] text-neutral-500 uppercase tracking-widest font-semibold pt-6 mb-3 px-2">PREMIUM_ANALYTICS</div>
            <button
              onClick={() => setActiveTab('clustering')}
              className={`w-full flex items-center justify-between text-left px-4 py-3 rounded text-[0.75rem] tracking-wider transition ${activeTab === 'clustering' ? 'bg-[#ff5a1f]/10 text-[#ff5a1f] border-l-2 border-[#ff5a1f] font-semibold' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'}`}
            >
              <span>PLAYER CLUSTERING</span>
              <span className="text-[0.55rem] px-1.5 py-0.5 rounded border border-[#ff5a1f]/20 bg-[#ff5a1f]/5 text-[#ff5a1f] font-semibold">0.01$</span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center justify-between text-left px-4 py-3 rounded text-[0.75rem] tracking-wider transition ${activeTab === 'analytics' ? 'bg-[#ff5a1f]/10 text-[#ff5a1f] border-l-2 border-[#ff5a1f] font-semibold' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'}`}
            >
              <span>MATCH ANALYTICS</span>
              <span className="text-[0.55rem] px-1.5 py-0.5 rounded border border-[#ff5a1f]/20 bg-[#ff5a1f]/5 text-[#ff5a1f] font-semibold">0.15$</span>
            </button>
            <button
              onClick={() => setActiveTab('highlights')}
              className={`w-full flex items-center justify-between text-left px-4 py-3 rounded text-[0.75rem] tracking-wider transition ${activeTab === 'highlights' ? 'bg-[#ff5a1f]/10 text-[#ff5a1f] border-l-2 border-[#ff5a1f] font-semibold' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'}`}
            >
              <span>HIGHLIGHT DETECTOR</span>
              <span className="text-[0.55rem] px-1.5 py-0.5 rounded border border-[#ff5a1f]/20 bg-[#ff5a1f]/5 text-[#ff5a1f] font-semibold">0.08$</span>
            </button>

            <div className="text-[0.6rem] text-neutral-500 uppercase tracking-widest font-semibold pt-6 mb-3 px-2">AGENT_HUDS</div>
            <button
              onClick={() => setActiveTab('chat')}
              className={`w-full flex items-center justify-between text-left px-4 py-3 rounded text-[0.75rem] tracking-wider transition ${activeTab === 'chat' ? 'bg-[#ff5a1f]/10 text-[#ff5a1f] border-l-2 border-[#ff5a1f] font-semibold' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'}`}
            >
              <span>CHAT ANALYST</span>
              <span className="text-[0.55rem] px-1.5 py-0.5 rounded border border-neutral-700 bg-neutral-900 text-neutral-500">MIXED</span>
            </button>
          </div>

          {/* Connection status footer */}
          <div className="border-t border-[#e4e6e1]/10 pt-4 mt-auto">
            <div className="flex items-center justify-between text-[0.6rem] text-neutral-500 tracking-wider">
              <span>TELEMETRY_LINK</span>
              <span className="flex items-center gap-1.5 text-green-500">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                ONLINE
              </span>
            </div>
            <div className="text-[0.55rem] text-neutral-600 mt-1">BASE_SEPOLIA_NODE: CONNECTED</div>
          </div>
        </nav>

        {/* Main Content Pane */}
        <main className="flex-1 flex flex-col min-w-0 z-10 relative bg-black/20">
          
          {/* Header Panel */}
          <header className="h-[4.5rem] border-b border-[#e4e6e1]/10 px-8 flex items-center justify-between bg-black/40 backdrop-blur-sm">
            <div className="flex items-center gap-6">
              <span className="text-[0.8rem] font-bold tracking-widest font-syncopate">
                {activeTab.toUpperCase()} STATUS
              </span>
              <div className="h-4 w-[1px] bg-neutral-800" />
              <div className="mono text-[0.65rem] text-neutral-500 tracking-wider">
                WORLD CUP 2026 // MATCH: {selectedMatchId}
              </div>
            </div>

            {/* Match selector (for top bar) */}
            <div className="flex items-center gap-2">
              <span className="mono text-[0.6rem] text-neutral-500 uppercase tracking-widest mr-2">SELECT_MATCH:</span>
              {['M001', 'M002', 'M003'].map(id => (
                <button
                  key={id}
                  onClick={() => setSelectedMatchId(id)}
                  className={`mono text-[0.65rem] px-2.5 py-1 rounded border transition ${selectedMatchId === id ? 'border-[#ff5a1f] text-[#ff5a1f] bg-[#ff5a1f]/5' : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'}`}
                >
                  {id}
                </button>
              ))}
            </div>
          </header>

          {/* Tab Pages */}
          <div className="flex-1 overflow-y-auto p-8 max-w-6xl w-full mx-auto">
            
            {/* 1. Fixtures Tab */}
            {activeTab === 'fixtures' && (
              <div className="space-y-8 animate-fade-in">
                
                {/* Standings Cards */}
                <div>
                  <h3 className="mono text-[0.7rem] text-[#ff5a1f] tracking-widest uppercase mb-4">[ GROUP_STAGE_STANDINGS ]</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Group A */}
                    <div className="border border-[#e4e6e1]/10 bg-black/30 backdrop-blur-md rounded p-6">
                      <div className="flex justify-between items-center mb-4 border-b border-[#e4e6e1]/5 pb-2">
                        <span className="text-[0.75rem] font-bold tracking-widest font-syncopate">GROUP A</span>
                        <span className="mono text-[0.6rem] text-neutral-500">STAGE_ROUND_1</span>
                      </div>
                      <table className="w-full text-left mono text-[0.7rem] text-neutral-300">
                        <thead>
                          <tr className="text-neutral-500 border-b border-[#e4e6e1]/5">
                            <th className="py-2">POS</th>
                            <th className="py-2">TEAM</th>
                            <th className="py-2 text-center">P</th>
                            <th className="py-2 text-center">W-D-L</th>
                            <th className="py-2 text-center">GD</th>
                            <th className="py-2 text-right">PTS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e4e6e1]/5">
                          <tr className="hover:bg-neutral-900/30">
                            <td className="py-2 text-[#ff5a1f]">1</td>
                            <td className="py-2 font-semibold">🇩🇪 GERMANY</td>
                            <td className="py-2 text-center">1</td>
                            <td className="py-2 text-center">1-0-0</td>
                            <td className="py-2 text-center">+2</td>
                            <td className="py-2 text-right text-white">3</td>
                          </tr>
                          <tr className="hover:bg-neutral-900/30">
                            <td className="py-2 text-neutral-400">2</td>
                            <td className="py-2 font-semibold">🇺🇸 UNITED STATES</td>
                            <td className="py-2 text-center">1</td>
                            <td className="py-2 text-center">1-0-0</td>
                            <td className="py-2 text-center">+1</td>
                            <td className="py-2 text-right text-white">3</td>
                          </tr>
                          <tr className="hover:bg-neutral-900/30">
                            <td className="py-2 text-neutral-400">3</td>
                            <td className="py-2 font-semibold">🇨🇴 COLOMBIA</td>
                            <td className="py-2 text-center">1</td>
                            <td className="py-2 text-center">0-0-1</td>
                            <td className="py-2 text-center">-1</td>
                            <td className="py-2 text-right text-white">0</td>
                          </tr>
                          <tr className="hover:bg-neutral-900/30">
                            <td className="py-2 text-neutral-400">4</td>
                            <td className="py-2 font-semibold">🇯🇵 JAPAN</td>
                            <td className="py-2 text-center">1</td>
                            <td className="py-2 text-center">0-0-1</td>
                            <td className="py-2 text-center">-2</td>
                            <td className="py-2 text-right text-white">0</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Group B */}
                    <div className="border border-[#e4e6e1]/10 bg-black/30 backdrop-blur-md rounded p-6">
                      <div className="flex justify-between items-center mb-4 border-b border-[#e4e6e1]/5 pb-2">
                        <span className="text-[0.75rem] font-bold tracking-widest font-syncopate">GROUP B</span>
                        <span className="mono text-[0.6rem] text-neutral-500">STAGE_ROUND_1</span>
                      </div>
                      <table className="w-full text-left mono text-[0.7rem] text-neutral-300">
                        <thead>
                          <tr className="text-neutral-500 border-b border-[#e4e6e1]/5">
                            <th className="py-2">POS</th>
                            <th className="py-2">TEAM</th>
                            <th className="py-2 text-center">P</th>
                            <th className="py-2 text-center">W-D-L</th>
                            <th className="py-2 text-center">GD</th>
                            <th className="py-2 text-right">PTS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e4e6e1]/5">
                          <tr className="hover:bg-neutral-900/30">
                            <td className="py-2 text-[#ff5a1f]">1</td>
                            <td className="py-2 font-semibold">🇫🇷 FRANCE</td>
                            <td className="py-2 text-center">1</td>
                            <td className="py-2 text-center">1-0-0</td>
                            <td className="py-2 text-center">+1</td>
                            <td className="py-2 text-right text-white">3</td>
                          </tr>
                          <tr className="hover:bg-neutral-900/30">
                            <td className="py-2 text-neutral-400">2</td>
                            <td className="py-2 font-semibold">🇦🇷 ARGENTINA</td>
                            <td className="py-2 text-center">1</td>
                            <td className="py-2 text-center">0-1-0</td>
                            <td className="py-2 text-center">0</td>
                            <td className="py-2 text-right text-white">1</td>
                          </tr>
                          <tr className="hover:bg-neutral-900/30">
                            <td className="py-2 text-neutral-400">3</td>
                            <td className="py-2 font-semibold">🏴󠁧󠁢󠁥󠁮󠁧󠁿 ENGLAND</td>
                            <td className="py-2 text-center">1</td>
                            <td className="py-2 text-center">0-1-0</td>
                            <td className="py-2 text-center">0</td>
                            <td className="py-2 text-right text-white">1</td>
                          </tr>
                          <tr className="hover:bg-neutral-900/30">
                            <td className="py-2 text-neutral-400">4</td>
                            <td className="py-2 font-semibold">🇲🇦 MOROCCO</td>
                            <td className="py-2 text-center">1</td>
                            <td className="py-2 text-center">0-0-1</td>
                            <td className="py-2 text-center">-1</td>
                            <td className="py-2 text-right text-white">0</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Fixture Schedule */}
                <div>
                  <h3 className="mono text-[0.7rem] text-[#ff5a1f] tracking-widest uppercase mb-4">[ FIXTURE_MATRIX ]</h3>
                  <div className="space-y-4">
                    
                    {/* Match M001 */}
                    <div className="border border-[#e4e6e1]/10 bg-black/20 hover:bg-neutral-900/10 transition p-6 rounded flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <span className="mono text-[0.75rem] text-[#ff5a1f] font-semibold">M001</span>
                        <div>
                          <div className="text-[0.8rem] font-semibold text-white">🇺🇸 USA vs 🇨🇴 COLOMBIA</div>
                          <div className="mono text-[0.6rem] text-neutral-500 mt-1">GROUP A · NIGHT MATCH</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="mono text-[0.8rem] font-bold text-[#ff5a1f] border border-[#ff5a1f]/20 bg-[#ff5a1f]/5 px-3 py-1 rounded">
                          2 - 1
                        </div>
                        <div className="mono text-right text-[0.65rem] text-neutral-500">
                          <div>STATUS: FINISHED</div>
                          <div>DATE: 2026-06-12</div>
                        </div>
                      </div>
                    </div>

                    {/* Match M002 */}
                    <div className="border border-[#e4e6e1]/10 bg-black/20 hover:bg-neutral-900/10 transition p-6 rounded flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <span className="mono text-[0.75rem] text-[#ff5a1f] font-semibold">M002</span>
                        <div>
                          <div className="text-[0.8rem] font-semibold text-white">🇩🇪 GERMANY vs 🇯🇵 JAPAN</div>
                          <div className="mono text-[0.6rem] text-neutral-500 mt-1">GROUP A · NIGHT MATCH</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="mono text-[0.8rem] font-bold text-[#ff5a1f] border border-[#ff5a1f]/20 bg-[#ff5a1f]/5 px-3 py-1 rounded">
                          3 - 1
                        </div>
                        <div className="mono text-right text-[0.65rem] text-neutral-500">
                          <div>STATUS: FINISHED</div>
                          <div>DATE: 2026-06-13</div>
                        </div>
                      </div>
                    </div>

                    {/* Match M003 */}
                    <div className="border border-[#e4e6e1]/10 bg-black/20 hover:bg-neutral-900/10 transition p-6 rounded flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <span className="mono text-[0.75rem] text-[#ff5a1f] font-semibold">M003</span>
                        <div>
                          <div className="text-[0.8rem] font-semibold text-white">🇦🇷 ARGENTINA vs 🏴󠁧󠁢󠁥󠁮󠁧󠁿 ENGLAND</div>
                          <div className="mono text-[0.6rem] text-neutral-500 mt-1">GROUP B · NIGHT MATCH</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="mono text-[0.8rem] font-bold text-[#ff5a1f] border border-[#ff5a1f]/20 bg-[#ff5a1f]/5 px-3 py-1 rounded">
                          2 - 2
                        </div>
                        <div className="mono text-right text-[0.65rem] text-neutral-500">
                          <div>STATUS: FINISHED</div>
                          <div>DATE: 2026-06-14</div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            )}

            {/* 2. Player Clustering Tab */}
            {activeTab === 'clustering' && (
              <div className="space-y-8 animate-fade-in">
                
                {/* Info and selector */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Selector pane */}
                  <div className="border border-[#e4e6e1]/10 bg-black/30 backdrop-blur-md rounded p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="mono text-[0.7rem] text-[#ff5a1f] tracking-widest uppercase mb-4">[ TARGET_SELECTION ]</h3>
                      <p className="mono text-[0.65rem] text-neutral-500 leading-relaxed mb-6">
                        SELECT A TARGET PLAYER TO COMPILE K-MEANS NEAREST SIMILAR CLUSTERING FROM DATASET.
                      </p>
                      
                      <div className="space-y-2">
                        <label className="mono text-[0.6rem] text-neutral-400">PLAYER_NAME:</label>
                        <select
                          value={selectedPlayer}
                          onChange={(e) => setSelectedPlayer(e.target.value)}
                          className="w-full bg-[#070806] border border-[#e4e6e1]/20 rounded px-3 py-2 text-[0.75rem] text-white focus:outline-none focus:border-[#ff5a1f] font-jetbrains"
                        >
                          {players.length > 0 ? (
                            players.slice(0, 30).map(p => (
                              <option key={p.player_id} value={p.player_id}>
                                {p.name} ({p.position})
                              </option>
                            ))
                          ) : (
                            <option>Loading players list...</option>
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-[#e4e6e1]/5 mt-6">
                      <div className="mono text-[0.6rem] text-neutral-500 flex justify-between">
                        <span>MODEL_SILHOUETTE:</span>
                        <span className="text-[#ff5a1f] font-semibold">0.226</span>
                      </div>
                      <div className="mono text-[0.6rem] text-neutral-500 flex justify-between mt-1.5">
                        <span>FEATURES_DIM:</span>
                        <span className="text-white">7 (Goals, Assists, Key Passes, Tackles...)</span>
                      </div>
                    </div>
                  </div>

                  {/* Similarity Results Card */}
                  <div className="lg:col-span-2 border border-[#e4e6e1]/10 bg-black/30 backdrop-blur-md rounded p-6 relative min-h-[300px] flex flex-col">
                    
                    {!playerClusterData ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 border-2 border-t-[#ff5a1f] border-neutral-800 rounded-full animate-spin mb-4" />
                        <span className="mono text-[0.65rem] text-neutral-500">REQUESTING CLUSTER TELEMETRY...</span>
                      </div>
                    ) : (
                      <div className="space-y-6 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start border-b border-[#e4e6e1]/5 pb-3">
                            <div>
                              <h2 className="text-[1rem] font-bold text-white uppercase">{playerClusterData.player.name}</h2>
                              <div className="mono text-[0.6rem] text-neutral-500 mt-1">
                                NATIONALITY: {playerClusterData.player.nationality.toUpperCase()} · POSITION: {playerClusterData.player.position.toUpperCase()}
                              </div>
                            </div>
                            
                            {receipts[`/cluster/player/${selectedPlayer}`] && (
                              <span className="mono text-[0.55rem] px-2 py-0.5 border border-[#ff5a1f]/30 bg-[#ff5a1f]/5 text-[#ff5a1f] rounded">
                                SETTLED · 0.01 USDC · BASE
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            <div>
                              <div className="text-[0.6rem] text-neutral-500 uppercase tracking-widest font-semibold mb-2">ARCHETYPE_ALLOCATION</div>
                              <div className="border border-[#ff5a1f]/20 bg-[#ff5a1f]/5 rounded p-3 text-[0.75rem] font-bold text-[#ff5a1f] tracking-wide">
                                {playerClusterData.player.archetype.toUpperCase()}
                              </div>
                              <p className="mono text-[0.65rem] text-neutral-400 leading-relaxed mt-2.5">
                                Allocated dynamically via K-Means centroid placement based on per-90 metrics.
                              </p>
                            </div>

                            <div>
                              <div className="text-[0.6rem] text-neutral-500 uppercase tracking-widest font-semibold mb-2">NEAREST_NEIGHBOR_MATRICES</div>
                              <div className="space-y-1.5">
                                {playerClusterData.similar_players.slice(0, 3).map((p: any) => (
                                  <div key={p.player_id} className="flex justify-between items-center text-[0.7rem] bg-neutral-900/40 border border-[#e4e6e1]/5 px-2.5 py-1.5 rounded">
                                    <span className="font-semibold text-white">{p.name}</span>
                                    <span className="mono text-[0.6rem] text-[#ff5a1f]">DIST: {p.similarity_distance.toFixed(3)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-[#e4e6e1]/5 pt-4 flex justify-between items-center text-[0.65rem] mono text-neutral-500">
                          <span>MARKET_VALUE: €{playerClusterData.player.market_value_m}M</span>
                          <span>MINUTES_PLAYED: {playerClusterData.player.minutes_played}m</span>
                          <span>GOALS_90: {((playerClusterData.player.goals / playerClusterData.player.minutes_played) * 90).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* 2D PCA Scatter plot */}
                <div className="border border-[#e4e6e1]/10 bg-black/30 backdrop-blur-md rounded p-6">
                  <h3 className="mono text-[0.7rem] text-[#ff5a1f] tracking-widest uppercase mb-4">[ PCA_PROJECTION_SCATTER ]</h3>
                  <div className="relative aspect-[21/9] w-full border border-[#e4e6e1]/5 bg-[#070806]/40 rounded overflow-hidden flex items-center justify-center">
                    
                    {players.length === 0 ? (
                      <span className="mono text-[0.65rem] text-neutral-500">LOADING PCA DIMENSION MAP...</span>
                    ) : (
                      <svg className="w-full h-full" viewBox="0 0 1000 400">
                        {/* Grid lines */}
                        <line x1="500" y1="0" x2="500" y2="400" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                        <line x1="0" y1="200" x2="1000" y2="200" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                        
                        {/* Map players */}
                        {players.map((p) => {
                          const px = p.pca_x || 0;
                          const py = p.pca_y || 0;
                          
                          // Transform data PCA x, y (which range roughly -3 to 4) to SVG coords (100 to 900, 50 to 350)
                          const cx = 500 + px * 90;
                          const cy = 200 - py * 90;
                          
                          const isSelected = p.player_id === selectedPlayer;
                          const clusterColor = p.cluster === 0 ? '#ff5a1f' : p.cluster === 1 ? '#6ba642' : p.cluster === 2 ? '#3b82f6' : p.cluster === 3 ? '#a855f7' : '#eab308';
                          
                          return (
                            <circle
                              key={p.player_id}
                              cx={cx}
                              cy={cy}
                              r={isSelected ? 6 : 2.5}
                              fill={isSelected ? '#ff5a1f' : clusterColor}
                              stroke={isSelected ? '#white' : 'transparent'}
                              strokeWidth={2}
                              className="cursor-pointer transition hover:r-5 opacity-75"
                              onClick={() => {
                                setSelectedPlayer(p.player_id);
                              }}
                            >
                              <title>{p.name} ({p.archetype})</title>
                            </circle>
                          );
                        })}

                        {/* Selected target highlighted */}
                        {(() => {
                          const target = players.find(p => p.player_id === selectedPlayer);
                          if (!target) return null;
                          const cx = 500 + (target.pca_x || 0) * 90;
                          const cy = 200 - (target.pca_y || 0) * 90;
                          return (
                            <g>
                              <circle cx={cx} cy={cy} r={14} fill="none" stroke="#ff5a1f" strokeWidth="1.5" className="animate-pulse" />
                              <text x={cx + 18} y={cy + 4} fill="white" className="mono text-[0.55rem] font-bold uppercase">{target.name}</text>
                            </g>
                          );
                        })()}
                      </svg>
                    )}

                    {/* Scatter Legend */}
                    <div className="absolute bottom-4 left-4 flex flex-wrap gap-4 bg-black/80 border border-neutral-800 p-3 rounded">
                      <div className="flex items-center gap-1.5 text-[0.6rem] mono">
                        <span className="w-2 h-2 bg-[#ff5a1f] rounded-full" />
                        <span>GOALSCORER</span>
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

            {/* 3. Match Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-8 animate-fade-in">
                
                {/* 3.1 Outcome Prediction */}
                <div className="border border-[#e4e6e1]/10 bg-black/30 backdrop-blur-md rounded p-6">
                  <div className="flex justify-between items-center mb-6 border-b border-[#e4e6e1]/5 pb-3">
                    <h3 className="mono text-[0.7rem] text-[#ff5a1f] tracking-widest uppercase">[ PREDICT_OUTCOME_ANALYSIS ]</h3>
                    
                    {receipts[`/predict/match/${selectedMatchId}`] && (
                      <span className="mono text-[0.55rem] px-2 py-0.5 border border-[#ff5a1f]/30 bg-[#ff5a1f]/5 text-[#ff5a1f] rounded">
                        SETTLED · 0.05 USDC · BASE
                      </span>
                    )}
                  </div>

                  {!predictionData ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <div className="w-8 h-8 border-2 border-t-[#ff5a1f] border-neutral-800 rounded-full animate-spin mb-4" />
                      <span className="mono text-[0.65rem] text-neutral-500">GENERATING AI MATCH PREDICTIONS...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Probabilities gauge */}
                      <div className="border border-[#e4e6e1]/5 bg-[#070806]/40 p-6 rounded flex flex-col justify-between">
                        <h4 className="mono text-[0.65rem] text-neutral-500 uppercase mb-4">ALGORITHM_PROBABILITIES</h4>
                        
                        <div className="space-y-4">
                          {/* Home win */}
                          <div>
                            <div className="flex justify-between text-[0.7rem] mono mb-1.5">
                              <span>{predictionData.home_team.toUpperCase()}_WIN</span>
                              <span className="text-[#ff5a1f] font-semibold">{predictionData.probabilities.home_win}%</span>
                            </div>
                            <div className="h-[3px] bg-neutral-900 overflow-hidden rounded-full">
                              <div className="h-full bg-[#ff5a1f]" style={{ width: `${predictionData.probabilities.home_win}%` }} />
                            </div>
                          </div>

                          {/* Away win */}
                          <div>
                            <div className="flex justify-between text-[0.7rem] mono mb-1.5">
                              <span>{predictionData.away_team.toUpperCase()}_WIN</span>
                              <span className="text-white font-semibold">{predictionData.probabilities.away_win}%</span>
                            </div>
                            <div className="h-[3px] bg-neutral-900 overflow-hidden rounded-full">
                              <div className="h-full bg-neutral-400" style={{ width: `${predictionData.probabilities.away_win}%` }} />
                            </div>
                          </div>

                          {/* Draw */}
                          <div>
                            <div className="flex justify-between text-[0.7rem] mono mb-1.5">
                              <span>DRAW</span>
                              <span className="text-neutral-500 font-semibold">{predictionData.probabilities.draw}%</span>
                            </div>
                            <div className="h-[3px] bg-neutral-900 overflow-hidden rounded-full">
                              <div className="h-full bg-neutral-700" style={{ width: `${predictionData.probabilities.draw}%` }} />
                            </div>
                          </div>
                        </div>

                        <div className="mono text-[0.55rem] text-neutral-600 border-t border-neutral-900 pt-4 mt-6">
                          ENGINE: FULL_BACK_MATCHUP_SIMULATOR_V1
                        </div>
                      </div>

                      {/* AI Prediction Text */}
                      <div className="lg:col-span-2 flex flex-col">
                        <h4 className="mono text-[0.65rem] text-neutral-500 uppercase mb-3">AI_ANALYST_REPORT</h4>
                        <div className="prose prose-invert max-w-none text-[0.75rem] text-neutral-300 leading-relaxed font-jetbrains bg-black/10 border border-neutral-900 p-5 rounded overflow-y-auto max-h-[300px]">
                          {predictionData.prediction_analysis.split('\n').map((para: string, idx: number) => (
                            <p key={idx} className="mb-3">{para}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3.2 Tactical Post-Match Breakdown */}
                <div className="border border-[#e4e6e1]/10 bg-black/30 backdrop-blur-md rounded p-6">
                  <div className="flex justify-between items-center mb-6 border-b border-[#e4e6e1]/5 pb-3">
                    <h3 className="mono text-[0.7rem] text-[#ff5a1f] tracking-widest uppercase">[ TACTICAL_POST_MATCH_BREAKDOWN ]</h3>
                    
                    {receipts[`/tactical/match/${selectedMatchId}`] && (
                      <span className="mono text-[0.55rem] px-2 py-0.5 border border-[#ff5a1f]/30 bg-[#ff5a1f]/5 text-[#ff5a1f] rounded">
                        SETTLED · 0.10 USDC · BASE
                      </span>
                    )}
                  </div>

                  {!breakdownData ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <div className="w-8 h-8 border-2 border-t-[#ff5a1f] border-neutral-800 rounded-full animate-spin mb-4" />
                      <span className="mono text-[0.65rem] text-neutral-500">GENERATING AI TACTICAL REPORT...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Telemetry Stats */}
                      <div className="border border-[#e4e6e1]/5 bg-[#070806]/40 p-6 rounded flex flex-col justify-between">
                        <div>
                          <h4 className="mono text-[0.65rem] text-neutral-500 uppercase mb-4">MATCH_STATS_TELEMETRY</h4>
                          
                          <div className="space-y-3 font-jetbrains text-[0.7rem]">
                            {/* Possession */}
                            <div className="flex justify-between items-center border-b border-neutral-900 pb-1.5">
                              <span className="text-neutral-400">POSSESSION</span>
                              <span className="text-white font-semibold">
                                {breakdownData.stats_snapshot.possession.home}% / {breakdownData.stats_snapshot.possession.away}%
                              </span>
                            </div>
                            {/* Shots */}
                            <div className="flex justify-between items-center border-b border-neutral-900 pb-1.5">
                              <span className="text-neutral-400">SHOTS (ON_TARGET)</span>
                              <span className="text-white font-semibold">
                                {breakdownData.stats_snapshot.shots.home}({breakdownData.stats_snapshot.shots_on_target.home}) / {breakdownData.stats_snapshot.shots.away}({breakdownData.stats_snapshot.shots_on_target.away})
                              </span>
                            </div>
                            {/* Pass accuracy */}
                            <div className="flex justify-between items-center border-b border-neutral-900 pb-1.5">
                              <span className="text-neutral-400">PASS_ACCURACY</span>
                              <span className="text-white font-semibold">
                                {breakdownData.stats_snapshot.pass_accuracy.home}% / {breakdownData.stats_snapshot.pass_accuracy.away}%
                              </span>
                            </div>
                            {/* Corners */}
                            <div className="flex justify-between items-center pb-1.5">
                              <span className="text-neutral-400">CORNERS</span>
                              <span className="text-white font-semibold">
                                {breakdownData.stats_snapshot.corners.home} / {breakdownData.stats_snapshot.corners.away}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mono text-[0.55rem] text-neutral-600 border-t border-neutral-900 pt-4 mt-6">
                          POST_MATCH_FINAL_SCORE: {breakdownData.score}
                        </div>
                      </div>

                      {/* Breakdown Text */}
                      <div className="lg:col-span-2 flex flex-col">
                        <h4 className="mono text-[0.65rem] text-neutral-500 uppercase mb-3">AI_TACTICAL_BREAKDOWN</h4>
                        <div className="prose prose-invert max-w-none text-[0.75rem] text-neutral-300 leading-relaxed font-jetbrains bg-black/10 border border-neutral-900 p-5 rounded overflow-y-auto max-h-[300px]">
                          {breakdownData.tactical_breakdown.split('\n').map((para: string, idx: number) => (
                            <p key={idx} className="mb-3">{para}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* 4. Highlight Detector Tab */}
            {activeTab === 'highlights' && (
              <div className="space-y-8 animate-fade-in">
                
                <div className="border border-[#e4e6e1]/10 bg-black/30 backdrop-blur-md rounded p-6">
                  <div className="flex justify-between items-center mb-6 border-b border-[#e4e6e1]/5 pb-3">
                    <h3 className="mono text-[0.7rem] text-[#ff5a1f] tracking-widest uppercase">[ AUDIO_PEAK_HIGHLIGHT_DETECTOR ]</h3>
                    
                    {receipts[`/highlights/match/${selectedMatchId}`] && (
                      <span className="mono text-[0.55rem] px-2 py-0.5 border border-[#ff5a1f]/30 bg-[#ff5a1f]/5 text-[#ff5a1f] rounded">
                        SETTLED · 0.08 USDC · BASE
                      </span>
                    )}
                  </div>

                  {highlightsData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <div className="w-8 h-8 border-2 border-t-[#ff5a1f] border-neutral-800 rounded-full animate-spin mb-4" />
                      <span className="mono text-[0.65rem] text-neutral-500">EXTRACTING CROWD CHEER DECIBEL SPECTRUM...</span>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* simulated wave plot */}
                      <div className="border border-neutral-900 bg-neutral-950/40 p-4 rounded relative">
                        <div className="mono text-[0.55rem] text-neutral-500 mb-2 uppercase">AUDIO_RMS_LOUDNESS_DECIBELS (PEAKS MARKED)</div>
                        <svg className="w-full h-16" viewBox="0 0 1000 64" preserveAspectRatio="none">
                          <path
                            d={`M 0 32 ${Array.from({length: 100}, (_, i) => {
                              const isPeak = i === 18 || i === 58 || i === 82;
                              const height = isPeak ? 10 + Math.random() * 40 : 15 + Math.random() * 15;
                              return `L ${i * 10} ${32 - height} L ${i * 10 + 5} ${32 + height}`;
                            }).join(' ')} L 1000 32`}
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.15)"
                            strokeWidth="1.5"
                          />
                          
                          {/* Marked peaks */}
                          <circle cx="180" cy="12" r="4" fill="#ff5a1f" />
                          <line x1="180" y1="12" x2="180" y2="64" stroke="#ff5a1f" strokeDasharray="3,3" strokeWidth="1" />
                          
                          <circle cx="580" cy="8" r="4" fill="#ff5a1f" />
                          <line x1="580" y1="8" x2="580" y2="64" stroke="#ff5a1f" strokeDasharray="3,3" strokeWidth="1" />
                          
                          <circle cx="820" cy="10" r="4" fill="#ff5a1f" />
                          <line x1="820" y1="10" x2="820" y2="64" stroke="#ff5a1f" strokeDasharray="3,3" strokeWidth="1" />
                        </svg>
                      </div>

                      {/* Video gallery grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {highlightsData.map((clip) => (
                          <div key={clip.id} className="border border-neutral-800 bg-[#070806] rounded overflow-hidden flex flex-col justify-between group hover:border-[#ff5a1f]/30 transition">
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
                  )}
                </div>

              </div>
            )}

            {/* 5. Chat Analyst Tab */}
            {activeTab === 'chat' && (
              <div className="h-[calc(100vh-14rem)] flex flex-col border border-[#e4e6e1]/10 bg-black/30 backdrop-blur-md rounded overflow-hidden animate-fade-in">
                
                {/* Messages pane */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-[0.75rem]">
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex ${m.sender === 'user' ? 'justify-end' : m.sender === 'system' ? 'justify-center' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xl p-4 rounded border whitespace-pre-wrap leading-relaxed ${m.sender === 'user' ? 'bg-[#ff5a1f]/10 border-[#ff5a1f]/30 text-white' : m.sender === 'system' ? 'bg-neutral-950 border-neutral-900 text-neutral-500 text-[0.65rem] text-center w-full' : 'bg-neutral-900/50 border-[#e4e6e1]/5 text-neutral-300'}`}
                      >
                        {m.sender === 'assistant' && (
                          <div className="text-[#ff5a1f] text-[0.6rem] uppercase tracking-widest font-bold mb-1">[ FULL_BACK_ANALYST ]</div>
                        )}
                        {m.sender === 'user' && (
                          <div className="text-white text-[0.6rem] uppercase tracking-widest font-bold mb-1 text-right">[ USER ]</div>
                        )}
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="max-w-xl p-4 rounded border bg-neutral-900/50 border-[#e4e6e1]/5 text-neutral-500 animate-pulse">
                        ANALYST IS COMPILING TACTICAL DATA...
                      </div>
                    </div>
                  )}
                </div>

                {/* Input form */}
                <form onSubmit={handleChatSubmit} className="h-14 border-t border-[#e4e6e1]/10 bg-black/40 flex items-center px-4">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="ASK A TACTICAL QUESTION (e.g. 'what type of player is Lionel Messi' or 'predict match')"
                    className="flex-1 bg-transparent text-[0.75rem] text-white focus:outline-none placeholder-neutral-600 font-jetbrains px-2"
                  />
                  <button
                    type="submit"
                    className="mono border border-neutral-800 text-neutral-400 px-4 py-1.5 rounded hover:border-[#ff5a1f] hover:text-[#ff5a1f] transition text-[0.7rem]"
                  >
                    SEND_QUERY
                  </button>
                </form>

              </div>
            )}

          </div>

        </main>

        {/* 402 Paywall Modal */}
        {paywallRequired && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none">
            <div className="max-w-md w-full border border-[#ff5a1f]/30 bg-[#070806] rounded p-6 shadow-2xl space-y-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-[#ff5a1f]" />
              
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 border border-neutral-800 bg-[#ff5a1f]/5 flex items-center justify-center text-[#ff5a1f] text-[1.2rem] font-bold">
                  ▲
                </div>
                <div className="space-y-1">
                  <h3 className="mono text-[0.85rem] font-bold text-white tracking-wider">HTTP 402 PAYMENT REQUIRED</h3>
                  <div className="mono text-[0.6rem] text-neutral-500">SCHEME: EIP-3009 (EXACT) · NETWORK: BASE SEPOLIA</div>
                </div>
              </div>

              <div className="border border-neutral-900 bg-black/40 p-4 rounded space-y-3 text-[0.7rem] mono">
                <div className="flex justify-between border-b border-neutral-900 pb-1.5">
                  <span className="text-neutral-500">RESOURCE_GATED:</span>
                  <span className="text-white truncate max-w-[200px]">{paywallRequired.resource}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-900 pb-1.5">
                  <span className="text-neutral-500">PAY_TO_ADDRESS:</span>
                  <span className="text-white font-semibold">0x7099797...79C8</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">REQUIRED_USDC:</span>
                  <span className="text-[#ff5a1f] font-bold">{parseFloat(paywallRequired.amount) / 1000000} USDC</span>
                </div>
              </div>

              <p className="mono text-[0.65rem] text-neutral-400 leading-relaxed">
                This endpoint requires payment via base Sepolia USDC micropayment. AI Analyst will sign a transaction and verify the settlement instantly.
              </p>

              {paymentStatus === '' ? (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      const rejectFn = paywallRequired.reject;
                      setPaywallRequired(null);
                      rejectFn(new Error('User rejected payment authorization'));
                    }}
                    className="mono border border-neutral-800 text-neutral-400 py-2.5 hover:bg-neutral-900 transition tracking-wider text-[0.7rem] rounded"
                  >
                    ABORT_QUERY
                  </button>
                  <button
                    onClick={handlePaywallSettle}
                    className="mono bg-[#ff5a1f] text-white py-2.5 hover:bg-[#ff5a1f]/90 transition tracking-wider text-[0.7rem] font-bold rounded"
                  >
                    AUTHORIZE_&_PAY
                  </button>
                </div>
              ) : (
                <div className="border border-neutral-800 bg-neutral-950 p-4 rounded text-center space-y-2">
                  {paymentStatus === 'signing' ? (
                    <>
                      <div className="w-5 h-5 border-2 border-t-[#ff5a1f] border-neutral-800 rounded-full animate-spin mx-auto mb-2" />
                      <div className="mono text-[0.65rem] text-neutral-500 uppercase tracking-widest">SIGNING_EIP3009_PERMIT_PROOF...</div>
                    </>
                  ) : (
                    <>
                      <div className="text-green-500 text-[1.1rem] mb-1">✔ SETTLED</div>
                      <div className="mono text-[0.55rem] text-neutral-500 uppercase truncate">TX: {paymentTx}</div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    );
  }

  // Hero Landing Page
  return (
    <div className="field-body select-none">
      <svg className="absolute w-0 h-0 pointer-events-none">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>

      <div className="backdrop" />
      <div className="field-grain" style={{ filter: 'url(#grain)' }} />

      <div className="interface-grid">
        <div className="flex items-center">
          <img src={logoFull} alt="FULL BACK Logo" className="h-8 md:h-10 w-auto object-contain pointer-events-auto" />
        </div>
        <div className="mono text-right text-[#ff5a1f] text-[0.65rem] md:text-[0.7rem] leading-relaxed">
          <div>LATITUDE: 41.8623° N</div>
          <div>FLOODLIGHT: 4000K</div>
        </div>

        <h1 className="hero-title select-none">
          FULL<br />BACK
        </h1>

        <div className="col-span-2 flex justify-between items-end gap-4 flex-wrap">
          <div className="mono text-[0.7rem] md:text-[0.75rem] opacity-90 text-[#e4e6e1] leading-relaxed">
            <p className="mb-1 text-[#ff5a1f] font-semibold">[ PREMIUM WORLD CUP ANALYSIS ENGINE ]</p>
            <p>MICROPAYMENT GATED TACTICAL &amp; DATA SCIENCE TELEMETRY</p>
          </div>
          <button onClick={() => setEntered(true)} className="cta-button">
            ENTER THE FIELD
          </button>
        </div>
      </div>

      <div className="viewport">
        <div className="canvas-3d" ref={canvasRef} id="canvas3d">
          <div className="layer layer-1" ref={layer1Ref} data-layer="0" />
          <div className="layer layer-2" ref={layer2Ref} data-layer="1" />
          <div className="layer layer-3" ref={layer3Ref} data-layer="2" />
          <div className="yard-lines" />
        </div>
      </div>

      <div className="scroll-hint" />
    </div>
  );
}

// Helpers
const intToTime = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};
