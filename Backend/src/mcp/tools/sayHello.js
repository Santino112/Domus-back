import { z } from "@modelcontextprotocol/sdk/node_modules/zod";

export const sayHelloTool = {
    name: "sayHello",
    title: "Saludo",
    description: "Devuelve un saludo personalizado",
    inputSchema: z.object({
        name: z.string().optional(),
    }),
    outputSchema: z.object({
        message: z.string(),
    }),
    run: async ({ name }) => {
        const message = `Hola ${name || "Santino"}, ¿cómo estás?`;
        return {
            content: [{ type: "text", text: message }],
            structuredContent: { message },
        };
    },
};
