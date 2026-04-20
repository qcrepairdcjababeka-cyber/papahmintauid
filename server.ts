import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // GEMINI API Setup
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  // API Routes
  app.post("/api/ai/sentiment", async (req, res) => {
    try {
      const { symbol } = req.body;
      const response = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{
          role: 'user',
          parts: [{
            text: `Perform a real-time sentiment analysis for ${symbol} based on current discussions on X (Twitter), Truth Social, and other major social platforms. 
            Analyze the mood of traders and influencers. 
            Return a summary telling me what people are saying and the percentage of Bullish vs Bearish vs Neutral. 
            Format: JSON with bullish (Number), bearish (Number), neutral (Number), summary (String).`
          }]
        }]
      });
      const text = response.text.replace(/```json|```/g, "");
      res.json(JSON.parse(text));
    } catch (error) {
      console.error("Sentiment AI Error:", error);
      res.status(500).json({ error: "Failed to fetch sentiment" });
    }
  });

  app.get("/api/ai/calendar", async (req, res) => {
    try {
      const response = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{
          role: 'user',
          parts: [{
            text: `Fetch the latest and upcoming high-impact economic calendar events for the USA (USD) for today and the next 24 hours. 
            Focus on critical data like FOMC, CPI, NFP, GDP, and FED speeches.
            Return a JSON array of events with: time, event, impact (high|medium|low), currency.`
          }]
        }]
      });
      const text = response.text.replace(/```json|```/g, "");
      res.json(JSON.parse(text));
    } catch (error) {
      console.error("Calendar AI Error:", error);
      res.status(500).json({ error: "Failed to fetch calendar" });
    }
  });

  app.get("/api/ai/institutional", async (req, res) => {
    try {
      const response = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{
          role: 'user',
          parts: [{
            text: `Perform a high-level scan of institutional trading setups typically found on Bloomberg Terminal for major global assets. 
            Focus on where large institutional funds (Smart Money) are positioning. 
            Return a JSON array of setups including: ticker, bias (LONG|SHORT|NEUTRAL), institutionalFlow, keyLevels (Array), catalyst.`
          }]
        }]
      });
      const text = response.text.replace(/```json|```/g, "");
      res.json(JSON.parse(text));
    } catch (error) {
      console.error("Institutional AI Error:", error);
      res.status(500).json({ error: "Failed to fetch setups" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
