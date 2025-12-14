export interface Point {
  x: number;
  y: number;
}

export interface ChainState {
  samples: Point[];
  currentPosition: Point;
  accepted: number;
  total: number;
}

export enum AlgorithmType {
  MH = 'Metropolis-Hastings',
  GIBBS = 'Gibbs Sampling',
  HMC = 'Hamiltonian MC',
  NUTS = 'NUTS (Visual Approx)',
}

export interface SimulationParams {
  stepSize: number; // For MH, this is sigma of q(x)
  numSteps?: number; // For HMC
  friction?: number;
}

export interface GMMComponent {
  mu: [number, number];
  sigma: [[number, number], [number, number]];
  weight: number;
  id: number;
}

export interface StepDetails {
  logProbCurrent?: number;
  logProbProposal?: number;
  acceptanceProb?: number;
  currentH?: number;
  proposedH?: number;
  gradient?: Point;
  description?: string;
  phase?: string; // 'proposal', 'accept', 'reject', 'transit', 'compute'
}

export interface StepResult {
  current: Point;
  proposal?: Point; // The candidate point being considered
  accepted?: boolean;
  path?: Point[]; // Trajectory for HMC/NUTS
  details: StepDetails;
  isFinishedStep: boolean; // True if this yields a final sample for the chain
  delay?: number; // Recommended delay in ms for this step
}