import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { toolsManifest } from "./tools/manifest.js";

// Crear el servidor MCP
const server = new McpServer({
    name: "demo-server",
    version: "1.0.0",
});

toolsManifest.forEach(tool => {
    server.registerTool(tool.name, tool, tool.run);
});

export function startMCP() {
    const app = express();
    app.use(express.json());

    // Endpoint para manejar las solicitudes MCP
    app.post("/mcp", async (req, res) => {
        const transport = new StreamableHTTPServerTransport({
            enableJsonResponse: true,
            disableAuth: true
        });

        res.on("close", () => transport.close());
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    });

    const port = 4000;
    app.listen(port, () => {
        console.log(`✅ MCP Server corriendo en http://localhost:${port}/mcp`);
    });
}
