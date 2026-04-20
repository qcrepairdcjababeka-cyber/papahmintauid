import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Route for Gold Price (Proxy to bypass CORS)
  app.get("/api/gold-price", async (req, res) => {
    try {
      // 1. Try Gold-API (High accuracy for global spot markets like OANDA)
      try {
        const gaResp = await fetch('https://api.gold-api.com/price/XAU');
        if (gaResp.ok) {
          const gaData = await gaResp.json();
          if (gaData && gaData.price && parseFloat(gaData.price) > 500) {
            return res.json([{ price: gaData.price.toString(), source: 'OANDA-Hub' }]);
          }
        }
      } catch (e) {
        console.warn("Gold-API failed, trying fallbacks...");
      }

      // 2. Fallback to Coinbase
      const response = await fetch('https://api.coinbase.com/v2/prices/XAU-USD/spot', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.data && data.data.amount) {
        const priceValue = parseFloat(data.data.amount);
        // Only return if it's a realistic gold price (> $500)
        if (priceValue > 500) {
          return res.json([{ price: data.data.amount }]);
        }
        console.warn("Coinbase returned unrealistic gold price:", data.data.amount);
      }

      // If Coinbase fails or returns weird data, try metals.live
      const metalResp = await fetch('https://api.metals.live/v1/spot/gold');
      const metalData = await metalResp.json();
      
      // metals.live returns [{ "gold": 2415.5 ... }]
      if (metalData && metalData[0] && metalData[0].gold) {
        res.json([{ price: metalData[0].gold.toString() }]);
      } else if (metalData && metalData[0] && metalData[0].price) {
        res.json([{ price: metalData[0].price.toString() }]);
      } else {
        throw new Error("XAU price not available from any source");
      }
    } catch (error) {
      console.error("Gold price proxy error:", error);
      res.status(500).json({ 
        error: "Failed to fetch gold price",
        message: error instanceof Error ? error.message : "Unknown error"
      });
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
