import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlgorithmType, Point, SimulationParams, StepDetails, StepResult, GMMComponent } from './types';
import { mhGenerator, gibbsGenerator, hmcGenerator, nutsGenerator } from './services/samplers';
import { DEFAULT_GMM } from './services/distribution';
import MCMCVis from './components/MCMCVis';
import ControlPanel from './components/ControlPanel';
import InfoPanel from './components/InfoPanel';
import { Activity } from 'lucide-react';

const INITIAL_POINT: Point = { x: 0, y: 0 };
const INITIAL_PARAMS: SimulationParams = {
  stepSize: 0.5,
  numSteps: 10, 
};

export default function App() {
  // State
  const [algorithm, setAlgorithm] = useState<AlgorithmType>(AlgorithmType.MH);
  const [history, setHistory] = useState<Point[]>([INITIAL_POINT]);
  const [current, setCurrent] = useState<Point>(INITIAL_POINT);
  const [proposal, setProposal] = useState<Point | undefined>(undefined);
  
  const [stats, setStats] = useState({ accepted: 0, total: 0 });
  const [isRunning, setIsRunning] = useState(false);
  const [params, setParams] = useState<SimulationParams>(INITIAL_PARAMS);
  const [lastPath, setLastPath] = useState<Point[] | undefined>(undefined);
  
  // Detailed Mode & GMM State
  const [detailedMode, setDetailedMode] = useState(false);
  const [stepLogs, setStepLogs] = useState<StepDetails[]>([]); // Accumulate steps for current sample
  const [gmmParams, setGmmParams] = useState<GMMComponent[]>(DEFAULT_GMM);

  // Generator Reference
  const generatorRef = useRef<Generator<StepResult, StepResult, void> | null>(null);

  // Reset Logic
  const handleReset = useCallback(() => {
    setIsRunning(false);
    setHistory([INITIAL_POINT]);
    setCurrent(INITIAL_POINT);
    setProposal(undefined);
    setStats({ accepted: 0, total: 0 });
    setLastPath(undefined);
    setStepLogs([]);
    generatorRef.current = null;
  }, []);

  // Animation Loop with Generators
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (!isRunning) return;

      // Initialize generator if needed
      if (!generatorRef.current) {
        // Prepare for new sample
        if (detailedMode) {
             setStepLogs([]); // Clear logs only when starting a new chain step in detailed mode
        }

        switch (algorithm) {
          case AlgorithmType.MH:
            generatorRef.current = mhGenerator(current, params, gmmParams);
            break;
          case AlgorithmType.GIBBS:
            generatorRef.current = gibbsGenerator(current, params, gmmParams);
            break;
          case AlgorithmType.HMC:
            generatorRef.current = hmcGenerator(current, params, gmmParams);
            break;
          case AlgorithmType.NUTS:
            generatorRef.current = nutsGenerator(current, params, gmmParams);
            break;
        }
      }

      const { value, done } = generatorRef.current!.next();

      if (value) {
        // Update Visualization State from Yield
        if (value.current) setCurrent(value.current);
        if (value.proposal) setProposal(value.proposal);
        else setProposal(undefined); // Clear proposal if not in yield
        
        if (value.path) setLastPath(value.path);
        
        // Accumulate Step Logs
        if (value.details && value.details.description) {
            setStepLogs(prev => [...prev, value.details]);
        }

        // Handle end of a sample step
        if (value.isFinishedStep) {
          setHistory(prev => {
             const newHistory = [...prev, value.current];
             if (newHistory.length > 2000) return newHistory.slice(-2000);
             return newHistory;
          });
          
          setStats(prev => ({
            accepted: prev.accepted + (value.accepted ? 1 : 0),
            total: prev.total + 1
          }));

          // Reset generator for next sample
          generatorRef.current = null;
        }
      }

      // Determine Delay
      let nextDelay = 30; // Default fast speed
      if (detailedMode && value?.delay) {
        nextDelay = value.delay;
      }

      timeoutId = setTimeout(tick, nextDelay);
    };

    if (isRunning) {
      tick();
    }

    return () => clearTimeout(timeoutId);
  }, [isRunning, algorithm, current, params, gmmParams, detailedMode]);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 flex flex-col">
      
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-6 md:px-8 border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">MCMC Visualizer</h1>
            <p className="text-xs text-slate-500">Interactive sampling algorithms demo</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 h-full max-h-screen overflow-hidden">
        
        {/* Left Column: Visualization & Info */}
        <div className="lg:col-span-2 flex flex-col gap-6 h-full">
          {/* Viz Container */}
          <div className="flex-1 bg-white rounded-2xl shadow-lg border border-slate-200 p-2 relative min-h-[500px] flex flex-col">
             <div className="absolute top-4 left-4 z-10 bg-black/60 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm pointer-events-none">
                Target: Mixture of Gaussians
             </div>
             <MCMCVis 
               history={history} 
               current={current}
               proposal={proposal}
               lastPath={lastPath}
               detailedMode={detailedMode}
               lastDetails={stepLogs.length > 0 ? stepLogs[stepLogs.length-1] : null}
               gmmParams={gmmParams}
               algorithm={algorithm}
             />
          </div>
          
          {/* Info Box */}
          <InfoPanel algorithm={algorithm} />
        </div>

        {/* Right Column: Controls */}
        <div className="lg:col-span-1 h-full">
          <ControlPanel 
            algorithm={algorithm}
            setAlgorithm={setAlgorithm}
            isRunning={isRunning}
            setIsRunning={setIsRunning}
            reset={handleReset}
            params={params}
            setParams={setParams}
            stats={stats}
            detailedMode={detailedMode}
            setDetailedMode={setDetailedMode}
            stepLogs={stepLogs}
            gmmParams={gmmParams}
            setGmmParams={setGmmParams}
          />
        </div>

      </main>
    </div>
  );
}