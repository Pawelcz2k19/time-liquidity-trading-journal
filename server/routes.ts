import type { Express, Request, Response } from "express";
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import express from "express";
import { storage } from "./storage";
import {
  insertTradeSchema,
  insertJournalSchema,
  insertPlaybookSchema,
  insertSettingsSchema,
} from "@shared/schema";
import { z } from "zod";
import rateLimit from "express-rate-limit";

// Import payload schema: arrays are optional + each item validated via its insert schema (extended to tolerate a leading id field from a prior export).
const importSchema = z.object({
  mode: z.enum(["merge", "replace"]).default("merge"),
  trades: z.array(insertTradeSchema.passthrough()).max(50000).optional(),
  journals: z.array(insertJournalSchema.passthrough()).max(50000).optional(),
  playbooks: z.array(insertPlaybookSchema.passthrough()).max(10000).optional(),
  settings: insertSettingsSchema.partial().passthrough().optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Allow large screenshot uploads (base64 data URLs)
  app.use(express.json({ limit: "25mb" }));

  // Rate limit all API routes — public unauthenticated endpoint
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    limit: 200,           // max 200 requests/min per IP
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests, please slow down." },
  });
  // Stricter limiter for expensive bulk operations
  const bulkLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Import/export rate limit reached, please wait a minute." },
  });
  app.use("/api/", apiLimiter);
  app.use(["/api/import", "/api/export"], bulkLimiter);

  // ===== Trades =====
  app.get("/api/trades", async (_req: Request, res: Response) => {
    res.json(await storage.listTrades());
  });

  app.get("/api/trades/:id", async (req: Request, res: Response) => {
    const t = await storage.getTrade(Number(req.params.id));
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  });

  app.post("/api/trades", async (req: Request, res: Response) => {
    const parsed = insertTradeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createTrade(parsed.data));
  });

  app.patch("/api/trades/:id", async (req: Request, res: Response) => {
    const parsed = insertTradeSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const t = await storage.updateTrade(Number(req.params.id), parsed.data);
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  });

  app.delete("/api/trades/:id", async (req: Request, res: Response) => {
    await storage.deleteTrade(Number(req.params.id));
    res.json({ ok: true });
  });

  // ===== Journal =====
  app.get("/api/journals", async (_req: Request, res: Response) => {
    res.json(await storage.listJournals());
  });

  app.get("/api/journals/by-date/:date", async (req: Request, res: Response) => {
    const j = await storage.getJournalByDate(req.params.date);
    res.json(j ?? null);
  });

  app.post("/api/journals", async (req: Request, res: Response) => {
    const parsed = insertJournalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.upsertJournal(parsed.data));
  });

  app.delete("/api/journals/:id", async (req: Request, res: Response) => {
    await storage.deleteJournal(Number(req.params.id));
    res.json({ ok: true });
  });

  // ===== Playbooks =====
  app.get("/api/playbooks", async (_req: Request, res: Response) => {
    res.json(await storage.listPlaybooks());
  });

  app.post("/api/playbooks", async (req: Request, res: Response) => {
    const parsed = insertPlaybookSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createPlaybook(parsed.data));
  });

  app.patch("/api/playbooks/:id", async (req: Request, res: Response) => {
    const parsed = insertPlaybookSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const p = await storage.updatePlaybook(Number(req.params.id), parsed.data);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  });

  app.delete("/api/playbooks/:id", async (req: Request, res: Response) => {
    await storage.deletePlaybook(Number(req.params.id));
    res.json({ ok: true });
  });

  // ===== Settings =====
  app.get("/api/settings", async (_req: Request, res: Response) => {
    res.json(await storage.getSettings());
  });

  app.patch("/api/settings", async (req: Request, res: Response) => {
    const parsed = insertSettingsSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.updateSettings(parsed.data));
  });

  // ===== Export / Import =====
  app.get("/api/export", async (_req: Request, res: Response) => {
    res.json(await storage.exportAll());
  });

  app.post("/api/import", async (req: Request, res: Response) => {
    const parsed = importSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { mode, trades, journals, playbooks, settings } = parsed.data;
    res.json(await storage.importAll({ mode, trades, journals, playbooks, settings }));
  });

  return httpServer;
}
