export interface TechnicianLoad {
  uid: string;
  name: string;
  specialties: string[];
  activeTicketCount: number;
  complexityLoadScore: number; // calculated sum of weights
  isOnline: boolean;
}

export interface AssignmentRecommendation {
  technicianId: string;
  technicianName: string;
  confidenceScore: number; // 0 - 100
  reasonForSuggestion: string;
}

export class TechnicianLoadEngine {
  // Compute workload score based on complexity weights
  static getComplexityWeight(complexity: string): number {
    switch (complexity?.toLowerCase()) {
      case "board-level":
      case "board level": return 5;
      case "high": return 3;
      case "medium": return 2;
      case "low": return 1;
      default: return 2;
    }
  }

  // Calculate composite load score (higher score = more saturated)
  static calculateLoadScore(activeTicketCount: number, complexityTotal: number): number {
    return (activeTicketCount * 0.4) + (complexityTotal * 0.6);
  }
}

export class AssignmentEngine {
  static getBestTechnician(
    technicians: TechnicianLoad[],
    deviceType: string,
    repairCategory: string,
    complexity: string,
    urgencyPriority: string
  ): AssignmentRecommendation {
    if (technicians.length === 0) {
      return {
        technicianId: "",
        technicianName: "Auto-routing queue",
        confidenceScore: 50,
        reasonForSuggestion: "No active technicians online. Routing to global dispatcher.",
      };
    }

    // Rank technicians
    const scoredTechs = technicians.map(tech => {
      let score = 100; // start max

      // 1. Check specialties alignment
      const searchTerms = [deviceType, repairCategory].map(t => t?.toLowerCase() || "");
      const hasSpecialty = tech.specialties?.some(spec => 
        searchTerms.some(term => term.includes(spec.toLowerCase()) || spec.toLowerCase().includes(term))
      );

      if (hasSpecialty) {
        score += 15; // bonus confidence for matching specialty
      } else {
        score -= 10;
      }

      // 2. Penalize for loaded technician (busy queue)
      const workloadImpact = tech.complexityLoadScore * 8; // penalty weight
      score -= workloadImpact;

      // 3. Online status
      if (!tech.isOnline) {
        score -= 40; // heavily de-prioritize offline guys (unless extreme niche match)
      }

      // 4. Bound score between 0 and 100
      const confidenceScore = Math.max(10, Math.min(99, Math.round(score)));

      return {
        tech,
        confidenceScore,
        hasSpecialty,
      };
    }).sort((a, b) => b.confidenceScore - a.confidenceScore);

    const best = scoredTechs[0];
    
    // Draft concise, Slack-style justification summary
    let reason = `Recommended due to lowest active ticket saturation (${best.tech.activeTicketCount} jobs) `;
    if (best.hasSpecialty) {
      reason += `and key specialization in ${best.tech.specialties.slice(0, 2).join(", ")}.`;
    } else {
      reason += `to optimize system-wide queue congestion.`;
    }

    return {
      technicianId: best.tech.uid,
      technicianName: best.tech.name,
      confidenceScore: best.confidenceScore,
      reasonForSuggestion: reason,
    };
  }
}
