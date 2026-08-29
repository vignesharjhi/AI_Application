import { Type, FunctionDeclaration } from "@google/genai";

// ==========================================
// 1. Employee Leave & PTO Eligibility Tool
// ==========================================
export function calculateLeaveEligibility(args: {
  employee_type: string;
  tenure_months: number;
  leave_type: string;
  carryover_days?: number;
}): Record<string, any> {
  try {
    const empType = (args.employee_type || "full_time").toLowerCase().replace(/[\s-]/g, "_");
    const tenureMonths = Number(args.tenure_months) || 0;
    const leaveType = (args.leave_type || "annual").toLowerCase().trim();
    const carryoverRequested = Number(args.carryover_days) || 0;

    if (empType === "contractor") {
      return {
        employeeType: "Contractor / Vendor",
        leaveType,
        totalAvailableDays: 0,
        eligible: false,
        note: "Contractors bill for hours/days worked and do not accrue company-paid leave. Time off must be coordinated with the project manager.",
        policyReference: "HR Policy Handbook - Section 4.5 (Contingent Workforce)",
      };
    }

    if (empType === "intern") {
      const earned = Math.min(6, Math.floor(tenureMonths * 1));
      return {
        employeeType: "Intern",
        leaveType: "Internship Stipend Leave",
        earnedDays: earned,
        carryoverApproved: 0,
        totalAvailableDays: earned,
        eligible: true,
        note: "Interns accrue 1 day of paid leave per completed month (up to 6 days max per term).",
        policyReference: "HR Policy Handbook - Section 4.3 (Intern Guidelines)",
      };
    }

    // Full-Time & Part-Time Employees
    let annualBaseDays = 20;
    if (tenureMonths >= 60) {
      annualBaseDays = 25; // 5+ years tenure gets 25 days
    } else if (tenureMonths >= 24) {
      annualBaseDays = 22; // 2-4 years tenure gets 22 days
    }

    if (empType === "part_time") {
      annualBaseDays = Math.round(annualBaseDays * 0.5);
    }

    // Proration for first year of tenure
    let earnedDays = annualBaseDays;
    let isProrated = false;
    if (tenureMonths < 12) {
      earnedDays = Number(((Math.max(1, tenureMonths) / 12) * annualBaseDays).toFixed(1));
      isProrated = true;
    }

    if (leaveType.includes("sick") || leaveType.includes("medical")) {
      return {
        employeeType: empType === "part_time" ? "Part-Time Employee" : "Full-Time Employee",
        leaveType: "Paid Sick & Medical Leave",
        annualAllowance: 10,
        earnedDays: 10,
        carryoverApproved: 0,
        totalAvailableDays: 10,
        consecutiveDaysLimit: "3+ consecutive sick days require a physician note submitted to HR.",
        policyReference: "HR Policy Handbook - Section 4.2 (Health & Wellbeing)",
      };
    }

    if (leaveType.includes("maternity")) {
      return {
        employeeType: "Full-Time Employee",
        leaveType: "Paid Maternity Leave",
        totalAvailableDays: 130, // 26 weeks
        durationWeeks: 26,
        fullyPaid: true,
        eligible: tenureMonths >= 3,
        note: "26 weeks of 100% paid maternity leave. Eligible after 90 days of continuous service.",
        policyReference: "HR Policy Handbook - Section 4.4 (Parental Leave)",
      };
    }

    if (leaveType.includes("paternity")) {
      return {
        employeeType: "Full-Time Employee",
        leaveType: "Paid Paternity Leave",
        totalAvailableDays: 10, // 2 weeks
        durationWeeks: 2,
        fullyPaid: true,
        eligible: tenureMonths >= 3,
        note: "2 weeks (10 working days) of 100% paid paternity leave, usable within 12 months of birth or adoption.",
        policyReference: "HR Policy Handbook - Section 4.4 (Parental Leave)",
      };
    }

    // Standard Annual Vacation / Casual Leave
    const carryoverApproved = Math.min(5, Math.max(0, carryoverRequested));
    const carryoverForfeited = Math.max(0, carryoverRequested - 5);
    const totalAvailableDays = Number((earnedDays + carryoverApproved).toFixed(1));

    return {
      employeeType: empType === "part_time" ? "Part-Time Employee" : "Full-Time Employee",
      leaveType: "Annual Vacation Leave",
      tenureMonths,
      annualBaseQuota: annualBaseDays,
      prorationApplied: isProrated,
      earnedDays,
      carryoverRequested,
      carryoverApproved,
      carryoverForfeited,
      totalAvailableDays,
      rolloverCapNote: "Maximum 5 days can be rolled over to the next calendar year; additional unused days are forfeited.",
      policyReference: "HR Policy Handbook - Section 4.1 (Annual Paid Leave)",
    };
  } catch (err: any) {
    return { error: `Leave calculation failed: ${err.message || String(err)}` };
  }
}

// ==========================================
// 2. IT Service Desk & Incident Ticket Creator
// ==========================================
export function createItSupportTicket(args: {
  category: string;
  urgency: string;
  summary: string;
  affected_system: string;
}): Record<string, any> {
  try {
    const category = (args.category || "software_access").toLowerCase().trim();
    const urgency = (args.urgency || "medium").toLowerCase().trim();
    const summary = args.summary || "General IT assistance requested";
    const system = args.affected_system || "Workplace Device";

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const ticketId = `INC-2026-${randomNum}`;

    let assignedQueue = "IT Service Desk Tier 1";
    let slaResponse = "4 Business Hours";
    let slaResolution = "24 Business Hours";
    let priorityTier = "P3 - Standard";

    if (urgency === "critical") {
      assignedQueue = "Incident Response & SecOps Team";
      slaResponse = "15 Minutes";
      slaResolution = "2 Hours";
      priorityTier = "P1 - Critical Outage";
    } else if (urgency === "high") {
      assignedQueue = "Workplace Systems Engineering (Tier 2)";
      slaResponse = "1 Hour";
      slaResolution = "8 Business Hours";
      priorityTier = "P2 - High Priority";
    } else if (urgency === "low") {
      assignedQueue = "IT Service Desk Tier 1";
      slaResponse = "8 Business Hours";
      slaResolution = "48 Business Hours";
      priorityTier = "P4 - Low / Inquiry";
    }

    return {
      ticketId,
      status: "OPEN_QUEUED",
      priorityTier,
      category,
      affectedSystem: system,
      summary,
      assignedQueue,
      slaResponseTime: slaResponse,
      slaResolutionTarget: slaResolution,
      submittedAt: new Date().toISOString(),
      recommendedNextSteps:
        urgency === "critical"
          ? "Please keep Slack channel #it-incidents open for live engineer engagement."
          : "You will receive real-time updates and notifications via corporate email and Slack bot.",
      policyReference: "IT Operations & Service Catalog - SLA Matrix 2026",
    };
  } catch (err: any) {
    return { error: `IT Ticket generation failed: ${err.message || String(err)}` };
  }
}

// ==========================================
// 3. Corporate Travel Per-Diem & Expense Calculator
// ==========================================
const TIER_1_CITIES = [
  "new york", "san francisco", "london", "tokyo", "singapore", 
  "zurich", "paris", "geneva", "hong kong", "seattle", "boston"
];
const TIER_2_CITIES = [
  "austin", "chicago", "berlin", "amsterdam", "toronto", 
  "dubai", "sydney", "los angeles", "munich", "bangalore", "bengaluru"
];

export function calculateTravelPerDiem(args: {
  destination_city: string;
  trip_duration_days: number;
  hotel_nightly_rate?: number;
  flight_class?: string;
}): Record<string, any> {
  try {
    const city = (args.destination_city || "General").trim();
    const days = Math.max(1, Number(args.trip_duration_days) || 1);
    const hotelRate = Number(args.hotel_nightly_rate) || 0;
    const flightClass = (args.flight_class || "economy").toLowerCase();

    const cityLower = city.toLowerCase();
    let cityTier = "Tier 3 (Standard Destination)";
    let mealPerDiem = 55; // $55 / day
    let hotelCap = 180; // $180 / night
    let groundTransitPerDiem = 15; // $15 / day

    if (TIER_1_CITIES.some((c) => cityLower.includes(c))) {
      cityTier = "Tier 1 (High-Cost Global Metro)";
      mealPerDiem = 85;
      hotelCap = 320;
      groundTransitPerDiem = 25;
    } else if (TIER_2_CITIES.some((c) => cityLower.includes(c))) {
      cityTier = "Tier 2 (Major Business Hub)";
      mealPerDiem = 70;
      hotelCap = 230;
      groundTransitPerDiem = 20;
    }

    const totalMealAllowance = mealPerDiem * days;
    const totalGroundTransit = groundTransitPerDiem * days;
    const nights = Math.max(0, days - 1);
    const allowableHotelPerNight = Math.min(hotelRate || hotelCap, hotelCap);
    const totalAllowableHotel = allowableHotelPerNight * nights;

    const requestedHotelTotal = hotelRate * nights;
    const hotelOverage = Math.max(0, requestedHotelTotal - totalAllowableHotel);

    // Flight policy check
    const isFlightCompliant =
      flightClass === "economy" ||
      flightClass === "premium_economy" ||
      (flightClass === "business" && cityTier.includes("Tier 1"));

    return {
      destinationCity: city,
      cityTier,
      tripDurationDays: days,
      hotelNights: nights,
      perDiemBreakdown: {
        dailyMealRate: `$${mealPerDiem}/day`,
        totalMealsAllowance: `$${totalMealAllowance}`,
        dailyLocalTransit: `$${groundTransitPerDiem}/day`,
        totalLocalTransit: `$${totalGroundTransit}`,
      },
      lodgingAnalysis: {
        allowableCapPerNight: `$${hotelCap}/night`,
        requestedNightlyRate: hotelRate ? `$${hotelRate}` : "Not specified",
        totalAllowableHotelReimbursement: `$${totalAllowableHotel}`,
        overageRequiringPreApproval: hotelOverage > 0 ? `$${hotelOverage}` : "$0 (Within Cap)",
      },
      flightPolicyCheck: {
        requestedClass: flightClass.toUpperCase(),
        compliant: isFlightCompliant,
        ruleNote:
          flightClass === "business"
            ? "Business class is permitted for international flights over 6 hours or VP+ travel. Requires VP pre-approval."
            : "Economy/Premium Economy is standard corporate policy for flights under 6 hours.",
      },
      totalEstimatedAllowableExpense: `$${totalMealAllowance + totalGroundTransit + totalAllowableHotel}`,
      policyReference: "Enterprise Global Travel & Expense Policy - Section 3 (Per-Diem Matrix)",
    };
  } catch (err: any) {
    return { error: `Per-Diem calculation failed: ${err.message || String(err)}` };
  }
}

// ==========================================
// 4. IT Security & NDA Compliance Verifier
// ==========================================
export function verifyComplianceClause(args: {
  action_type: string;
  data_classification: string;
  third_party_tool?: string;
}): Record<string, any> {
  try {
    const action = (args.action_type || "").toLowerCase().trim();
    const dataClass = (args.data_classification || "internal_confidential").toLowerCase().trim();
    const toolName = args.third_party_tool || "External Service";

    if (action.includes("ai_tool") || action.includes("chatgpt") || action.includes("llm") || toolName.toLowerCase().includes("ai")) {
      if (dataClass.includes("restricted") || dataClass.includes("pii") || dataClass.includes("source_code")) {
        return {
          complianceStatus: "STRICTLY_PROHIBITED",
          riskLevel: "CRITICAL",
          actionEvaluated: `Pasting ${dataClass} into public ${toolName}`,
          policyClause: "Information Security Policy 8.4 (Generative AI & Data Leakage Prevention)",
          verdict: "Pasting proprietary code, customer PII, or confidential strategy into non-enterprise AI tools is strictly forbidden.",
          remedy: "Use only internal enterprise AI instances with verified zero-retention data agreements.",
        };
      }
      return {
        complianceStatus: "APPROVED_WITH_CONDITIONS",
        riskLevel: "LOW",
        actionEvaluated: `Using ${toolName} for public/sanitized content`,
        policyClause: "Information Security Policy 8.4 (Generative AI Usage Guidelines)",
        verdict: "Permitted for public marketing drafts, non-confidential boilerplate, and synthetic research data.",
      };
    }

    if (action.includes("usb") || action.includes("removable_drive") || action.includes("flash_drive")) {
      return {
        complianceStatus: "BLOCKED_BY_DLP",
        riskLevel: "HIGH",
        actionEvaluated: "Transferring corporate data to unencrypted USB media",
        policyClause: "Endpoint Protection Policy Section 6.2 (Hardware Security)",
        verdict: "USB mass storage devices are disabled by endpoint device management (DLP).",
        remedy: "Use approved encrypted corporate cloud storage (Google Drive / Enterprise OneDrive) with role-based access.",
      };
    }

    if (action.includes("byod") || action.includes("personal_phone") || action.includes("personal_laptop")) {
      return {
        complianceStatus: "REQUIRES_MDM_ENROLLMENT",
        riskLevel: "MEDIUM",
        actionEvaluated: "Accessing internal corporate apps from personal device",
        policyClause: "BYOD & Remote Work Security Policy Section 5.1",
        verdict: "Personal devices must have Corporate MDM (Mobile Device Management) profile installed with remote wipe capability.",
      };
    }

    if (action.includes("open_source") || action.includes("github_public")) {
      return {
        complianceStatus: "REQUIRES_LEGAL_OSPO_REVIEW",
        riskLevel: "MEDIUM",
        actionEvaluated: "Open-sourcing internal code or repository",
        policyClause: "Open Source Program Office (OSPO) & IP Clause 7.2",
        verdict: "Requires approval from Legal and OSPO to ensure no proprietary patent/copyrighted code is exposed.",
      };
    }

    return {
      complianceStatus: "STANDARD_REVIEW_REQUIRED",
      riskLevel: "LOW",
      actionEvaluated: action || "General Policy Check",
      dataClassification: dataClass,
      policyClause: "Enterprise Code of Conduct & NDA Obligations",
      verdict: "Ensure all confidential assets remain within approved company perimeter and access controls.",
    };
  } catch (err: any) {
    return { error: `Compliance verification failed: ${err.message || String(err)}` };
  }
}

// ==========================================
// Tool Declarations for Gemini 3.6 Flash
// ==========================================
export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "calculate_leave_eligibility",
    description:
      "Calculate employee paid time off (PTO), sick leave, maternity/paternity leave, and rollover carryover caps based on employment type (full-time, part-time, contractor, intern) and tenure according to HR Policy rules.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        employee_type: {
          type: Type.STRING,
          description: "Employment category: 'full_time', 'part_time', 'contractor', or 'intern'.",
        },
        tenure_months: {
          type: Type.NUMBER,
          description: "Number of continuous months the employee has worked at the company.",
        },
        leave_type: {
          type: Type.STRING,
          description: "Type of leave: 'annual', 'sick', 'maternity', or 'paternity'.",
        },
        carryover_days: {
          type: Type.NUMBER,
          description: "Unused leave days from the prior calendar year requested to carry over (max 5 allowable).",
        },
      },
      required: ["employee_type", "tenure_months", "leave_type"],
    },
  },
  {
    name: "create_it_support_ticket",
    description:
      "Generate an official IT Service Desk incident or service request ticket for workplace equipment, VPN access, software licensing, or hardware issues with priority SLA routing.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          description: "Issue category: 'hardware_issue', 'vpn_access', 'software_license', 'password_reset', or 'security_incident'.",
        },
        urgency: {
          type: Type.STRING,
          description: "Urgency level: 'low', 'medium', 'high', or 'critical'.",
        },
        summary: {
          type: Type.STRING,
          description: "Brief summary describing the problem or request.",
        },
        affected_system: {
          type: Type.STRING,
          description: "The specific hardware, laptop model, application, or system affected.",
        },
      },
      required: ["category", "urgency", "summary", "affected_system"],
    },
  },
  {
    name: "calculate_travel_per_diem",
    description:
      "Calculate corporate travel expense allowances, per-diem meal caps, and hotel maximums based on destination city tier and trip duration in accordance with the Enterprise Travel Policy.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        destination_city: {
          type: Type.STRING,
          description: "Destination city name (e.g. 'New York', 'London', 'San Francisco', 'Austin', 'Tokyo', 'Bangalore').",
        },
        trip_duration_days: {
          type: Type.NUMBER,
          description: "Total duration of the business trip in days.",
        },
        hotel_nightly_rate: {
          type: Type.NUMBER,
          description: "Estimated or actual hotel nightly rate in USD to compare against policy caps.",
        },
        flight_class: {
          type: Type.STRING,
          description: "Requested flight travel class: 'economy', 'premium_economy', or 'business'.",
        },
      },
      required: ["destination_city", "trip_duration_days"],
    },
  },
  {
    name: "verify_compliance_clause",
    description:
      "Verify whether a proposed employee action, third-party software usage, data sharing, or BYOD request complies with corporate security policies and employee NDA agreements.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action_type: {
          type: Type.STRING,
          description: "The action being checked: 'use_external_ai_tool', 'byod_device_access', 'usb_storage_transfer', 'open_source_code', or 'vendor_data_access'.",
        },
        data_classification: {
          type: Type.STRING,
          description: "Sensitivity of data involved: 'public', 'internal_confidential', 'restricted_pii', or 'proprietary_source_code'.",
        },
        third_party_tool: {
          type: Type.STRING,
          description: "Optional name of the external software, cloud tool, or vendor involved.",
        },
      },
      required: ["action_type", "data_classification"],
    },
  },
];

// Dispatch Handler
export const TOOL_DISPATCH: Record<string, (args: any) => Promise<any> | any> = {
  calculate_leave_eligibility: (args: any) => calculateLeaveEligibility(args),
  create_it_support_ticket: (args: any) => createItSupportTicket(args),
  calculate_travel_per_diem: (args: any) => calculateTravelPerDiem(args),
  verify_compliance_clause: (args: any) => verifyComplianceClause(args),
};

export function summarizeToolResult(name: string, result: Record<string, any>): string {
  if (result.error) {
    return result.error;
  }
  if (name === "calculate_leave_eligibility") {
    return `Leave Calculated: ${result.totalAvailableDays} days available (${result.leaveType}, ${result.employeeType})`;
  }
  if (name === "create_it_support_ticket") {
    return `Ticket Created: ${result.ticketId} (${result.priorityTier}) → Assigned to ${result.assignedQueue}`;
  }
  if (name === "calculate_travel_per_diem") {
    return `Per-Diem Matrix (${result.cityTier}): Meals ${result.perDiemBreakdown?.totalMealsAllowance}, Hotel Cap ${result.lodgingAnalysis?.allowableCapPerNight}`;
  }
  if (name === "verify_compliance_clause") {
    return `Compliance Status: ${result.complianceStatus} (${result.riskLevel} Risk) - ${result.verdict}`;
  }
  return JSON.stringify(result).slice(0, 200);
}

