import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { getDb } from "../utils/firebase.js";
import { collection, query, getDocs, limit } from "firebase/firestore";
import { RetryHelper } from "../utils/RetryHelper.js";

export const aiRouter = Router();

// Lazy initialize Gemini client to avoid crashes if GEMINI_API_KEY is not set on startup
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required for AI operations.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. AI REPAIR TRIAGE
aiRouter.post("/api/ai/triage", async (req, res) => {
  if ((req as any).isGuestMock) {
    return res.json({ prediction: "AI Triage (Demo Model) - Battery replacement recommended. Estimated labor time: 45 min." });
  }
  try {
    const { description, deviceType, deviceModel } = req.body;
    if (!description) {
      return res.status(400).json({ error: "Description is required for triage." });
    }

    const ai = getGeminiClient();
    const prompt = `Perform an enterprise repair triage assessment for the following device.
Device Type: ${deviceType || "Unknown"}
Device Model: ${deviceModel || "Unknown"}
Description: "${description}"

Evaluate the fault, complexity, risk level, estimated turnaround, estimated profitability, required common diagnostic/replacement parts, technician role recommendation, and ideal repair steps template.`;

    const response = await RetryHelper.withRetries(() => ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictedFault: { type: Type.STRING, description: "Detailed summary of the predicted hardware/software fault" },
            complexity: { type: Type.STRING, description: "Low, Medium, High, or Board-Level" },
            estimatedHours: { type: Type.NUMBER, description: "Estimated time in hours required for the physical repair" },
            estimatedProfitability: { type: Type.STRING, description: "Low, Medium, or High" },
            predictedParts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific parts or modules likely needed for repair" },
            repairRisk: { type: Type.STRING, description: "Low, Medium, or High risk of damage/complications" },
            riskExplanation: { type: Type.STRING, description: "Why the risk level was assigned and precautions to take" },
            recommendedAssignment: { type: Type.STRING, description: "Role recommendation (e.g., Level 1 Tech, Board Tech, Senior Micro-solderer)" },
            suggestedWorkflowTemplate: { type: Type.STRING, description: "Identify the best matching workflow template" }
          },
          required: [
            "predictedFault",
            "complexity",
            "estimatedHours",
            "estimatedProfitability",
            "predictedParts",
            "repairRisk",
            "riskExplanation",
            "recommendedAssignment",
            "suggestedWorkflowTemplate"
          ]
        }
      }
    }), 3, 1000);

    const output = JSON.parse(response.text || "{}");
    return res.json(output);
  } catch (err: any) {
    console.error("[AI Router] Triage error:", err);
    return res.status(500).json({ error: err.message || "Failed to perform triage." });
  }
});

// 2. AI REPAIR NOTES GENERATION
aiRouter.post("/api/ai/notes", async (req, res) => {
  try {
    const { shorthand } = req.body;
    if (!shorthand) {
      return res.status(400).json({ error: "Shorthand notes are required." });
    }

    const ai = getGeminiClient();
    const prompt = `Analyze this technician's shorthand repair note: "${shorthand}". Generously expand this raw text into four professional, formatted versions:
1. Professional internal logs for tech files.
2. A simplified customer-facing note describing what was done simply.
3. An insurance-safe, highly formal technical report outlining faults, diagnostic findings, replaced components, and safety verifications.
4. An summary of workflow stages completed for billing/status reports.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            professionalNotes: { type: Type.STRING, description: "Comprehensive hardware tech notes" },
            customerSummary: { type: Type.STRING, description: "Polite, layman-safe customer-facing logs" },
            insuranceReport: { type: Type.STRING, description: "Highly technical report for warranty/insurance claims" },
            workflowSummary: { type: Type.STRING, description: "Workflow checkpoints checked off" }
          },
          required: ["professionalNotes", "customerSummary", "insuranceReport", "workflowSummary"]
        }
      }
    });

    const output = JSON.parse(response.text || "{}");
    return res.json(output);
  } catch (err: any) {
    console.error("[AI Router] Notes error:", err);
    return res.status(500).json({ error: err.message || "Failed to expand repair notes." });
  }
});

// 3. VOICE-TO-TICKET INTAKE PARSER
aiRouter.post("/api/ai/draft-message", async (req, res) => {
  try {
    const { recentMessages } = req.body;
    if (!recentMessages || recentMessages.length === 0) {
      return res.status(400).json({ error: "Missing recent messages array." });
    }

    const ai = getGeminiClient();
    let prompt = `You are a helpful customer service representative for a phone repair shop called Phone Medic. Briefly draft a response to this conversation, keep it polite and professional, short and concise (1-2 sentences). Here is the recent chat history:\n\n`;
    
    recentMessages.forEach((m: any) => {
      prompt += `${m.sender}: ${m.text}\n`;
    });
    prompt += `\nPhone Medic (Your Response):`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });

    return res.json({ reply: response.text });
  } catch (err: any) {
    console.error("[AI Router] Draft Message Error:", err);
    return res.status(500).json({ error: err.message || "Failed to draft AI response." });
  }
});

aiRouter.post("/api/ai/voice", async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: "Voice transcript text is required." });
    }

    const ai = getGeminiClient();
    const prompt = `Evaluate our intake receptionist's vocal transcript: "${transcript}". Parse and transform the vocal inputs into standardized intake object entities. Specify fields as clearly as possible based on verbal mentions.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING, description: "A concise, elegant title for the repair ticket (e.g., iPhone 13 Pro Screen Replacement)" },
            deviceModel: { type: Type.STRING, description: "The specific brand/model identified verbally" },
            repairCategory: { type: Type.STRING, description: "E.g., Screen, Battery, Micro-soldering, Liquid, Diagnostic" },
            issueSummary: { type: Type.STRING, description: "A detailed list of the verbalized complaints from the customer" },
            customerNotes: { type: Type.STRING, description: "Verbalized items left with device, lock codes, or priority details" },
            priority: { type: Type.STRING, description: "Low, Normal, High, Urgent depending on tone or verbal statements" }
          },
          required: ["subject", "deviceModel", "repairCategory", "issueSummary", "customerNotes", "priority"]
        }
      }
    });

    const output = JSON.parse(response.text || "{}");
    return res.json(output);
  } catch (err: any) {
    console.error("[AI Router] Voice Intake parsed error:", err);
    return res.status(500).json({ error: err.message || "Failed to parse verbal intake." });
  }
});

// 4. AI EXECUTIVE OPERATIONS SUMMARY
aiRouter.get("/api/ai/exec", async (req, res) => {
  try {
    // Collect active numbers from Firestore to feed live database stats to Gemini!
    const db = getDb();
    let stats = {
      totalTicketsCount: 0,
      newCount: 0,
      inProgressCount: 0,
      waitingPartsCount: 0,
      completedCount: 0,
      ticketsListSample: [] as any[]
    };

    try {
      const ticketsRef = collection(db, "tickets");
      const snap = await getDocs(query(ticketsRef, limit(100)));
      stats.totalTicketsCount = snap.size;
      snap.forEach(doc => {
        const item = doc.data();
        const status = String(item.status || "").toLowerCase();
        if (status === "new") stats.newCount++;
        else if (status === "in progress" || status === "in_progress") stats.inProgressCount++;
        else if (status === "waiting for parts" || status === "waiting_parts") stats.waitingPartsCount++;
        else if (status === "completed") stats.completedCount++;

        if (stats.ticketsListSample.length < 5) {
          stats.ticketsListSample.push({
            id: doc.id,
            subject: item.subject,
            status: item.status,
            priority: item.priority,
            updated_at: item.updated_at
          });
        }
      });
    } catch (e) {
      console.warn("Could not query tickets for statistics:", e);
    }

    const ai = getGeminiClient();
    const prompt = `You are our AI Executive Operations Manager for our Repair Depot. Assess our store's modern operational statistics:
Active Count: ${stats.totalTicketsCount} records synced
- Status 'New' pending pickup or setup: ${stats.newCount}
- Status 'In Progress' currently on workbench: ${stats.inProgressCount}
- Status 'Waiting for Parts' bottleneck: ${stats.waitingPartsCount}
- Status 'Completed' ready for customer pickup: ${stats.completedCount}

Recent ticket pipeline snapshot:
${JSON.stringify(stats.ticketsListSample, null, 2)}

Provide a concise, executive operational summary of bottlenecks, SLA escalation risks, technician load, inventory actions, and a specific "AI Coaching Suggestion" to increase our average daily throughput.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "An energetic, motivating, and highly practical executive operational summary" },
            bottlenecks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of high-level workflow bottlenecks" },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of strategic prescriptions, assignments, or parts reorder timing alerts" },
            automationOpportunities: { 
              type: Type.ARRAY, 
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  impact: { type: Type.STRING, description: "High, Medium, Low" }
                },
                required: ["title", "description", "impact"]
              },
              description: "Queue automation pipelines identified" 
            }
          },
          required: ["summary", "bottlenecks", "recommendations", "automationOpportunities"]
        }
      }
    });

    const output = JSON.parse(response.text || "{}");
    return res.json(output);
  } catch (err: any) {
    console.error("[AI Router] Exec summary error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate executive operations dashboard." });
  }
});
