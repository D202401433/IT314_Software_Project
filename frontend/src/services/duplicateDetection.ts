import { CitizenReportRecord, IncidentRecord, DuplicateSuggestion } from "../types/resq";

// Haversine geodesic distance in meters
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Extract keywords for similarity matching
function extractKeywords(text: string): string[] {
  const stopWords = new Set(["the", "is", "at", "which", "on", "and", "a", "an", "in", "to", "of", "for", "with", "from"]);
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));
}

export function detectDuplicates(
  report: CitizenReportRecord,
  existingIncidents: IncidentRecord[]
): DuplicateSuggestion[] {
  const suggestions: DuplicateSuggestion[] = [];
  const reportWords = extractKeywords(report.description);

  for (const inc of existingIncidents) {
    if (inc.lifecycleStatus === "CLOSED" || inc.lifecycleStatus === "REJECTED") continue;

    // 1. Distance check
    const distanceMeters = calculateDistanceMeters(report.lat, report.lon, inc.lat, inc.lon);

    // 2. Time difference in minutes
    const reportTime = new Date(report.submittedAt).getTime();
    const incTime = new Date(inc.detectedAt).getTime();
    const timeDiffMinutes = Math.abs(Math.round((reportTime - incTime) / (1000 * 60)));

    // 3. Category match
    const categoryMatch = report.category === inc.category;

    // 4. Keyword overlap
    const incWords = extractKeywords(inc.description + " " + inc.title);
    const sharedKeywords = reportWords.filter((w) => incWords.includes(w));

    // Calculate score
    let score = 0;

    // Spatial score (up to 45 pts)
    if (distanceMeters < 300) score += 45;
    else if (distanceMeters < 1000) score += 35;
    else if (distanceMeters < 2500) score += 20;
    else if (distanceMeters < 5000) score += 10;

    // Temporal score (up to 25 pts)
    if (timeDiffMinutes < 60) score += 25;
    else if (timeDiffMinutes < 180) score += 18;
    else if (timeDiffMinutes < 720) score += 10;

    // Category score (up to 20 pts)
    if (categoryMatch) score += 20;

    // Keyword score (up to 10 pts)
    if (sharedKeywords.length >= 3) score += 10;
    else if (sharedKeywords.length >= 1) score += 5;

    // If score >= 50, flag as duplicate candidate
    if (score >= 50) {
      let explanation = "";
      if (distanceMeters < 500) {
        explanation = `Within ${distanceMeters}m of ${inc.id} (${timeDiffMinutes} min difference). Same disaster category: "${report.category}".`;
      } else {
        explanation = `Geographic proximity (${(distanceMeters / 1000).toFixed(1)} km) and matching disaster type with shared keywords: [${sharedKeywords.slice(0, 3).join(", ")}].`;
      }

      suggestions.push({
        candidateReportId: report.id,
        existingIncidentId: inc.id,
        confidenceScore: Math.min(score, 99),
        distanceMeters,
        timeDifferenceMinutes: timeDiffMinutes,
        sharedKeywords,
        explanation,
      });
    }
  }

  return suggestions.sort((a, b) => b.confidenceScore - a.confidenceScore);
}
