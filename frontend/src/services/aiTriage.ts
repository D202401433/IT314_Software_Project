import {
  DisasterCategory,
  IncidentSeverity,
  AITriageRecommendation,
  ReportSource,
} from "../types/resq";

export function generateAITriage(
  category: DisasterCategory,
  description: string,
  affectedCount: number,
  urgentNeeds: string[],
  source: ReportSource
): AITriageRecommendation {
  const descLower = description.toLowerCase();

  // 1. Evaluate Severity based on NDMA criteria
  let proposedSeverity: IncidentSeverity = "MODERATE";
  let priority = 3;
  const risks: string[] = [];

  const hasTrapped = descLower.includes("stuck") || descLower.includes("trapped") || descLower.includes("stranded") || descLower.includes("rooftop") || descLower.includes("roof");
  const hasMedical = urgentNeeds.some((n) => n.toLowerCase().includes("medical") || n.toLowerCase().includes("patient") || n.toLowerCase().includes("burn"));

  if (category === "Flood / Urban Flood") {
    if (affectedCount >= 30 || hasTrapped || descLower.includes("flash") || descLower.includes("overflow")) {
      proposedSeverity = "CRITICAL";
      priority = 1;
      risks.push("Rapid flood current drowning hazard", "Submerged electrical infrastructure");
    } else if (affectedCount >= 10 || hasMedical) {
      proposedSeverity = "HIGH";
      priority = 2;
      risks.push("Structural weakening of ground walls", "Hypothermia risk");
    } else {
      proposedSeverity = "MODERATE";
      priority = 3;
      risks.push("Roadway inundation causing vehicle stall");
    }
  } else if (category === "Major Urban / Building Fire") {
    if (hasTrapped || descLower.includes("commercial") || descLower.includes("godown") || descLower.includes("multistory") || affectedCount >= 15) {
      proposedSeverity = "CRITICAL";
      priority = 1;
      risks.push("Smoke inhalation asphyxiation in enclosed space", "Flashover / rapid structural ceiling collapse", "Narrow alley tender access bottleneck");
    } else {
      proposedSeverity = "HIGH";
      priority = 2;
      risks.push("Flank fire spreading to adjacent shops");
    }
  } else if (category === "Cyclone / Coastal Flooding") {
    if (descLower.includes("surge") || descLower.includes("wave") || affectedCount >= 100) {
      proposedSeverity = "CRITICAL";
      priority = 1;
      risks.push("1.5m+ seawater surge breaching earthen embankments", "Total coastal grid power failure");
    } else {
      proposedSeverity = "HIGH";
      priority = 2;
      risks.push("High wind projectile debris", "Saline water contamination of local wells");
    }
  }

  // 2. Capabilities Matching
  const capabilities: string[] = [];
  if (category === "Flood / Urban Flood") {
    capabilities.push("Inflatable Motorized Rescue Boats (RIB)", "Paramedic Advanced Life Support", "High-Clearance All-Terrain Transport");
    if (hasTrapped) capabilities.push("Life jackets & flotation ropes");
  } else if (category === "Major Urban / Building Fire") {
    capabilities.push("High-Pressure Heavy Water Tender", "Hydraulic Aerial Ladder Platform (32m+)", "Compressed Air Breathing Apparatus (CABA)", "Burn Trauma First-Aid Squad");
  } else {
    capabilities.push("Amphibious Evacuation Troop Carrier", "Satellite SATPHONE Communicators", "Emergency Potable Water & Rations", "High-Mast Battery Floodlights");
  }

  // 3. Source Confidence Score
  let confidence = 75;
  if (source === "DRONE_UAV" || source === "FIELD_RESPONDER") confidence = 96;
  else if (source === "ERSS_112_CALL") confidence = 91;
  else if (source === "CITIZEN_APP") confidence = 85;
  else if (source === "SOCIAL_MEDIA") confidence = 72;

  // 4. Missing Information Warnings
  const warnings: string[] = [];
  if (!description.includes("floor") && !description.includes("terrace")) {
    warnings.push("Precise floor/vertical elevation of trapped persons unconfirmed.");
  }
  if (!description.includes("road") && !description.includes("street")) {
    warnings.push("Approach road passability for heavy vehicles pending ground reconnaissance.");
  }

  return {
    suggestedCategory: category,
    proposedSeverity,
    confidenceScore: confidence,
    evidenceSummary: `Signal ingested via ${source.replace(/_/g, " ")}. Natural language classification detected keywords: [${[hasTrapped ? "trapped_citizens" : "", hasMedical ? "medical_emergency" : "", category].filter(Boolean).join(", ")}]. Estimated affected: ~${affectedCount}.`,
    risksIdentified: risks,
    affectedPopulationEstimate: Math.max(affectedCount, 5),
    recommendedPriority: priority,
    suggestedCapabilities: capabilities,
    explanation: `Calculated per NDMA IRS Incident Action matrix. Multi-modal signal aligns with ${proposedSeverity} triage status. Recommended response dispatch within ${priority === 1 ? "< 10 minutes" : "< 25 minutes"}.`,
    missingInformationWarnings: warnings,
    status: "PENDING_REVIEW",
  };
}
