import { Router } from "express";
import axios from "axios";
import { getDb } from "../utils/firebase.js";
import {
  getRecentTickets,
  migrationProgress,
  runMigrationInBackground,
  processNewTicketWebhook
} from "../services/repairshoprService.js";

export const repairshoprRouter = Router();

repairshoprRouter.get("/api/repairshopr/customers", async (req, res) => {
  try {
    const { query, page } = req.query;
    const subdomain = process.env.REPAIRSHOPR_SUBDOMAIN;
    const apiKey = process.env.REPAIRSHOPR_API_KEY;
    if (!subdomain || !apiKey) return res.status(500).json({ error: "Config missing" });

    const response = await axios.get(`https://${subdomain}.repairshopr.com/api/v1/customers`, {
      params: { query, page },
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed" });
  }
});

repairshoprRouter.get("/api/repairshopr/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const subdomain = process.env.REPAIRSHOPR_SUBDOMAIN;
    const apiKey = process.env.REPAIRSHOPR_API_KEY;
    if (!subdomain || !apiKey) return res.status(500).json({ error: "Config missing" });

    const response = await axios.get(`https://${subdomain}.repairshopr.com/api/v1/customers/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("RS Customer ID Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

repairshoprRouter.put("/api/repairshopr/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const subdomain = process.env.REPAIRSHOPR_SUBDOMAIN;
    const apiKey = process.env.REPAIRSHOPR_API_KEY;
    if (!subdomain || !apiKey) return res.status(500).json({ error: "Config missing" });

    const response = await axios.put(`https://${subdomain}.repairshopr.com/api/v1/customers/${id}`, data, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    res.json(response.data);
  } catch (e: any) {
    console.error("RS Update Customer Error:", e.response?.data || e.message);
    res.status(500).json({ error: "Failed to update customer" });
  }
});

repairshoprRouter.get("/api/repairshopr/tickets", async (req, res) => {
  try {
    const { customer_id, query } = req.query;
    const subdomain = process.env.REPAIRSHOPR_SUBDOMAIN;
    const apiKey = process.env.REPAIRSHOPR_API_KEY;
    if (!subdomain || !apiKey) return res.status(500).json({ error: "Config missing" });

    const response = await axios.get(`https://${subdomain}.repairshopr.com/api/v1/tickets`, {
      params: { customer_id, query },
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed" });
  }
});

repairshoprRouter.post("/api/repairshopr/sync/tickets/recent", async (req, res) => {
  try {
    const subdomain = process.env.REPAIRSHOPR_SUBDOMAIN;
    const apiKey = process.env.REPAIRSHOPR_API_KEY;
    if (!subdomain || !apiKey) return res.status(500).json({ error: "Config missing" });

    const result = await getRecentTickets(subdomain, apiKey);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

repairshoprRouter.delete("/api/repairshopr/tickets/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const subdomain = process.env.REPAIRSHOPR_SUBDOMAIN;
    const apiKey = process.env.REPAIRSHOPR_API_KEY;
    if (!subdomain || !apiKey) return res.status(500).json({ error: "Config missing" });

    const response = await axios.delete(`https://${subdomain}.repairshopr.com/api/v1/tickets/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed" });
  }
});

repairshoprRouter.post("/api/repairshopr/sms", async (req, res) => {
  try {
    const { to, message, customerId } = req.body;
    const subdomain = process.env.REPAIRSHOPR_SUBDOMAIN;
    const apiKey = process.env.REPAIRSHOPR_API_KEY;
    const response = await axios.post(`https://${subdomain}.repairshopr.com/api/v1/sms/send`, { to, message, customerId }, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
  }
});

repairshoprRouter.get("/api/repairshopr/migrate/status", (req, res) => {
  res.json(migrationProgress);
});

repairshoprRouter.post("/api/repairshopr/migrate", async (req, res) => {
  const subdomain = process.env.REPAIRSHOPR_SUBDOMAIN;
  const apiKey = process.env.REPAIRSHOPR_API_KEY;
  if (!subdomain || !apiKey) return res.status(500).json({ error: "Config missing" });

  if (migrationProgress.status !== "idle" && migrationProgress.status !== "completed" && migrationProgress.status !== "error") {
    return res.status(200).json({ status: "migration_already_running", progress: migrationProgress });
  }

  // Run in background to prevent timeout
  runMigrationInBackground(subdomain, apiKey);
  res.status(200).json({ status: "migration_started" });
});

repairshoprRouter.post("/api/webhooks/repairshopr/new-ticket", async (req, res) => {
  try {
    await processNewTicketWebhook(req.body);
    if (!res.headersSent) res.status(200).send("OK");
  } catch (error: any) {
    console.error("[Webhooks] RepairShopr New Ticket Router Error:", error);
    if (!res.headersSent) res.status(200).send("OK");
  }
});
