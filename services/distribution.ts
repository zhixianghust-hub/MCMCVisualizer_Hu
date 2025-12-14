import { GMMComponent, Point } from '../types';

// Default GMM
export const DEFAULT_GMM: GMMComponent[] = [
  {
    id: 1,
    mu: [-2, -2],
    sigma: [[1.0, 0.5], [0.5, 1.0]],
    weight: 0.4
  },
  {
    id: 2,
    mu: [2, 2],
    sigma: [[1.2, -0.6], [-0.6, 1.2]],
    weight: 0.6
  }
];

// Helper to get inverse sigma and determinant
const getGaussianProps = (g: GMMComponent) => {
  const det = g.sigma[0][0] * g.sigma[1][1] - g.sigma[0][1] * g.sigma[1][0];
  const invSig = [
    [g.sigma[1][1] / det, -g.sigma[0][1] / det],
    [-g.sigma[1][0] / det, g.sigma[0][0] / det]
  ];
  return { det, invSig };
};

// Evaluate Log Probability
export const getLogProb = (p: Point, components: GMMComponent[]): number => {
  const x = [p.x, p.y];
  let sumProb = 0;

  components.forEach((g) => {
    const { det, invSig } = getGaussianProps(g);
    const dx = [x[0] - g.mu[0], x[1] - g.mu[1]];
    
    // Mahalanobis distance squared
    const mahalanobis = 
      dx[0] * (invSig[0][0] * dx[0] + invSig[0][1] * dx[1]) +
      dx[1] * (invSig[1][0] * dx[0] + invSig[1][1] * dx[1]);

    const norm = 1 / (2 * Math.PI * Math.sqrt(Math.abs(det)));
    
    sumProb += g.weight * norm * Math.exp(-0.5 * mahalanobis);
  });

  return Math.log(sumProb + 1e-20);
};

// Gradient of Log Probability
export const getGradLogProb = (p: Point, components: GMMComponent[]): Point => {
  const x = [p.x, p.y];
  let sumProb = 0;
  let gradSum = [0, 0];

  components.forEach((g) => {
    const { det, invSig } = getGaussianProps(g);
    const dx = [x[0] - g.mu[0], x[1] - g.mu[1]];
    
    const mahalanobis = 
      dx[0] * (invSig[0][0] * dx[0] + invSig[0][1] * dx[1]) +
      dx[1] * (invSig[1][0] * dx[0] + invSig[1][1] * dx[1]);

    const norm = 1 / (2 * Math.PI * Math.sqrt(Math.abs(det)));
    const density = g.weight * norm * Math.exp(-0.5 * mahalanobis);

    sumProb += density;

    // Gradient of exponent part: -InvSigma * (x - mu)
    const gradExp = [
      -(invSig[0][0] * dx[0] + invSig[0][1] * dx[1]),
      -(invSig[1][0] * dx[0] + invSig[1][1] * dx[1])
    ];

    gradSum[0] += density * gradExp[0];
    gradSum[1] += density * gradExp[1];
  });

  const safeProb = sumProb + 1e-20;
  return {
    x: gradSum[0] / safeProb,
    y: gradSum[1] / safeProb
  };
};