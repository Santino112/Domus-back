import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { toolsManifest } from "./tools/manifest.js";

const server = new McpServer({
    name: "demo-server",
    version: "1.0.0",
});

export function startMCP() {
    const app = express();
    app.use(express.json());

    toolsManifest.forEach(tool => {
        server.registerTool(tool.name, tool);
    });

    // Para ver las tools registradas:
    console.log("Tools registradas:", Object.keys(server.tool)); // devuelve un array con los nombres

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

