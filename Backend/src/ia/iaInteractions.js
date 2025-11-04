import express from 'express';
import { getOpenAIClient } from '../aiModel/aiModel.js';
import { obtenerDatos, insertarDatos } from '../database.js';
import { verificarToken } from '../auth/user.js';
import cron from 'node-cron';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function construirContextoSensores() {
    try {
        const dispositivos = [
            { id: 2, nombre: 'Sensor de temperatura' },
            { id: 3, nombre: 'Sensor de humedad' }
        ];
        
        let contexto = 'Datos más recientes de los sensores:\n\n';

        for (const dispositivo of dispositivos) {
            const result = await obtenerDatos('sensor_data', { dispositivo_id: dispositivo.id });
            if (result.success && result.data.length > 0) {
                const ultimo = result.data[result.data.length - 1];
                contexto += `${dispositivo.nombre}:\n${JSON.stringify(ultimo, null, 2)}\n\n`;
            } else {
                contexto += `${dispositivo.nombre}: sin datos disponibles.\n\n`;
            }
        }
        return contexto;
    } catch (error) {
        console.error('❌ Error al construir contexto de sensores:', error.message);
        return 'Error al obtener datos de sensores.';
    }
}

export const analisisIA = async (req, res) => {
    if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API Key no configurada' });
    }

    try {
        const openai = getOpenAIClient();
        const contexto = await construirContextoSensores();

        const prompt = `Eres un asistente experto en análisis de datos ambientales y robótica. 
            Analiza la siguiente pregunta y proporciona recomendaciones basadas en buenas prácticas.
            
            ¿Deberia tomar precauciones en base a estos datos de mi hogar o no hace falta?: ${contexto}
            
            Proporciona respuestas claras, concisas y accionables. En la respuesta no incluyas asteriscos, ni numerales, ni guiones`;

        const response = await openai.responses.create({
            model: 'gpt-4o-mini',
            input: prompt
        })

        const textoIA = response.output[0].content[0].text;

        await insertarDatos('ai_interactions', {
            user_id: 1,
            prompt: prompt,
            response: textoIA,
            model: 'gpt-4o-mini',
            metadata: { tipo_analisis: 'general' }
        });

        res.json({
            respuesta: textoIA,
            modelo: 'gpt-4o-mini'
        });
    } catch (err) {
        console.error('❌ Error en análisis IA:', err.message);
        res.status(500).json({ error: 'Error al procesar análisis con IA' });
    }
};

cron.schedule('0 * * * *', async () => {
    console.log('⏰ Ejecutando análisis IA automático...');
    await analisisIA();
});