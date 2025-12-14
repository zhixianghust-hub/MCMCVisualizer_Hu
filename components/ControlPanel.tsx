import React from 'react';
import { AlgorithmType, SimulationParams, StepDetails, GMMComponent } from '../types';
import { Play, Pause, RotateCcw, Settings, Microscope, Sliders } from 'lucide-react';

interface Props {
  algorithm: AlgorithmType;
  setAlgorithm: (a: AlgorithmType) => void;
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;
  reset: () => void;
  params: SimulationParams;
  setParams: (p: SimulationParams) => void;
  stats: { accepted: number; total: number };
  detailedMode: boolean;
  setDetailedMode: (v: boolean) => void;
  stepLogs: StepDetails[];
  gmmParams: GMMComponent[];
  setGmmParams: (g: GMMComponent[]) => void;
}

const ControlPanel: React.FC<Props> = ({
  algorithm,
  setAlgorithm,
  isRunning,
  setIsRunning,
  reset,
  params,
  setParams,
  stats,
  detailedMode,
  setDetailedMode,
  stepLogs,
  gmmParams,
  setGmmParams
}) => {
  const acceptanceRate = stats.total > 0 ? ((stats.accepted / stats.total) * 100).toFixed(1) : '0.0';

  const updateGMM = (index: number, field: keyof GMMComponent | 'muX' | 'muY' | 'weight', value: number) => {
    const newGmm = [...gmmParams];
    const comp = { ...newGmm[index] };
    
    if (field === 'muX') comp.mu = [value, comp.mu[1]];
    else if (field === 'muY') comp.mu = [comp.mu[0], value];
    else if (field === 'weight') comp.weight = value;
    
    newGmm[index] = comp;
    setGmmParams(newGmm);
    reset(); // Reset simulation when target changes
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg space-y-6 border border-slate-200 h-full overflow-y-auto max-h-[calc(100vh-6rem)]">
      
      {/* Algorithm Selector */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Algorithm</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(AlgorithmType).map((algo) => (
            <button
              key={algo}
              onClick={() => {
                setIsRunning(false);
                setAlgorithm(algo);
                reset();
              }}
              className={`px-3 py-2 text-xs rounded-lg transition-colors font-medium text-center ${
                algorithm === algo
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {algo}
            </button>
          ))}
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setIsRunning(!isRunning)}
          className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg font-bold text-white transition-all ${
            isRunning 
              ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' 
              : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30'
          } shadow-lg`}
        >
          {isRunning ? <><Pause size={20} /> <span>Pause</span></> : <><Play size={20} /> <span>Start</span></>}
        </button>
        
        <button
          onClick={reset}
          className="p-3 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          title="Reset Simulation"
        >
          <RotateCcw size={20} />
        </button>
      </div>

      {/* Detailed Mode Toggle */}
      <div 
        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
          detailedMode ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'
        }`}
        onClick={() => setDetailedMode(!detailedMode)}
      >
        <div className="flex items-center gap-2">
            <Microscope size={18} className={detailedMode ? 'text-indigo-600' : 'text-slate-400'} />
            <span className={`text-sm font-semibold ${detailedMode ? 'text-indigo-800' : 'text-slate-600'}`}>Detailed Operation</span>
        </div>
        <div className={`w-10 h-5 rounded-full relative transition-colors ${detailedMode ? 'bg-indigo-500' : 'bg-slate-300'}`}>
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${detailedMode ? 'left-6' : 'left-1'}`} />
        </div>
      </div>

      {/* Live Step Logs */}
      {detailedMode && (
        <div className="bg-slate-800 text-slate-200 rounded-lg shadow-inner border border-slate-700 overflow-hidden">
            <div className="bg-slate-900 p-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                Sample Execution Log
            </div>
            <div className="p-3 max-h-60 overflow-y-auto space-y-3 custom-scrollbar">
                {stepLogs.length === 0 && <div className="text-slate-500 text-xs italic">Waiting for start...</div>}
                
                {stepLogs.map((log, idx) => (
                    <div key={idx} className="text-xs border-l-2 border-indigo-500 pl-2">
                        <div className="flex justify-between items-center mb-1">
                             <span className="font-bold text-indigo-300 uppercase text-[10px]">{log.phase || `Step ${idx+1}`}</span>
                             {log.acceptanceProb !== undefined && (
                                <span className="text-[10px] text-emerald-400 font-mono">P(Acc): {(log.acceptanceProb*100).toFixed(0)}%</span>
                             )}
                        </div>
                        <div className="text-amber-100 mb-1">{log.description}</div>
                        
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-400 font-mono">
                           {log.logProbCurrent !== undefined && <span>LogP(Cur): {log.logProbCurrent.toFixed(2)}</span>}
                           {log.logProbProposal !== undefined && <span>LogP(New): {log.logProbProposal.toFixed(2)}</span>}
                           {log.currentH !== undefined && <span>H(Cur): {log.currentH.toFixed(2)}</span>}
                           {log.proposedH !== undefined && <span>H(New): {log.proposedH.toFixed(2)}</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* GMM Configuration */}
      <div className="space-y-4 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <Sliders size={16} />
          <span>Target Distribution (GMM)</span>
        </div>
        {gmmParams.map((g, idx) => (
          <div key={g.id} className="bg-slate-50 p-3 rounded border border-slate-100 text-xs space-y-2">
            <div className="font-bold text-slate-600">Component {idx + 1}</div>
            <div className="grid grid-cols-2 gap-2">
               <div>
                 <label className="block text-slate-400">Mu X: {g.mu[0]}</label>
                 <input type="range" min="-5" max="5" step="0.5" value={g.mu[0]} 
                   onChange={(e) => updateGMM(idx, 'muX', parseFloat(e.target.value))} className="w-full h-1 bg-slate-200 rounded"/>
               </div>
               <div>
                 <label className="block text-slate-400">Mu Y: {g.mu[1]}</label>
                 <input type="range" min="-5" max="5" step="0.5" value={g.mu[1]} 
                   onChange={(e) => updateGMM(idx, 'muY', parseFloat(e.target.value))} className="w-full h-1 bg-slate-200 rounded"/>
               </div>
               <div className="col-span-2">
                 <label className="block text-slate-400">Weight: {g.weight.toFixed(1)}</label>
                 <input type="range" min="0.1" max="1" step="0.1" value={g.weight} 
                   onChange={(e) => updateGMM(idx, 'weight', parseFloat(e.target.value))} className="w-full h-1 bg-slate-200 rounded"/>
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Algorithm Parameters */}
      <div className="space-y-4 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <Settings size={16} />
          <span>Sampler Config</span>
        </div>
        
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>
              {algorithm === AlgorithmType.MH ? 'Proposal Sigma (Step Size)' : 'Step Size'}
            </span>
            <span className="font-mono">{params.stepSize.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.1"
            value={params.stepSize}
            onChange={(e) => setParams({ ...params, stepSize: parseFloat(e.target.value) })}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        {(algorithm === AlgorithmType.HMC || algorithm === AlgorithmType.NUTS) && (
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Leapfrog Steps (L)</span>
              <span className="font-mono">{params.numSteps}</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={params.numSteps}
              onChange={(e) => setParams({ ...params, numSteps: parseInt(e.target.value) })}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Samples</div>
            <div className="text-xl font-mono font-semibold text-slate-800">{stats.total}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Accept Rate</div>
            <div className={`text-xl font-mono font-semibold ${parseFloat(acceptanceRate) > 20 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {acceptanceRate}%
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ControlPanel;