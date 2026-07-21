export interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  requiredApproval?: boolean;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  deviceType: string;
  estimatedHours: number;
  steps: WorkflowStep[];
  commonParts: string[];
  diagnosticPath: string;
}

export const WORKFLOW_TEMPLATES: Record<string, WorkflowTemplate> = {
  macbook_liquid: {
    id: "macbook_liquid",
    name: "MacBook Liquid Damage",
    deviceType: "macbook",
    estimatedHours: 4.5,
    commonParts: ["Ultrasonic Solvent", "USB-C Charging IC (CD3217)", "Keyboard Assembly"],
    diagnosticPath: "Isolate power rails, check PPBUS_G3H, check voltage drop on charging lines, ultrasonic soak cycle.",
    steps: [
      { id: "step_1", label: "Microscopic Board Inspection", description: "Audit motherboard under stereo microscope to mark active corrosion, liquid entry, and blown surface components.", requiredApproval: false },
      { id: "step_2", label: "Ultrasonic Core Cleaning soak", description: "Infuse in solvent bath for 45 minutes, bake in dry oven for 2 hours.", requiredApproval: false },
      { id: "step_3", label: "Short Detection & Board Probe", description: "Measure diodes drop on major power lines (PPBUS_G3H, PP5V_S5, PP3V3_G3H).", requiredApproval: false },
      { id: "step_4", label: "Micro-soldering & IC Replacement", description: "Solder corroded passive components or IC logic controllers using hot air station.", requiredApproval: true },
      { id: "step_5", label: "Thermal Camera Verification", description: "Observe board thermal footprint under load to verify no thermal bottlenecks.", requiredApproval: false },
      { id: "step_6", label: "Validation & Battery Calibration", description: "Verify stable current draw, conduct active charging cycle, run Apple Hardware Test suite.", requiredApproval: true }
    ]
  },
  iphone_screen: {
    id: "iphone_screen",
    name: "iPhone Screen & TrueTone calibration",
    deviceType: "iphone",
    estimatedHours: 0.75,
    commonParts: ["Premium LCD/OLED replacement panel", "Waterproof adhesive frame gasket"],
    diagnosticPath: "Verify old screen touch functioning, transfer ambient sensor and TrueTone serial keys using programmer probe.",
    steps: [
      { id: "src_1", label: "Pre-Repair Diagnostic checklist", description: "Run fully visual check of touch sensors, FaceID alignment, proximity limits, front camera, ear capsule speaker.", requiredApproval: false },
      { id: "src_2", label: "Pragmatic Heated Disassembly", description: "Position screen on heating block at 65°C to soften adhesive; pull gently with suction tool to avoid snapping ambient ribbons.", requiredApproval: false },
      { id: "src_3", label: "TrueTone Serial EEPROM Sync", description: "De-solder ambient/earpiece gasket ribbon carefully, use TrueTone programmer box to align display serial keys.", requiredApproval: false },
      { id: "src_4", label: "Dust Extraction & Adhesive Frame layout", description: "Scrape pristine remaining frame seals thoroughly, apply factory graded waterproof custom gaskets.", requiredApproval: false },
      { id: "src_5", label: "Bench Torque Screw Placement", description: "Assemble backplates, tighten grounding shielding Plates precisely without over-torquing internal layers.", requiredApproval: false },
      { id: "src_6", label: "Post-QC Display calibration", description: "Calibrate refresh rates, verify touch latency, test proximity sensors, FaceID registration.", requiredApproval: true }
    ]
  },
  smartphone_battery: {
    id: "smartphone_battery",
    name: "Standard Smartphone Battery replacement",
    deviceType: "smartphone",
    estimatedHours: 1.0,
    commonParts: ["OEM Replacement Lithium-Ion battery pack", "Strong battery adhesive tape pulls"],
    diagnosticPath: "Check charge count, verify battery health, discharge safely below 25% before removal block.",
    steps: [
      { id: "bat_1", label: "Discharge Protection check", description: "Drain cell low to minimize thermal runway danger under mechanical shear hazards.", requiredApproval: false },
      { id: "bat_2", label: "Safety Heated Disassembly", description: "Bake under 65°C, extract screws, detach wireless coils and delicate sub-board connections.", requiredApproval: false },
      { id: "bat_3", label: "Adhesive Release spray & Extraction", description: "Employ isopropyl alcohol 99% to melt backing cement, pull elastic releases cleanly without twisting battery pack.", requiredApproval: false },
      { id: "bat_4", label: "Gold Contact cleaning", description: "Wipe battery contacts with dry micro-fiber cloth to ensure absolute stable current delivery.", requiredApproval: false },
      { id: "bat_5", label: "Thermal Heat dissipator backing", description: "Affix thermal graphite gaskets to conduct battery heat away through heat buffers.", requiredApproval: false },
      { id: "bat_6", label: "Battery Charge cycle test", description: "Cycle cell from 10% up to 100% to calibrate smart battery percentages on screen.", requiredApproval: true }
    ]
  }
};

export class WorkflowTemplateEngine {
  static getTemplate(deviceModel: string, brand?: string): WorkflowTemplate {
    const modelLower = deviceModel?.toLowerCase() || "";
    const brandLower = brand?.toLowerCase() || "";

    if (modelLower.includes("mac") || modelLower.includes("laptop") || brandLower.includes("apple") && modelLower.includes("pro")) {
      return WORKFLOW_TEMPLATES.macbook_liquid;
    }
    if (modelLower.includes("iphone") || brandLower.includes("apple") && modelLower.includes("phone")) {
      return WORKFLOW_TEMPLATES.iphone_screen;
    }
    return WORKFLOW_TEMPLATES.smartphone_battery;
  }
}
