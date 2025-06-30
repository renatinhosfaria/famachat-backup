import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Para produção, usa dist/public do diretório raiz do projeto
  const rootDir = path.resolve(__dirname, "..");
  const distPath = path.resolve(rootDir, "dist", "public");
  
  // Para desenvolvimento, procura em alguns locais possíveis
  const devPaths = [
    path.resolve(__dirname, "public"),
    path.resolve(rootDir, "public"),
    path.resolve(rootDir, "client", "dist"),
    "/var/www/famachat/dist/public"  // Caminho absoluto como fallback
  ];
  
  let finalDistPath = distPath;
  
  // Se não existe dist/public, tenta os caminhos de desenvolvimento
  if (!fs.existsSync(distPath)) {
    console.log(`[DEBUG] dist/public não encontrado em: ${distPath}`);
    
    const devPath = devPaths.find(p => fs.existsSync(p));
    if (devPath) {
      finalDistPath = devPath;
      console.log(`[DEBUG] Usando caminho de desenvolvimento: ${finalDistPath}`);
    } else {
      console.log(`[DEBUG] Caminhos testados: ${devPaths.join(', ')}`);
      throw new Error(
        `Could not find the build directory: ${distPath}, make sure to build the client first`,
      );
    }
  } else {
    console.log(`[DEBUG] Usando caminho de produção: ${finalDistPath}`);
  }

  app.use(express.static(finalDistPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(finalDistPath, "index.html"));
  });
}
