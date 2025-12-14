import { Point, SimulationParams, StepResult, GMMComponent } from '../types';
import { getLogProb, getGradLogProb } from './distribution';

// Helper: Standard Normal Sample
const randn = () => {
  let u = 0, v = 0;
  while(u === 0) u = Math.random(); 
  while(v === 0) v = Math.random();
  return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
};

// --- Generators ---

export function* mhGenerator(current: Point, params: SimulationParams, gmm: GMMComponent[]): Generator<StepResult, StepResult, void> {
  // Total Target: ~5000ms
  
  // Step 1: Propose (1500ms)
  const proposal = {
    x: current.x + randn() * params.stepSize,
    y: current.y + randn() * params.stepSize
  };

  const logProbCurrent = getLogProb(current, gmm);
  
  yield {
    current,
    proposal,
    isFinishedStep: false,
    delay: 1500,
    details: {
      description: `Step 1: Propose candidate x' ~ N(x, σ²). σ=${params.stepSize}`,
      logProbCurrent,
      phase: 'proposal'
    }
  };

  // Step 2: Compute Probabilities (1500ms)
  const logProbProposal = getLogProb(proposal, gmm);
  const acceptProb = Math.min(1, Math.exp(logProbProposal - logProbCurrent));

  yield {
    current,
    proposal,
    isFinishedStep: false,
    delay: 1500,
    details: {
      description: `Step 2: Calculate ratio. α = min(1, P(x')/P(x)) = ${acceptProb.toFixed(4)}`,
      logProbCurrent,
      logProbProposal,
      acceptanceProb: acceptProb,
      phase: 'compute'
    }
  };

  // Step 3: Accept/Reject (2000ms)
  const dice = Math.random();
  const accepted = dice < acceptProb;

  yield {
    current: accepted ? proposal : current,
    proposal,
    accepted,
    isFinishedStep: true,
    delay: 2000,
    details: {
      description: accepted 
        ? `Step 3: Accept! Random number u=${dice.toFixed(3)} < α. Move to new position.` 
        : `Step 3: Reject. Random number u=${dice.toFixed(3)} > α. Stay at current position.`,
      logProbCurrent,
      logProbProposal,
      acceptanceProb: acceptProb,
      phase: accepted ? 'accept' : 'reject'
    }
  };
  return { current: accepted ? proposal : current, details: {}, isFinishedStep: true };
}

export function* gibbsGenerator(current: Point, params: SimulationParams, gmm: GMMComponent[]): Generator<StepResult, StepResult, void> {
  // Total Target: ~5000ms

  // --- Start Step (1000ms) ---
  yield {
    current,
    isFinishedStep: false,
    delay: 1000,
    details: { description: "Step 1: Start Gibbs cycle. Hold Y fixed, sample X.", phase: 'compute' }
  };

  const propX = current.x + randn() * params.stepSize;
  const logProbCurrX = getLogProb(current, gmm);
  const logProbPropX = getLogProb({ x: propX, y: current.y }, gmm);
  const acceptProbX = Math.min(1, Math.exp(logProbPropX - logProbCurrX));
  
  let nextX = current.x;
  
  if (Math.random() < acceptProbX) {
    nextX = propX;
  }
  
  const intermediate = { x: nextX, y: current.y };
  
  // --- Update X (2000ms) ---
  yield {
    current: intermediate, 
    proposal: { x: propX, y: current.y },
    isFinishedStep: false,
    delay: 2000, 
    details: {
      description: `Step 2: Sampled X (Metropolis-within-Gibbs). New x=${nextX.toFixed(2)}. Now hold X, sample Y.`,
      logProbCurrent: logProbCurrX,
      acceptanceProb: acceptProbX,
      phase: 'move_x'
    }
  };

  // --- Update Y (2000ms) ---
  const propY = current.y + randn() * params.stepSize;
  const logProbCurrY = getLogProb(intermediate, gmm);
  const logProbPropY = getLogProb({ x: nextX, y: propY }, gmm);
  const acceptProbY = Math.min(1, Math.exp(logProbPropY - logProbCurrY));

  let nextY = current.y;
  let acceptedY = false;
  
  if (Math.random() < acceptProbY) {
    nextY = propY;
    acceptedY = true;
  }

  const final = { x: nextX, y: nextY };
  // Check if we effectively moved relative to START of the step
  const moved = final.x !== current.x || final.y !== current.y;

  yield {
    current: final,
    proposal: { x: nextX, y: propY },
    accepted: moved,
    isFinishedStep: true,
    delay: 2000,
    details: {
      description: `Step 3: Sampled Y. Cycle complete. Final: (${nextX.toFixed(2)}, ${nextY.toFixed(2)})`,
      logProbCurrent: logProbCurrY,
      acceptanceProb: acceptProbY,
      phase: 'move_y'
    }
  };

  return { current: final, details: {}, isFinishedStep: true };
}

export function* hmcGenerator(current: Point, params: SimulationParams, gmm: GMMComponent[]): Generator<StepResult, StepResult, void> {
  const epsilon = params.stepSize * 0.5;
  const L = params.numSteps || 10;
  
  // Step 1: Momentum (1500ms)
  let q = { ...current };
  let p = { x: randn(), y: randn() }; 
  const currentP = { ...p };
  const currentK = 0.5 * (p.x * p.x + p.y * p.y);
  const currentU = -getLogProb(current, gmm);
  const currentH = currentU + currentK;

  yield {
    current,
    isFinishedStep: false,
    delay: 1500,
    details: {
      description: `Step 1: Sample Momentum p. Initial Energy H = ${currentH.toFixed(2)}`,
      currentH,
      phase: 'momentum'
    }
  };

  // Step 2: Leapfrog
  const path: Point[] = [{...q}];
  let grad = getGradLogProb(q, gmm);
  
  // Half step p
  p.x -= epsilon * grad.x / 2;
  p.y -= epsilon * grad.y / 2;

  // Slow down leapfrog to fill time (e.g., 2500ms total for L steps)
  const stepDelay = Math.max(100, Math.floor(2500 / L));

  for (let i = 0; i < L; i++) {
    // Full step q
    q.x += epsilon * p.x;
    q.y += epsilon * p.y;
    path.push({...q});

    yield {
      current,
      path: [...path], 
      isFinishedStep: false,
      delay: stepDelay, 
      details: {
        description: `Leapfrog Step ${i+1}/${L}: Integrating Hamiltonian dynamics...`,
        phase: 'leapfrog',
        gradient: grad
      }
    };

    grad = getGradLogProb(q, gmm);

    // Full step p (except last)
    if (i !== L - 1) {
      p.x -= epsilon * grad.x;
      p.y -= epsilon * grad.y;
    }
  }
  // Final half step p
  p.x -= epsilon * grad.x / 2;
  p.y -= epsilon * grad.y / 2;

  // Step 3: Accept (1500ms)
  const proposedU = -getLogProb(q, gmm);
  const proposedK = 0.5 * (p.x * p.x + p.y * p.y);
  const proposedH = proposedU + proposedK;
  
  const acceptProb = Math.min(1, Math.exp(currentH - proposedH));
  const dice = Math.random();
  const accepted = dice < acceptProb;

  yield {
    current: accepted ? q : current,
    path,
    accepted,
    isFinishedStep: true,
    delay: 1500,
    details: {
      description: accepted 
        ? `Step 3: Metropolis Accept. ΔH=${(proposedH - currentH).toFixed(4)}.` 
        : `Step 3: Reject (High Energy Error). ΔH=${(proposedH - currentH).toFixed(4)}.`,
      currentH,
      proposedH,
      acceptanceProb: acceptProb,
      phase: accepted ? 'accept' : 'reject'
    }
  };
  return { current: accepted ? q : current, details: {}, isFinishedStep: true };
}

export function* nutsGenerator(current: Point, params: SimulationParams, gmm: GMMComponent[]): Generator<StepResult, StepResult, void> {
  const epsilon = params.stepSize * 0.4; 
  const maxSteps = 50; 
  
  // 1. Momentum & Slice (1500ms)
  let q = { ...current };
  let p = { x: randn(), y: randn() };
  
  const startU = -getLogProb(current, gmm);
  const startK = 0.5 * (p.x * p.x + p.y * p.y);
  const startH = startU + startK;
  const log_u = Math.log(Math.random()) - startH;

  yield {
    current,
    isFinishedStep: false,
    delay: 1500,
    details: {
      description: "Step 1: Sample Momentum & Slice u. Start building tree...",
      currentH: startH,
      phase: 'momentum'
    }
  };

  const path: Point[] = [{...q}];
  const validCandidates: Point[] = [{...q}];
  
  let grad = getGradLogProb(q, gmm);
  p.x -= epsilon * grad.x / 2;
  p.y -= epsilon * grad.y / 2;

  let stopped = false;
  let steps = 0;
  let reason = "";

  // Tree building loop (Variable time, ~100-200ms per step)
  while (!stopped && steps < maxSteps) {
    q.x += epsilon * p.x;
    q.y += epsilon * p.y;
    grad = getGradLogProb(q, gmm);
    
    const currU = -getLogProb(q, gmm);
    const p_full_x = p.x - epsilon * grad.x / 2;
    const p_full_y = p.y - epsilon * grad.y / 2;
    const currK = 0.5 * (p_full_x * p_full_x + p_full_y * p_full_y);
    const currH = currU + currK;

    if ((currH - startH) > 1000) {
        stopped = true;
        reason = "Divergence";
    }

    const dx = q.x - current.x;
    const dy = q.y - current.y;
    const dot = dx * p.x + dy * p.y; 

    path.push({...q});
    if (-currH >= log_u) {
       validCandidates.push({...q});
    }

    yield {
      current,
      path: [...path],
      isFinishedStep: false,
      delay: 150, 
      details: {
        description: `Tree Step ${steps+1}: Check U-Turn (dot=${dot.toFixed(2)})...`,
        phase: 'tree_build'
      }
    };

    if (dot < 0) {
      stopped = true;
      reason = "U-Turn Detected";
    } else {
      p.x -= epsilon * grad.x;
      p.y -= epsilon * grad.y;
      steps++;
    }
  }

  // Final Selection (2000ms)
  let nextQ = current;
  let accepted = false;
  
  if (validCandidates.length > 0) {
      const idx = Math.floor(Math.random() * validCandidates.length);
      nextQ = validCandidates[idx];
      accepted = true; 
  }

  yield {
    current: nextQ,
    path,
    accepted,
    isFinishedStep: true,
    delay: 2000,
    details: {
      description: `Step 3: ${reason}. Sampling from trajectory... Done.`,
      currentH: startH,
      phase: 'accept'
    }
  };
  return { current: nextQ, details: {}, isFinishedStep: true };
}