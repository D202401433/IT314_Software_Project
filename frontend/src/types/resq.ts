export type DisasterCategory = 
  | "Flood / Urban Flood"
  | "Cyclone / Coastal Flooding"
  | "Major Urban / Building Fire";

export type IncidentSeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type IncidentLifecycleStatus = 
  | "NEW REPORT"
  | "UNDER REVIEW"
  | "VERIFIED"
  | "DISPATCHED"
  | "RESPONSE IN PROGRESS"
  | "RESOLVED"
  | "CLOSED"
  | "REJECTED"
  | "DUPLICATE";

export type ReportSource = 
  | "CITIZEN_APP"
  | "ERSS_112_CALL"
  | "SOCIAL_MEDIA"
  | "FIELD_RESPONDER"
  | "DRONE_UAV"
  | "SATELLITE_FEED";

export type ReportVerificationStatus = 
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "LINKED_TO_INCIDENT"
  | "NEEDS_FIELD_CHECK";

export type UserRole = 
  | "Public / Citizen"
  | "Command Officer / Incident Commander"
  | "Dispatcher"
  | "NDRF / SDRF Team Leader or Responder"
  | "Medic / Ambulance Team"
  | "Firefighter / Fire Service Officer"
  | "Logistics Officer"
  | "System Administrator";

export type UnitStatus = 
  | "AVAILABLE"
  | "ASSIGNED"
  | "EN ROUTE"
  | "ON SCENE"
  | "BUSY"
  | "OFFLINE";

export type PortalRoleCategory = "user" | "admin" | "service_provider";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  agency: string;
  badgeNumber?: string;
  phone: string;
  avatarUrl?: string;
  password?: string;
  assignedUnitCallsign?: string;
}

export interface IncidentTimelineEvent {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  details?: string;
}

export interface AITriageRecommendation {
  suggestedCategory: DisasterCategory;
  proposedSeverity: IncidentSeverity;
  confidenceScore: number; // 0 - 100
  evidenceSummary: string;
  risksIdentified: string[];
  affectedPopulationEstimate: number;
  recommendedPriority: number; // 1 (highest) - 5 (lowest)
  suggestedCapabilities: string[];
  explanation: string;
  missingInformationWarnings: string[];
  status: "PENDING_REVIEW" | "ACCEPTED" | "OVERRIDDEN" | "REJECTED";
  reviewedBy?: string;
  reviewedAt?: string;
  overrideReason?: string;
}

export interface IncidentRecord {
  id: string; // e.g., INC-2026-081
  category: DisasterCategory;
  title: string;
  description: string;
  lat: number;
  lon: number;
  locationName: string;
  severity: IncidentSeverity;
  lifecycleStatus: IncidentLifecycleStatus;
  detectedAt: string;
  updatedAt: string;
  reporterSource: ReportSource;
  reporterName?: string;
  reporterPhone?: string;
  affectedPeopleEstimate: number;
  urgentNeeds: string[]; // e.g. "Medical Evacuation", "Rescue Boat", "Water Supply"
  evidenceUrls: string[];
  assignedUnitIds: string[];
  relatedReportIds: string[];
  duplicateOfIncidentId?: string;
  aiRecommendation?: AITriageRecommendation;
  timeline: IncidentTimelineEvent[];
}

export interface CitizenReportRecord {
  id: string; // e.g., REP-2026-1042
  source: ReportSource;
  submittedAt: string;
  lat: number;
  lon: number;
  locationName: string;
  category: DisasterCategory;
  description: string;
  affectedPeopleCount: number;
  urgentNeeds: string[];
  photoUrls: string[];
  reporterName: string;
  reporterPhone: string;
  verificationStatus: ReportVerificationStatus;
  linkedIncidentId?: string;
  confidenceScore?: number;
}

export interface ResponderUnitRecord {
  id: string;
  callsign: string; // e.g., AMB-07, FIRE-17, RESCUE-04
  personnelName: string; // e.g. Riya Shah
  role: UserRole;
  agency: string; // NDRF, State Fire Service, EMS 108
  status: UnitStatus;
  currentLat: number;
  currentLon: number;
  assignedIncidentId?: string;
  capabilities: string[];
  vehicleType: string;
  phone: string;
  speedKmH?: number;
}

export interface DispatchAssignmentRecord {
  id: string;
  incidentId: string;
  unitId: string;
  assignedAt: string;
  assignedBy: string;
  status: "ASSIGNED" | "EN ROUTE" | "ON SCENE" | "COMPLETED" | "CANCELLED";
  etaMinutes: number;
  routeCoordinates: [number, number][]; // Polyline points for Leaflet
  notes?: string;
  completedAt?: string;
}

export interface ResourceItemRecord {
  id: string;
  name: string;
  category: "Ambulance" | "Fire Engine" | "Rescue Equipment" | "Medical Supplies" | "Food and Water" | "Drones" | "Fuel" | "Personnel";
  totalStock: number;
  allocatedStock: number;
  availableStock: number;
  unit: string; // "units", "litres", "kits", "packets"
  criticalThreshold: number;
  warehouseLocation: string;
}

export interface InfrastructureRecord {
  id: string;
  type: "HOSPITAL" | "SHELTER" | "FIRE_STATION" | "POLICE_STATION" | "BLOCKED_ROAD";
  name: string;
  lat: number;
  lon: number;
  address: string;
  totalCapacity?: number;
  currentOccupancy?: number;
  availableBeds?: number;
  icuAvailable?: number;
  contactNumber: string;
  status: "OPERATIONAL" | "NEAR_CAPACITY" | "FULL" | "HAZARD_BLOCKED";
  notes?: string;
}

export interface IncidentMessageRecord {
  id: string;
  incidentId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  agency: string;
  messageText: string;
  timestamp: string;
  isPriority: boolean;
  locationRef?: { lat: number; lon: number; label: string };
}

export interface SystemAlertRecord {
  id: string;
  type: "CRITICAL_SEVERITY" | "NEW_INCIDENT" | "VERIFICATION_REQUEST" | "DISPATCH_UPDATE" | "RESOURCE_SHORTAGE" | "BLOCKED_ROAD" | "PUBLIC_WARNING";
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  relatedIncidentId?: string;
  isPublic: boolean;
  targetRoles: UserRole[];
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  recordType: "INCIDENT" | "REPORT" | "DISPATCH" | "RESOURCE" | "AI_TRIAGE" | "AUTH";
  recordId: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
}

export interface DuplicateSuggestion {
  candidateReportId: string;
  existingIncidentId: string;
  confidenceScore: number; // 0 - 100
  distanceMeters: number;
  timeDifferenceMinutes: number;
  sharedKeywords: string[];
  explanation: string;
}
