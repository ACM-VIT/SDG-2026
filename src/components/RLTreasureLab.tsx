import { useCallback, useEffect, useRef, useState } from "react";

type Action = 0 | 1 | 2 | 3;
type Preset = "balanced" | "speed" | "collector";
type MapId = "circuit" | "crossroads";
type RunState = { row: number; col: number; mask: number; score: number; steps: number; trail: string[]; visitedMasks: Record<string, number> };
type Feedback = { action: string; mode: string; reward: number; event: string };

const SIZE = 6;
const MAX_STEPS = 36;
const ACTIONS = ["Up", "Right", "Down", "Left"] as const;
const DELTAS = [[-1, 0], [0, 1], [1, 0], [0, -1]] as const;
const MAPS = {
  circuit: {
    name: "Map A · Circuit",
    walls: new Set(["1,1", "2,1", "3,1", "3,2", "1,4", "2,4"]),
    traps: new Set(["2,2", "4,1", "4,4"]),
    items: [{ at: "0,3", kind: "coin" }, { at: "2,3", kind: "coin" }, { at: "4,2", kind: "coin" }, { at: "5,2", kind: "gem" }] as const,
  },
  crossroads: {
    name: "Map B · Crossroads",
    walls: new Set(["1,2", "1,3", "2,3", "3,1", "3,3", "4,1"]),
    traps: new Set(["1,4", "3,4", "4,3"]),
    items: [{ at: "0,2", kind: "coin" }, { at: "2,1", kind: "coin" }, { at: "4,4", kind: "coin" }, { at: "3,2", kind: "gem" }] as const,
  },
} as const;
const REWARDS = {
  balanced: { treasure: 100, coin: 10, gem: 25, trap: -50, collision: -5, step: -1, timeout: -20 },
  speed: { treasure: 100, coin: 4, gem: 8, trap: -50, collision: -8, step: -4, timeout: -25 },
  collector: { treasure: 100, coin: 38, gem: 75, trap: -55, collision: -5, step: -1, timeout: -20 },
};
const freshRun = (): RunState => ({ row: 0, col: 0, mask: 0, score: 0, steps: 0, trail: ["0,0"], visitedMasks: { "0,0": 0 } });
const keyOf = (s: Pick<RunState, "row" | "col" | "mask">) => `${s.row},${s.col}|${s.mask}`;

function mulberry32(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function RLTreasureLab() {
  const qRef = useRef(new Map<string, number[]>());
  const rngRef = useRef(mulberry32(2026));
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [run, setRun] = useState(freshRun);
  const [preset, setPreset] = useState<Preset>("balanced");
  const [mapId, setMapId] = useState<MapId>("circuit");
  const [epsilon, setEpsilon] = useState(.9);
  const [episodes, setEpisodes] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [best, setBest] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({ action: "—", mode: "Waiting", reward: 0, event: "Ready to learn" });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Untrained agent — start with a visible episode");
  const [showQ, setShowQ] = useState(false);
  const [speed, setSpeed] = useState(420);
  const [testMode, setTestMode] = useState(false);
  const [activeTestEpsilon, setActiveTestEpsilon] = useState(0);
  const [testEpsilonSetting, setTestEpsilonSetting] = useState(.15);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [, forceQ] = useState(0);
  const rewards = REWARDS[preset];
  const map = MAPS[mapId];

  const qFor = useCallback((state: Pick<RunState, "row" | "col" | "mask">) => {
    const key = keyOf(state);
    let values = qRef.current.get(key);
    if (!values) { values = [0, 0, 0, 0]; qRef.current.set(key, values); }
    return values;
  }, []);

  const resetEpisode = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null; setRun(freshRun()); setFeedback({ action: "—", mode: "Waiting", reward: 0, event: "Episode reset" }); setTestMode(false);
  }, []);

  const resetLearning = useCallback((message = "Learning reset — Q-table is empty") => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    qRef.current = new Map(); rngRef.current = mulberry32(2026); setRun(freshRun()); setEpsilon(.9); setEpisodes(0); setSuccesses(0); setHistory([]); setBest(null); setBusy(false); setTestMode(false); setStatus(message); setFeedback({ action: "—", mode: "Waiting", reward: 0, event: "Fresh agent" }); forceQ(v => v + 1);
  }, []);

  const transition = useCallback((state: RunState, action: Action) => {
    const [dr, dc] = DELTAS[action]; const nr = state.row + dr; const nc = state.col + dc;
    let next = { ...state, steps: state.steps + 1, trail: [...state.trail], visitedMasks: { ...state.visitedMasks } }; let reward = rewards.step; let event = "Step taken"; let terminal = false; let success = false;
    if (nr < 0 || nc < 0 || nr >= SIZE || nc >= SIZE || map.walls.has(`${nr},${nc}`)) { reward += rewards.collision; event = "Wall collision"; }
    else { next.row = nr; next.col = nc; next.trail.push(`${nr},${nc}`); const pos = `${nr},${nc}`;
      const itemIndex = map.items.findIndex(i => i.at === pos);
      if (itemIndex >= 0 && !(next.mask & (1 << itemIndex))) { next.mask |= 1 << itemIndex; const item = map.items[itemIndex]; reward += item.kind === "gem" ? rewards.gem : rewards.coin; event = item.kind === "gem" ? "Bonus gem collected" : "Coin collected"; }
      next.visitedMasks[pos] = next.mask;
      if (map.traps.has(pos)) { reward += rewards.trap; event = "Terminal trap entered"; terminal = true; }
      if (pos === "5,5") { reward += rewards.treasure; event = "Treasure reached"; terminal = true; success = true; }
    }
    if (!terminal && next.steps >= MAX_STEPS) { reward += rewards.timeout; event = "Maximum steps exceeded"; terminal = true; }
    next.score += reward; return { next, reward, event, terminal, success };
  }, [map, rewards]);

  const choose = useCallback((s: RunState, eps: number): { action: Action; explore: boolean } => {
    const explore = rngRef.current() < eps; if (explore) return { action: Math.floor(rngRef.current() * 4) as Action, explore };
    const q = qFor(s); const max = Math.max(...q); const ties = q.map((v, i) => v === max ? i : -1).filter(i => i >= 0); return { action: ties[Math.floor(rngRef.current() * ties.length)] as Action, explore };
  }, [qFor]);

  const learn = useCallback((s: RunState, action: Action, reward: number, next: RunState, terminal: boolean) => {
    const q = qFor(s); const target = reward + (terminal ? 0 : .93 * Math.max(...qFor(next))); q[action] += .23 * (target - q[action]);
  }, [qFor]);

  const oneEpisode = useCallback((eps: number) => {
    let s = freshRun(); let terminal = false; let success = false;
    while (!terminal) { const pick = choose(s, eps); const out = transition(s, pick.action); learn(s, pick.action, out.reward, out.next, out.terminal); s = out.next; terminal = out.terminal; success = out.success; }
    return { score: s.score, steps: s.steps, success };
  }, [choose, learn, transition]);

  const animateEpisode = useCallback((testing: boolean, currentEpsilon = false, testEpsilon = 0) => {
    if (busy) return; setBusy(true); setSelectedCell(null); setTestMode(testing); setActiveTestEpsilon(testing ? testEpsilon : 0); const eps = testing ? testEpsilon : currentEpsilon ? epsilon : Math.max(epsilon, .8); let s = freshRun(); setRun(s); setStatus(testing ? `Test Mode — Exploration ${Math.round(testEpsilon * 100)}%` : currentEpsilon ? "Training 1 episode — showing every action and Q-update" : "Visible trial-and-error episode");
    const tick = () => { const pick = choose(s, eps); const out = transition(s, pick.action); if (!testing) learn(s, pick.action, out.reward, out.next, out.terminal); s = out.next; setRun(s); setFeedback({ action: ACTIONS[pick.action], mode: pick.explore ? "Exploration" : "Exploitation", reward: out.reward, event: out.event }); forceQ(v => v + 1);
      if (out.terminal) { setBusy(false); timerRef.current = null; if (!testing) { setEpisodes(e => e + 1); setSuccesses(v => v + (out.success ? 1 : 0)); setHistory(h => [...h, s.score]); setEpsilon(e => Math.max(.05, e * .996)); } if (out.success) setBest(previous => previous === null ? s.steps : Math.min(previous, s.steps)); setStatus(out.success ? (testing ? "Learned policy reached the treasure" : "Episode complete — treasure found") : "Episode complete — agent will learn from this"); return; }
      timerRef.current = window.setTimeout(tick, speed);
    }; timerRef.current = window.setTimeout(tick, 250);
  }, [busy, choose, epsilon, learn, speed, transition]);

  const trainBatch = useCallback((count: number, backup = false) => {
    if (busy) return; setBusy(true); setTestMode(false); setStatus(backup ? "Building deterministic backup checkpoint…" : `Training ${count.toLocaleString()} episodes locally…`);
    let done = 0; let eps = backup ? .9 : epsilon; let wins = 0; const scores: number[] = []; let batchBest = best;
    const chunk = () => {
      if (!mountedRef.current) return;
      const end = Math.min(done + 40, count);
      for (; done < end; done++) {
        const result = oneEpisode(eps);
        scores.push(result.score);
        if (result.success) { wins++; batchBest = batchBest === null ? result.steps : Math.min(batchBest, result.steps); }
        eps = Math.max(.05, eps * .996);
      }
      if (!mountedRef.current) return;
      if (done < count) {
        frameRef.current = requestAnimationFrame(chunk);
      } else {
        frameRef.current = null;
        setEpisodes(e => backup ? count : e + count);
        setSuccesses(s => backup ? wins : s + wins);
        setHistory(h => backup ? scores : [...h, ...scores]);
        setEpsilon(eps); setBest(batchBest); setBusy(false);
        setStatus(backup ? "Backup checkpoint loaded — ready to test" : `Training complete — ${wins}/${count} episodes reached treasure`);
        forceQ(v => v + 1);
      }
    };
    frameRef.current = requestAnimationFrame(chunk);
  }, [best, busy, epsilon, oneEpisode]);

  const selectPreset = (p: Preset) => { setPreset(p); queueMicrotask(() => resetLearning(`${p[0].toUpperCase() + p.slice(1)} rewards selected — learning reset`)); };
  const selectMap = (id: MapId) => { setMapId(id); setSelectedCell(null); queueMicrotask(() => resetLearning(`${MAPS[id].name} selected — learning reset`)); };
  const selectedPosition = selectedCell ? `${selectedCell.row},${selectedCell.col}` : null;
  const selectedVisitMask = selectedPosition === null ? undefined : run.visitedMasks[selectedPosition];
  const inspectedState = selectedCell ? { ...selectedCell, mask: selectedVisitMask ?? 0 } : run;
  const qValues = qFor(inspectedState); const maxQ = Math.max(...qValues);
  const avg = history.length ? history.slice(-100).reduce((a, b) => a + b, 0) / Math.min(100, history.length) : 0;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      timerRef.current = null;
      frameRef.current = null;
    };
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "#24333a";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(36, i * height / 4);
      ctx.lineTo(width, i * height / 4);
      ctx.stroke();
    }
    if (!history.length) {
      ctx.fillStyle = "#718087";
      ctx.font = "12px monospace";
      ctx.textBaseline = "middle";
      ctx.fillText("Train the agent to reveal its learning curve", 36, height / 2 - 14);
      return;
    }

    const movingAverage = history.map((_, index) => {
      const start = Math.max(0, index - 19);
      const window = history.slice(start, index + 1);
      return window.reduce((sum, value) => sum + value, 0) / window.length;
    });
    const sampleStep = Math.max(1, Math.ceil(history.length / 500));
    const sampleIndexes = history
      .map((_, index) => index)
      .filter(index => index % sampleStep === 0 || index === history.length - 1);
    const sampledRewards = sampleIndexes.map(index => history[index]);
    const sampledAverage = sampleIndexes.map(index => movingAverage[index]);
    const min = Math.min(-80, ...sampledRewards, ...sampledAverage);
    const max = Math.max(120, ...sampledRewards, ...sampledAverage);
    const y = (value: number) => height - 18 - (value - min) / (max - min) * (height - 32);
    const drawLine = (data: number[], color: string, lineWidth: number) => {
      ctx.beginPath();
      data.forEach((value, index) => {
        const x = 36 + index / Math.max(1, data.length - 1) * (width - 46);
        if (index === 0) ctx.moveTo(x, y(value));
        else ctx.lineTo(x, y(value));
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    };
    drawLine(sampledRewards, "rgba(25,245,170,.28)", 1);
    drawLine(sampledAverage, "#18f3d1", 2.5);
  }, [history]);

  return <section className="rl-lab" aria-label="RL Treasure Lab">
    <header className="rl-head"><div><p className="eyebrow">LIVE REINFORCEMENT LEARNING SYSTEM</p><h1>RL TREASURE <span>LAB</span></h1></div><div className={`mode-chip ${testMode ? "test" : ""}`}><i />{testMode ? `TEST · ε ${Math.round(activeTestEpsilon * 100)}%` : busy ? "SYSTEM RUNNING" : "LAB READY"}</div></header>
    <div className="rl-grid">
      <div className="lab-card map-card"><div className="card-title"><span>ENVIRONMENT</span><b>6 × 6 GRIDWORLD</b></div><div className="treasure-map">
        {Array.from({length:36},(_,i)=>{const row=Math.floor(i/6),col=i%6,pos=`${row},${col}`,itemIndex=map.items.findIndex(x=>x.at===pos), item=itemIndex>=0?map.items[itemIndex]:null, inspectable=!busy&&!map.walls.has(pos); return <div key={pos} role={inspectable?"button":undefined} tabIndex={inspectable?0:-1} aria-label={map.walls.has(pos)?"Wall":busy?"Q-values follow the running agent":`Inspect row ${row + 1}, column ${col + 1} Q-values`} onClick={()=>inspectable&&setSelectedCell({row,col})} onKeyDown={e=>{if(inspectable&&(e.key==="Enter"||e.key===" "))setSelectedCell({row,col})}} className={`cell ${map.walls.has(pos)?"wall":""} ${map.traps.has(pos)?"trap":""} ${run.trail.includes(pos)?"trail":""} ${selectedCell?.row===row&&selectedCell?.col===col?"selected":""} ${pos==="5,5"?"goal":""}`}>
          {pos==="0,0"&&<small>START</small>}{pos==="5,5"&&<span className="treasure">◆</span>}{map.traps.has(pos)&&<span className="trap-mark">×</span>}{item&&!(run.mask&(1<<itemIndex))&&<span className={item.kind}>{item.kind==="coin"?"●":"✦"}</span>}{run.row===row&&run.col===col&&<span className="robot">🤖</span>}
        </div>})}
      </div><div className="map-legend"><span><i className="legend-agent"/>Agent</span><span><i className="legend-coin"/>Coin</span><span><i className="legend-gem"/>Bonus</span><span><i className="legend-trap"/>Trap</span><span><i className="legend-wall"/>Wall</span></div></div>
      <aside className="lab-side">
        <div className="lab-card stats-card"><div className="card-title"><span>TRAINING STATUS</span><b>{preset.toUpperCase()} REWARDS</b></div><div className="stat-grid"><Stat label="EPISODE" value={episodes.toLocaleString()}/><Stat label="CURRENT SCORE" value={run.score.toFixed(0)}/><Stat label="STEPS" value={`${run.steps}/${MAX_STEPS}`}/><Stat label="SUCCESS RATE" value={episodes?`${Math.round(successes/episodes*100)}%`:"—"}/><Stat label="AVG REWARD · 100" value={history.length?avg.toFixed(1):"—"}/><Stat label="BEST SEEN ROUTE" value={best?`${best} steps`:"—"}/></div><div className="epsilon"><div><span>EXPLORATION ε</span><b>{Math.round((testMode?activeTestEpsilon:epsilon)*100)}%</b></div><div className="meter"><i style={{width:`${(testMode?activeTestEpsilon:epsilon)*100}%`}}/></div><small>High exploration → decays toward 5%</small></div></div>
        <div className="lab-card feedback-card"><div className="card-title"><span>IMMEDIATE FEEDBACK</span><b>LAST ACTION</b></div><div className="feedback-main"><div><small>SELECTED ACTION</small><strong>{feedback.action}</strong><em>{feedback.mode}</em></div><b className={feedback.reward<0?"negative":"positive"}>{feedback.reward>0?"+":""}{feedback.reward}</b></div><p>{feedback.event}</p></div>
      </aside>
      <div className="lab-card graph-card"><div className="card-title"><span>LEARNING CURVE</span><b>EPISODE REWARD + 20-EP MOVING AVG</b></div><canvas ref={canvasRef}/></div>
      <div className="lab-card q-card"><div className="card-title"><span>ACTION VALUES</span><button onClick={()=>setShowQ(v=>!v)}>{showQ?"HIDE":"REVEAL"} Q-VALUES</button></div><p>{busy ? `Following agent · row ${run.row + 1}, column ${run.col + 1} · ${map.items.filter((_, i) => run.mask & (1 << i)).length}/4 items collected` : selectedCell ? `Row ${selectedCell.row + 1}, column ${selectedCell.col + 1} · ${selectedVisitMask === undefined ? "not visited this episode; showing initial item state" : `state from latest visit · ${map.items.filter((_, i) => selectedVisitMask & (1 << i)).length}/4 items collected`}` : "Agent's current state · click any open map cell to inspect it"}</p><div className={`q-values ${showQ?"":"concealed"}`}>{ACTIONS.map((a,i)=><div className={qValues[i]===maxQ&&showQ?"best":""} key={a}><span>{["↑","→","↓","←"][i]} {a}</span><b>{showQ?qValues[i].toFixed(2):"••••"}</b></div>)}</div></div>
    </div>
    <div className="lab-card controls"><div className="control-status"><span>CONTROL DECK</span><p>{status}</p></div><div className="control-row primary-controls"><button disabled={busy} onClick={()=>resetLearning()}>Reset learning</button><button disabled={busy} onClick={()=>animateEpisode(false)}>Run untrained episode</button><button className="accent" disabled={busy} onClick={()=>animateEpisode(false,true)}>Train 1 episode</button><button className="accent" disabled={busy} onClick={()=>trainBatch(100)}>Train 100</button><button className="accent" disabled={busy} onClick={()=>trainBatch(1000)}>Train 1,000</button><button className="test-btn" disabled={busy} onClick={()=>animateEpisode(true,false,0)}>Test · ε 0%</button><button className="test-btn exploratory-test" disabled={busy} onClick={()=>animateEpisode(true,false,testEpsilonSetting)}>Test · Custom ε</button><button disabled={busy} onClick={resetEpisode}>Reset episode</button></div><div className="control-row secondary-controls"><div className="segmented map-selector">{(["circuit","crossroads"] as MapId[]).map(id=><button disabled={busy} className={mapId===id?"active":""} key={id} onClick={()=>selectMap(id)}>{MAPS[id].name}</button>)}</div><div className="segmented">{(["balanced","speed","collector"] as Preset[]).map(p=><button disabled={busy} className={preset===p?"active":""} key={p} onClick={()=>selectPreset(p)}>{p}</button>)}</div><button disabled={busy} onClick={()=>{resetLearning("Preparing backup checkpoint…");setTimeout(()=>trainBatch(1800,true),0)}}>Load backup checkpoint</button><label>Test exploration <b>{Math.round(testEpsilonSetting*100)}%</b><input disabled={busy} aria-label="Test exploration percentage" type="range" min="0" max="100" step="1" value={testEpsilonSetting*100} onChange={e=>setTestEpsilonSetting(Number(e.target.value)/100)}/></label><label>Animation speed <input aria-label="Animation speed" type="range" min="100" max="900" step="50" value={1000-speed} onChange={e=>setSpeed(1000-Number(e.target.value))}/></label><button onClick={()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}>Presentation mode</button></div></div>
  </section>;
}

function Stat({label,value}:{label:string;value:string}) { return <div className="stat"><small>{label}</small><strong>{value}</strong></div>; }
