import { z } from "zod";
import axios from "axios";

export const askAiTool = {
    name: "askAI",
    title: "Consulta al modelo gpt-4o-mini",
    description: "Envía un prompt al microservicio de IA y devuelve la respuesta",
    inputSchema: z.object({
        prompt: z.string(),
    }),
    outputSchema: z.object({
        respuesta: z.string(),
    }),
    run: async ({ prompt }) => {
        try {
            const res = await axios.post("http://localhost:3000/requestToAI/responseFromAI", {
                prompt,
            });

            const respuesta = res.data.response || res.data;
            return {
                content: [{ type: "text", text: respuesta }],
                structuredContent: { respuesta },
            };
        } catch (error) {
            console.error("Error llamando al microservicio de IA:", error.message);
            return {
                content: [{ type: "text", text: "Error al consultar la IA: " + error.message }],
                structuredContent: { respuesta: "Error en la consulta" },
            };
        }
    },
};
