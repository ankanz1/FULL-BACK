import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import logoMark from './assets/logo_mark.png';

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

// Custom 3D Low-Poly Vector Football and Stadium Wireframe Canvas component
function LowPolyCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    // Resize listener
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Track mouse move for cursor reaction
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.targetX = ((e.clientX - rect.left) / width) * 2 - 1;
      mouseRef.current.targetY = -(((e.clientY - rect.top) / height) * 2 - 1);
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Define 3D low-poly wireframe vertices (sphere/icosahedron for soccer ball)
    const t = (1.0 + Math.sqrt(5.0)) / 2.0;
    const baseVertices = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
    ].map(v => {
      const length = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
      return [v[0]/length, v[1]/length, v[2]/length];
    });

    const faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];

    let angleX = 0;
    let angleY = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse interpolation
      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.1;
      mouse.y += (mouse.targetY - mouse.y) * 0.1;

      // Auto-rotation speed influenced by mouse hover
      angleX += 0.005 + mouse.y * 0.02;
      angleY += 0.008 + mouse.x * 0.02;

      ctx.save();
      ctx.translate(width / 2, height / 2);
      
      const scale = Math.min(width, height) * 0.35;
      const projected: Array<[number, number, number]> = [];

      // Rotate and project vertices
      baseVertices.forEach(v => {
        let x = v[0];
        let y = v[1];
        let z = v[2];

        // Rotate Y
        let cosY = Math.cos(angleY);
        let sinY = Math.sin(angleY);
        let x1 = x * cosY - z * sinY;
        let z1 = x * sinY + z * cosY;

        // Rotate X
        let cosX = Math.cos(angleX);
        let sinX = Math.sin(angleX);
        let y2 = y * cosX - z1 * sinX;
        let z2 = y * sinX + z1 * cosX;

        // Perspective projection
        const distance = 2.5;
        const perspective = 1 / (distance - z2);
        projected.push([x1 * scale * perspective, y2 * scale * perspective, z2]);
      });

      // Draw wireframe faces
      ctx.strokeStyle = '#D9622B'; // Accent burnt orange
      ctx.lineWidth = 1;
      
      faces.forEach(face => {
        const p1 = projected[face[0]];
        const p2 = projected[face[1]];
        const p3 = projected[face[2]];

        // Simple backface culling (only draw faces pointing forward)
        const v1x = p2[0] - p1[0];
        const v1y = p2[1] - p1[1];
        const v2x = p3[0] - p1[0];
        const v2y = p3[1] - p1[1];
        const normalZ = v1x * v2y - v1y * v2x;

        if (normalZ > 0) {
          ctx.beginPath();
          ctx.moveTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          ctx.lineTo(p3[0], p3[1]);
          ctx.closePath();
          ctx.fillStyle = 'rgba(23, 23, 21, 0.4)';
          ctx.fill();
          ctx.stroke();
        }
      });

      // Draw telemetry coordinate markers around the grid bounds
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block bg-transparent" />;
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
  const canvas3dRef = useRef<HTMLDivElement>(null);

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

  // GSAP Entrance Animations
  const triggerEntranceAnims = () => {
    // 3D Canvas fade in
    gsap.fromTo('#stadium-backdrop', 
      { opacity: 0, scale: 0.9 }, 
      { opacity: 1, scale: 1, duration: 2, ease: 'power3.out' }
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

    // GSAP diagonal orange sweep wipe
    const tl = gsap.timeline({
      onComplete: () => {
        setCurrentPath(path);
        setIsTransitioning(false);
        // Wipe sweep out
        gsap.to(sweep, { xPercent: 100, skewX: 0, duration: 0.6, ease: 'power3.in' });
      }
    });

    tl.set(sweep, { xPercent: -100, skewX: -20 })
      .to(sweep, { xPercent: 0, skewX: 0, duration: 0.6, ease: 'power3.out' });
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

  // Hook datasets based on page loading
  useEffect(() => {
    if (currentPath === '/players' && selectedPlayer) {
      fetchClustering(selectedPlayer);
    } else if (currentPath === '/analyst' && selectedMatchId) {
      fetchPrediction(selectedMatchId);
      fetchTacticalBreakdown(selectedMatchId);
    } else if (currentPath === '/highlights' && selectedMatchId) {
      fetchHighlights(selectedMatchId);
    }
  }, [currentPath, selectedPlayer, selectedMatchId]);

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
          text: `INVOKING_MCP_TOOL: fullback-mcp-server :: ${toolName}()\nSTATUS: 402 PAYMENT REQUIRED (${parseFloat(amount)/1000000} USDC required) :: ${desc}`
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
      
      {/* Sticky Header Navigation */}
      <header className="fixed top-0 left-0 w-full h-16 border-b border-[#2A2A28] bg-[#0E0E0E]/80 backdrop-blur-md z-40 px-6 md:px-12 flex items-center justify-between">
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

      {/* Main Content Body */}
      <main className="flex-grow pt-16 z-10 flex flex-col relative">
        
        {/* Route transition sweep curtain */}
        <div
          ref={transitionSweepRef}
          className="fixed top-0 left-0 w-full h-full bg-[#D9622B] z-50 transform -translate-x-full pointer-events-none"
        />

        {/* 1. HOME PATH */}
        {currentPath === '/' && (
          <div className="flex-grow flex flex-col items-center justify-center relative min-h-[calc(100vh-4rem)] p-6 md:p-12 overflow-hidden">
            
            {/* Background 3D rotating canvas rig */}
            <div ref={canvas3dRef} id="stadium-backdrop" className="absolute inset-0 z-0 opacity-20 pointer-events-none">
              <LowPolyCanvas />
            </div>

            <div className="max-w-4xl w-full text-center space-y-8 z-10 relative">
              <div className="mono text-[0.7rem] md:text-[0.8rem] text-[#D9622B] tracking-widest uppercase">
                [ SEASON 2026 — TELEMETRY HUB ]
              </div>
              
              <h1 className="hero-title font-syncopate text-[2.5rem] sm:text-[4.5rem] md:text-[6.5rem] font-bold leading-none tracking-tighter uppercase select-none">
                FULL BACK
              </h1>
              
              <p className="max-w-xl mx-auto text-neutral-400 text-[0.85rem] md:text-[0.95rem] leading-relaxed font-jetbrains">
                An AI match analyst, exposed as an MCP server, that any fan or agent can query for World Cup insight — free for basics, pay-per-query in USDC.
              </p>

              <div className="pt-6">
                <button
                  onClick={() => handleNavigate('/dashboard')}
                  className="mono border border-[#ECEAE3] text-[#ECEAE3] px-8 py-3 bg-transparent hover:bg-[#D9622B] hover:border-[#D9622B] transition duration-300 font-semibold tracking-wider text-[0.75rem] cursor-pointer"
                >
                  ENTER THE FIELD
                </button>
              </div>
            </div>

            {/* Corner telemetries */}
            <div className="absolute bottom-6 left-8 mono text-[0.6rem] text-neutral-500 leading-relaxed text-left select-none hidden md:block">
              <div>LATITUDE: 41.8623° N</div>
              <div>FLOODLIGHT: 4000K</div>
            </div>
            <div className="absolute bottom-6 right-8 mono text-[0.6rem] text-neutral-500 leading-relaxed text-right select-none hidden md:block">
              <div>USDC_GATE: ACTIVE</div>
              <div>SETTLEMENT: BASE_SEPOLIA</div>
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
              <span className="mono text-[0.6rem] text-neutral-500">REFRESHED: LIVE TELEMETRY</span>
            </div>

            {/* Free Standings tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Group A */}
              <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6">
                <div className="flex justify-between items-center mb-4 border-b border-[#2A2A28]/50 pb-2">
                  <span className="font-syncopate text-[0.75rem] font-bold tracking-widest text-white">GROUP A</span>
                  <span className="mono text-[0.6rem] text-neutral-500">STAGE_ROUND_1</span>
                </div>
                <table className="w-full text-left mono text-[0.7rem] text-neutral-300">
                  <thead>
                    <tr className="text-neutral-500 border-b border-[#2A2A28]">
                      <th className="py-2">POS</th>
                      <th className="py-2">TEAM</th>
                      <th className="py-2 text-center">P</th>
                      <th className="py-2 text-center">W-D-L</th>
                      <th className="py-2 text-center">GD</th>
                      <th className="py-2 text-right">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2A28]/50">
                    <tr className="hover:bg-neutral-900/30">
                      <td className="py-2.5 text-[#D9622B]">1</td>
                      <td className="py-2.5 font-semibold text-white">🇩🇪 GERMANY</td>
                      <td className="py-2.5 text-center">1</td>
                      <td className="py-2.5 text-center">1-0-0</td>
                      <td className="py-2.5 text-center">+2</td>
                      <td className="py-2.5 text-right font-bold">3</td>
                    </tr>
                    <tr className="hover:bg-neutral-900/30">
                      <td className="py-2.5 text-neutral-400">2</td>
                      <td className="py-2.5 font-semibold text-white">🇺🇸 UNITED STATES</td>
                      <td className="py-2.5 text-center">1</td>
                      <td className="py-2.5 text-center">1-0-0</td>
                      <td className="py-2.5 text-center">+1</td>
                      <td className="py-2.5 text-right font-bold">3</td>
                    </tr>
                    <tr className="hover:bg-neutral-900/30">
                      <td className="py-2.5 text-neutral-400">3</td>
                      <td className="py-2.5 font-semibold text-white">🇨🇴 COLOMBIA</td>
                      <td className="py-2.5 text-center">1</td>
                      <td className="py-2.5 text-center">0-0-1</td>
                      <td className="py-2.5 text-center">-1</td>
                      <td className="py-2.5 text-right font-bold">0</td>
                    </tr>
                    <tr className="hover:bg-neutral-900/30">
                      <td className="py-2.5 text-neutral-400">4</td>
                      <td className="py-2.5 font-semibold text-white">🇯🇵 JAPAN</td>
                      <td className="py-2.5 text-center">1</td>
                      <td className="py-2.5 text-center">0-0-1</td>
                      <td className="py-2.5 text-center">-2</td>
                      <td className="py-2.5 text-right font-bold">0</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Group B */}
              <div className="border border-[#2A2A28] bg-[#171715]/40 rounded p-6">
                <div className="flex justify-between items-center mb-4 border-b border-[#2A2A28]/50 pb-2">
                  <span className="font-syncopate text-[0.75rem] font-bold tracking-widest text-white">GROUP B</span>
                  <span className="mono text-[0.6rem] text-neutral-500">STAGE_ROUND_1</span>
                </div>
                <table className="w-full text-left mono text-[0.7rem] text-neutral-300">
                  <thead>
                    <tr className="text-neutral-500 border-b border-[#2A2A28]">
                      <th className="py-2">POS</th>
                      <th className="py-2">TEAM</th>
                      <th className="py-2 text-center">P</th>
                      <th className="py-2 text-center">W-D-L</th>
                      <th className="py-2 text-center">GD</th>
                      <th className="py-2 text-right">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2A28]/50">
                    <tr className="hover:bg-neutral-900/30">
                      <td className="py-2.5 text-[#D9622B]">1</td>
                      <td className="py-2.5 font-semibold text-white">🇫🇷 FRANCE</td>
                      <td className="py-2.5 text-center">1</td>
                      <td className="py-2.5 text-center">1-0-0</td>
                      <td className="py-2.5 text-center">+1</td>
                      <td className="py-2.5 text-right font-bold">3</td>
                    </tr>
                    <tr className="hover:bg-neutral-900/30">
                      <td className="py-2.5 text-neutral-400">2</td>
                      <td className="py-2.5 font-semibold text-white">🇦🇷 ARGENTINA</td>
                      <td className="py-2.5 text-center">1</td>
                      <td className="py-2.5 text-center">0-1-0</td>
                      <td className="py-2.5 text-center">0</td>
                      <td className="py-2.5 text-right font-bold">1</td>
                    </tr>
                    <tr className="hover:bg-neutral-900/30">
                      <td className="py-2.5 text-neutral-400">3</td>
                      <td className="py-2.5 font-semibold text-white">🏴󠁧󠁢󠁥󠁮󠁧󠁿 ENGLAND</td>
                      <td className="py-2.5 text-center">1</td>
                      <td className="py-2.5 text-center">0-1-0</td>
                      <td className="py-2.5 text-center">0</td>
                      <td className="py-2.5 text-right font-bold">1</td>
                    </tr>
                    <tr className="hover:bg-neutral-900/30">
                      <td className="py-2.5 text-neutral-400">4</td>
                      <td className="py-2.5 font-semibold text-white">🇲🇦 MOROCCO</td>
                      <td className="py-2.5 text-center">1</td>
                      <td className="py-2.5 text-center">0-0-1</td>
                      <td className="py-2.5 text-center">-1</td>
                      <td className="py-2.5 text-right font-bold">0</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            {/* Match Board */}
            <div>
              <h3 className="mono text-[0.7rem] text-[#D9622B] tracking-widest uppercase mb-4">[ TODAY_FIXTURES ]</h3>
              <div className="space-y-4">
                
                {/* USA vs COL */}
                <div className="border border-[#2A2A28] bg-[#171715]/20 p-6 rounded flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <span className="mono text-[0.75rem] text-[#D9622B] font-bold">[ M001 ]</span>
                    <div>
                      <div className="text-[0.95rem] font-semibold text-white">🇺🇸 UNITED STATES vs 🇨🇴 COLOMBIA</div>
                      <div className="mono text-[0.6rem] text-neutral-500 mt-1">GROUP A · STADIUM: COPA FIELD</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="mono text-[0.9rem] font-bold text-[#D9622B] border border-[#D9622B]/20 bg-[#D9622B]/5 px-4 py-1.5 rounded">
                      2 - 1
                    </div>
                    <div className="mono text-right text-[0.65rem] text-[#8B8A85]">
                      <div>STATUS: FINISHED</div>
                      <div>DATE: 2026-06-12</div>
                    </div>
                  </div>
                </div>

                {/* GER vs JPN */}
                <div className="border border-[#2A2A28] bg-[#171715]/20 p-6 rounded flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <span className="mono text-[0.75rem] text-[#D9622B] font-bold">[ M002 ]</span>
                    <div>
                      <div className="text-[0.95rem] font-semibold text-white">🇩🇪 GERMANY vs 🇯🇵 JAPAN</div>
                      <div className="mono text-[0.6rem] text-neutral-500 mt-1">GROUP A · STADIUM: BERLIN ARENA</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="mono text-[0.9rem] font-bold text-[#D9622B] border border-[#D9622B]/20 bg-[#D9622B]/5 px-4 py-1.5 rounded">
                      3 - 1
                    </div>
                    <div className="mono text-right text-[0.65rem] text-[#8B8A85]">
                      <div>STATUS: FINISHED</div>
                      <div>DATE: 2026-06-13</div>
                    </div>
                  </div>
                </div>

                {/* ARG vs ENG */}
                <div className="border border-[#2A2A28] bg-[#171715]/20 p-6 rounded flex flex-col sm:flex-row items-row items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <span className="mono text-[0.75rem] text-[#D9622B] font-bold">[ M003 ]</span>
                    <div>
                      <div className="text-[0.95rem] font-semibold text-white">🇦🇷 ARGENTINA vs 🏴󠁧󠁢󠁥󠁮󠁧󠁿 ENGLAND</div>
                      <div className="mono text-[0.6rem] text-neutral-500 mt-1">GROUP B · STADIUM: LUSAIL CUP</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="mono text-[0.9rem] font-bold text-[#D9622B] border border-[#D9622B]/20 bg-[#D9622B]/5 px-4 py-1.5 rounded">
                      2 - 2
                    </div>
                    <div className="mono text-right text-[0.65rem] text-[#8B8A85]">
                      <div>STATUS: FINISHED</div>
                      <div>DATE: 2026-06-14</div>
                    </div>
                  </div>
                </div>

              </div>
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
                  
                  {!predictionData ? (
                    <div className="flex flex-col items-center justify-center h-48">
                      <div className="w-8 h-8 border-2 border-t-[#D9622B] border-neutral-800 rounded-full animate-spin mb-4" />
                      <span className="mono text-[0.6rem] text-neutral-500">REQUESTING ENGINES...</span>
                    </div>
                  ) : (
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
                  )}
                </div>

                <div className="border-t border-[#2A2A28] pt-4 mt-6">
                  {receipts[`/predict/match/${selectedMatchId}`] ? (
                    <div className="mono text-[0.55rem] text-[#D9622B] uppercase">
                      SETTLED · 0.05 USDC · Base Sepolia · Tx_{receipts[`/predict/match/${selectedMatchId}`].tx.slice(0, 10)}...
                    </div>
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
                  
                  {!breakdownData ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-8 h-8 border-2 border-t-[#D9622B] border-neutral-800 rounded-full animate-spin mb-4" />
                      <span className="mono text-[0.6rem] text-neutral-500">COMPILING TELEMETRY STATS...</span>
                    </div>
                  ) : (
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
                  )}
                </div>

                <div className="border-t border-[#2A2A28] pt-4 mt-6 flex justify-between items-center">
                  <span className="mono text-[0.6rem] text-neutral-500">USDC_FACILITATOR: CIRCLE_CCTP</span>
                  {receipts[`/tactical/match/${selectedMatchId}`] && (
                    <span className="mono text-[0.55rem] px-2 py-0.5 border border-[#D9622B]/30 bg-[#D9622B]/5 text-[#D9622B] rounded">
                      SETTLED · 0.10 USDC · BASE
                    </span>
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
                
                {!playerClusterData ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="w-8 h-8 border-2 border-t-[#D9622B] border-neutral-800 rounded-full animate-spin mb-4" />
                    <span className="mono text-[0.65rem] text-neutral-500">RETRIEVING MULTIVARIATE DATA...</span>
                  </div>
                ) : (
                  <div className="space-y-6 flex-grow flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start border-b border-[#2A2A28] pb-3">
                        <div>
                          <h2 className="text-[1.1rem] font-bold text-white uppercase">{playerClusterData.player.name}</h2>
                          <div className="mono text-[0.6rem] text-neutral-500 mt-1">
                            NAT: {playerClusterData.player.nationality.toUpperCase()} · POSITION: {playerClusterData.player.position.toUpperCase()}
                          </div>
                        </div>
                        
                        {receipts[`/cluster/player/${selectedPlayer}`] && (
                          <span className="mono text-[0.55rem] px-2 py-0.5 border border-[#D9622B]/30 bg-[#D9622B]/5 text-[#D9622B] rounded">
                            SETTLED · 0.01 USDC
                          </span>
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
                              <div key={p.player_id} className="flex justify-between items-center text-[0.7rem] bg-[#0E0E0E] border border-[#2A2A28] px-3 py-2 rounded">
                                <span className="font-semibold text-white">{p.name}</span>
                                <span className="mono text-[0.6rem] text-[#D9622B]">DIST: {p.similarity_distance.toFixed(3)}</span>
                              </div>
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
                )}
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
              
              {highlightsData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-t-[#D9622B] border-neutral-800 rounded-full animate-spin mb-4" />
                  <span className="mono text-[0.65rem] text-neutral-500">EXTRACTING DECIBEL SPIKES...</span>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Waveform graph overlay */}
                  <div className="border border-[#2A2A28] bg-black/40 p-4 rounded">
                    <div className="mono text-[0.55rem] text-neutral-500 mb-2 uppercase">AUDIO_RMS_ENERGY (SPIKES LOCATED)</div>
                    <svg className="w-full h-16" viewBox="0 0 1000 64" preserveAspectRatio="none">
                      <path
                        d={`M 0 32 ${Array.from({length: 100}, (_, i) => {
                          const isPeak = i === 18 || i === 58 || i === 82;
                          const height = isPeak ? 15 + Math.random() * 35 : 10 + Math.random() * 10;
                          return `L ${i * 10} ${32 - height} L ${i * 10 + 5} ${32 + height}`;
                        }).join(' ')} L 1000 32`}
                        fill="none"
                        stroke="rgba(217, 98, 43, 0.2)"
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

                  {/* Highlights Grid */}
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
              )}
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

      {/* Gated 402 Paywall Modal Dialog */}
      {paywallRequired && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none font-jetbrains animate-fade-in">
          <div className="max-w-md w-full border border-[#D9622B]/30 bg-[#171715] rounded p-6 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-[#D9622B]" />
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 border border-neutral-800 bg-[#D9622B]/5 flex items-center justify-center text-[#D9622B] text-[1.2rem] font-bold">
                ▲
              </div>
              <div className="space-y-1">
                <h3 className="mono text-[0.85rem] font-bold text-white tracking-wider">HTTP 402 PAYMENT REQUIRED</h3>
                <div className="mono text-[0.6rem] text-neutral-500">SCHEME: EIP-3009 (EXACT) · NETWORK: BASE SEPOLIA</div>
              </div>
            </div>

            <div className="border border-[#2A2A28] bg-black/40 p-4 rounded space-y-3 text-[0.7rem] mono">
              <div className="flex justify-between border-b border-neutral-900 pb-1.5">
                <span className="text-neutral-500">RESOURCE_GATED:</span>
                <span className="text-white truncate max-w-[200px]">{paywallRequired.resource}</span>
              </div>
              <div className="flex justify-between border-b border-neutral-900 pb-1.5">
                <span className="text-neutral-500">PAY_TO_ADDRESS:</span>
                <span className="text-white font-semibold">0x9ed482f...a924</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">REQUIRED_USDC:</span>
                <span className="text-[#D9622B] font-bold">{parseFloat(paywallRequired.amount) / 1000000} USDC</span>
              </div>
            </div>

            <p className="mono text-[0.65rem] text-neutral-400 leading-relaxed">
              This resource requires stablecoin permit micropayment on Base Sepolia. The AI Analyst will verify the settlement signature instantly.
            </p>

            {paymentStatus === '' ? (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    const rejectFn = paywallRequired.reject;
                    setPaywallRequired(null);
                    rejectFn(new Error('User aborted payment'));
                  }}
                  className="mono border border-neutral-800 text-neutral-400 py-2.5 hover:bg-neutral-900 transition tracking-wider text-[0.7rem] rounded"
                >
                  ABORT_QUERY
                </button>
                <button
                  onClick={handlePaywallSettle}
                  className="mono bg-[#D9622B] text-white py-2.5 hover:bg-[#D9622B]/90 transition tracking-wider text-[0.7rem] font-bold rounded cursor-pointer"
                >
                  AUTHORIZE_&_PAY
                </button>
              </div>
            ) : (
              <div className="border border-neutral-800 bg-[#0E0E0E] p-4 rounded text-center space-y-2">
                {paymentStatus === 'signing' ? (
                  <>
                    <div className="w-5 h-5 border-2 border-t-[#D9622B] border-neutral-800 rounded-full animate-spin mx-auto mb-2" />
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
