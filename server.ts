import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import { dbService } from "./src/services/database";
import { seedData } from "./src/services/seedData";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Database with seed data if empty
dbService.seed(seedData).catch(err => console.error("Initial seeding failed:", err));

const app = express();
const PORT = 3000;

async function setupServer() {
  app.use(express.json());

  // API Routes
  app.post("/api/translate", async (req, res) => {
    const { text, customApiKey } = req.body;
    
    try {
      const apiKey = customApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("Translation failed: API Key is missing");
        return res.status(400).json({ error: "API Key is missing. Please enter it in Settings." });
      }

      console.log(`Translating: "${text}" using ${customApiKey ? "custom" : "server"} API key`);
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Translate the following Korean text to natural Japanese and provide a word-by-word breakdown (tokens). 
        Text: "${text}"
        
        Return the result in JSON format with the following structure:
        {
          "original": "Korean text",
          "translated": "Japanese translation",
          "tokens": [
            { "id": "1", "text": "Japanese word", "furigana": "reading", "meaning": "Korean meaning" }
          ]
        }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              original: { type: Type.STRING },
              translated: { type: Type.STRING },
              tokens: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    text: { type: Type.STRING },
                    furigana: { type: Type.STRING },
                    meaning: { type: Type.STRING }
                  },
                  required: ["id", "text", "meaning"]
                }
              }
            },
            required: ["original", "translated", "tokens"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      res.json(result);
    } catch (error: any) {
      console.error("Translation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/scenarios", async (req, res) => {
    try {
      const scenarios = await dbService.getScenarios();
      res.json(scenarios);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/scenarios/search", async (req, res) => {
    const query = req.query.q as string;
    try {
      const scenario = await dbService.getScenarioByKorean(query);
      if (scenario) {
        res.json(scenario);
      } else {
        res.status(404).json({ error: "Not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/scenarios/:id", async (req, res) => {
    const id = req.params.id;
    try {
      const scenario = await dbService.getScenarioById(id);
      if (scenario) {
        res.json(scenario);
      } else {
        res.status(404).json({ error: "Not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/scenarios", async (req, res) => {
    const { korean, japanese, tokens, level, category } = req.body;
    try {
      const result = await dbService.addScenario({
        korean,
        japanese,
        tokens,
        level: level || 1,
        category: category || '일반'
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/config", (req, res) => {
    res.json({
      kakaoKey: process.env.VITE_KAKAO_JS_KEY || ""
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

setupServer();

export default app;
