import React from 'react';
import { AlgorithmType } from '../types';

interface Props {
  algorithm: AlgorithmType;
}

const InfoPanel: React.FC<Props> = ({ algorithm }) => {
  const getContent = () => {
    switch (algorithm) {
      case AlgorithmType.MH:
        return {
          title: "Metropolis-Hastings (Random Walk)",
          desc: "The simplest MCMC method. It proposes a new point nearby in a random direction. If the new point has higher probability, it moves there. If lower, it might still move (randomly), or stay put.",
          pros: "Simple to implement. Works on almost any distribution.",
          cons: "Inefficient in high dimensions. Takes a 'drunk' random walk, exploring slowly (diffusive behavior)."
        };
      case AlgorithmType.GIBBS:
        return {
          title: "Gibbs Sampling",
          desc: "Updates one dimension at a time while holding others fixed. In this demo, it's visualized as orthogonal moves (horizontal then vertical).",
          pros: "No tuning required (step size is determined by conditional distribution). Efficient when variables are correlated.",
          cons: "Can get stuck if variables are highly correlated (narrow valley problem). Slow to explore diagonal distributions."
        };
      case AlgorithmType.HMC:
        return {
          title: "Hamiltonian Monte Carlo",
          desc: "Uses gradients (physics) to guide the sample. It flicks the particle with random momentum and simulates physics on a frictionless surface. The particle slides along probability contours.",
          pros: "Explores distant regions very efficiently. Suppresses random walk behavior. High acceptance rates.",
          cons: "Expensive (requires gradients). Need to tune Step Size and Number of Steps carefully."
        };
      case AlgorithmType.NUTS:
        return {
          title: "No-U-Turn Sampler (NUTS)",
          desc: "An advanced version of HMC. It automatically determines how many steps to take by stopping when the trajectory starts to 'turn back' on itself (U-turn).",
          pros: "State-of-the-art. Removes the need to tune the number of steps. Explores extremely efficiently.",
          cons: "Complex to implement. Computationally heavier per sample."
        };
      default:
        return { title: "", desc: "", pros: "", cons: "" };
    }
  };

  const content = getContent();

  return (
    <div className="bg-slate-50 border-l-4 border-indigo-500 p-4 rounded-r-lg">
      <h3 className="text-lg font-bold text-indigo-900 mb-2">{content.title}</h3>
      <p className="text-slate-700 mb-3 leading-relaxed">{content.desc}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-bold text-emerald-600">Pros:</span> <span className="text-slate-600">{content.pros}</span>
        </div>
        <div>
          <span className="font-bold text-rose-600">Cons:</span> <span className="text-slate-600">{content.cons}</span>
        </div>
      </div>
    </div>
  );
};

export default InfoPanel;