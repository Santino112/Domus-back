import express from 'express';
import { enviarComandoRobot } from '../mqtt/robotClient.js';
import { verificarToken } from '../auth/user.js';
import { obtenerDatos, insertarDatos, actualizarDatos } from '../database.js';

const router = express.Router();

/**
 * POST /api/robot/encender
 * Encender el robot
 */
router.post('/encender', verificarToken, async (req, res) => {
    try {
        const { dispositivo_id = 1 } = req.body;

        // Verificar que el dispositivo existe
        const dispResult = await obtenerDatos('dispositivos', { id: parseInt(dispositivo_id) });
        if (!dispResult.success || dispResult.data.length === 0) {
            return res.status(404).json({ error: 'Dispositivo no encontrado' });
        }

        // Actualizar estado en BD
        const result = await actualizarDatos('dispositivos', 
            { 
                estado: 'activo',
                updated_at: new Date().toISOString()
            },
            { id: parseInt(dispositivo_id) }
        );

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        // Enviar comando MQTT al robot
        const comandoEnviado = enviarComandoRobot({
            accion: 'encender',
            datos: { estado: 'activo' }
        });

        // Crear log de acción
        try {
            await insertarDatos('logs', {
                user_id: req.user.id,
                accion: 'robot_encendido',
                descripcion: `Robot ${dispositivo_id} encendido`,
                ip_address: req.ip || null,
                user_agent: req.headers['user-agent'] || null
            });
        } catch (logErr) {
            console.warn('⚠️ No se pudo guardar log:', logErr.message);
        }

        // Crear alerta informativa
        try {
            await insertarDatos('alertas', {
                user_id: req.user.id,
                dispositivo_id: parseInt(dispositivo_id),
                tipo_alerta: 'robot_encendido',
                descripcion: 'Robot activado correctamente',
                severidad: 'baja',
                leida: false
            });
        } catch (alertErr) {
            console.warn('⚠️ No se pudo crear alerta:', alertErr.message);
        }

        res.json({
            exito: true,
            mensaje: '✅ Robot encendido correctamente',
            estado: 'activo',
            dispositivo_id: parseInt(dispositivo_id),
            comando_mqtt: comandoEnviado ? 'enviado' : 'no_disponible',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('❌ Error al encender robot:', err);
        res.status(500).json({ error: 'Error al encender robot', detalle: err.message });
    }
});

/**
 * POST /api/robot/apagar
 * Apagar el robot
 */
router.post('/apagar', verificarToken, async (req, res) => {
    try {
        const { dispositivo_id = 1 } = req.body;

        // Verificar que el dispositivo existe
        const dispResult = await obtenerDatos('dispositivos', { id: parseInt(dispositivo_id) });
        if (!dispResult.success || dispResult.data.length === 0) {
            return res.status(404).json({ error: 'Dispositivo no encontrado' });
        }

        // Primero detener cualquier movimiento
        enviarComandoRobot({ accion: 'parar' });

        // Actualizar estado en BD
        const result = await actualizarDatos('dispositivos', 
            { 
                estado: 'inactivo',
                updated_at: new Date().toISOString()
            },
            { id: parseInt(dispositivo_id) }
        );

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        // Enviar comando MQTT al robot
        const comandoEnviado = enviarComandoRobot({
            accion: 'apagar',
            datos: { estado: 'inactivo' }
        });

        // Crear log de acción
        try {
            await insertarDatos('logs', {
                user_id: req.user.id,
                accion: 'robot_apagado',
                descripcion: `Robot ${dispositivo_id} apagado`,
                ip_address: req.ip || null,
                user_agent: req.headers['user-agent'] || null
            });
        } catch (logErr) {
            console.warn('⚠️ No se pudo guardar log:', logErr.message);
        }

        // Crear alerta informativa
        try {
            await insertarDatos('alertas', {
                user_id: req.user.id,
                dispositivo_id: parseInt(dispositivo_id),
                tipo_alerta: 'robot_apagado',
                descripcion: 'Robot desactivado correctamente',
                severidad: 'baja',
                leida: false
            });
        } catch (alertErr) {
            console.warn('⚠️ No se pudo crear alerta:', alertErr.message);
        }

        res.json({
            exito: true,
            mensaje: '✅ Robot apagado correctamente',
            estado: 'inactivo',
            dispositivo_id: parseInt(dispositivo_id),
            comando_mqtt: comandoEnviado ? 'enviado' : 'no_disponible',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('❌ Error al apagar robot:', err);
        res.status(500).json({ error: 'Error al apagar robot', detalle: err.message });
    }
});

/**
 * PUT /api/robot/estado/:accion
 * Endpoint unificado para cambiar estado (alternativa RESTful)
 * Uso: PUT /api/robot/estado/encender o PUT /api/robot/estado/apagar
 */
router.put('/estado/:accion', verificarToken, async (req, res) => {
    try {
        const { accion } = req.params;
        const { dispositivo_id = 1 } = req.body;

        // Validar acción
        if (!['encender', 'apagar'].includes(accion)) {
            return res.status(400).json({ 
                error: 'Acción inválida. Use: encender o apagar' 
            });
        }

        // Verificar que el dispositivo existe
        const dispResult = await obtenerDatos('dispositivos', { id: parseInt(dispositivo_id) });
        if (!dispResult.success || dispResult.data.length === 0) {
            return res.status(404).json({ error: 'Dispositivo no encontrado' });
        }

        const nuevoEstado = accion === 'encender' ? 'activo' : 'inactivo';

        // Si está apagando, primero detener movimiento
        if (accion === 'apagar') {
            enviarComandoRobot({ accion: 'parar' });
        }

        // Actualizar estado en BD
        const result = await actualizarDatos('dispositivos', 
            { 
                estado: nuevoEstado,
                updated_at: new Date().toISOString()
            },
            { id: parseInt(dispositivo_id) }
        );

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        // Enviar comando MQTT
        const comandoEnviado = enviarComandoRobot({
            accion: accion,
            datos: { estado: nuevoEstado }
        });

        // Crear log
        try {
            await insertarDatos('logs', {
                user_id: req.user.id,
                accion: `robot_${accion}`,
                descripcion: `Robot ${dispositivo_id} ${accion === 'encender' ? 'encendido' : 'apagado'}`,
                ip_address: req.ip || null,
                user_agent: req.headers['user-agent'] || null
            });
        } catch (logErr) {
            console.warn('⚠️ No se pudo guardar log:', logErr.message);
        }

        res.json({
            exito: true,
            mensaje: `✅ Robot ${accion === 'encender' ? 'encendido' : 'apagado'} correctamente`,
            estado: nuevoEstado,
            dispositivo_id: parseInt(dispositivo_id),
            comando_mqtt: comandoEnviado ? 'enviado' : 'no_disponible',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error(`❌ Error al ${req.params.accion} robot:`, err);
        res.status(500).json({ error: `Error al ${req.params.accion} robot`, detalle: err.message });
    }
});

/**
 * GET /api/robot/estado-actual
 * Obtener estado actual del robot (encendido/apagado)
 */
router.get('/estado-actual', verificarToken, async (req, res) => {
    try {
        const { dispositivo_id = 1 } = req.query;

        const result = await obtenerDatos('dispositivos', { 
            id: parseInt(dispositivo_id) 
        });

        if (!result.success || result.data.length === 0) {
            return res.status(404).json({ 
                error: 'Dispositivo no encontrado' 
            });
        }

        const dispositivo = result.data[0];

        res.json({
            dispositivo_id: dispositivo.id,
            nombre: dispositivo.nombre,
            tipo: dispositivo.tipo,
            estado: dispositivo.estado, // 'activo' o 'inactivo'
            encendido: dispositivo.estado === 'activo',
            ubicacion: dispositivo.ubicacion,
            ultima_actualizacion: dispositivo.updated_at,
            metadata: dispositivo.metadata
        });
    } catch (err) {
        console.error('❌ Error al obtener estado:', err);
        res.status(500).json({ error: 'Error al obtener estado del robot' });
    }
});

/**
 * POST /api/robot/mover
 * Mover el robot en una dirección
 */
router.post('/mover', verificarToken, (req, res) => {
    const { velocidad, direccion } = req.body;

    if (velocidad === undefined || !direccion) {
        return res.status(400).json({ error: 'Faltan velocidad y dirección' });
    }

    const direccionesValidas = ['adelante', 'atras', 'izquierda', 'derecha'];
    if (!direccionesValidas.includes(direccion)) {
        return res.status(400).json({ error: 'Dirección no válida: adelante, atras, izquierda, derecha' });
    }

    if (velocidad < 0 || velocidad > 255) {
        return res.status(400).json({ error: 'Velocidad debe estar entre 0 y 255' });
    }

    const ok = enviarComandoRobot({
        accion: 'mover',
        datos: { velocidad, direccion }
    });

    res.json({
        exito: ok,
        mensaje: ok ? '✅ Comando enviado' : '❌ Error enviando comando',
        comando: { velocidad, direccion }
    });
});

/**
 * POST /api/robot/rotar
 * Rotar el robot
 */
router.post('/rotar', verificarToken, (req, res) => {
    const { angulo } = req.body;

    if (angulo === undefined) {
        return res.status(400).json({ error: 'Ángulo requerido' });
    }

    if (angulo < -360 || angulo > 360) {
        return res.status(400).json({ error: 'Ángulo debe estar entre -360 y 360' });
    }

    const ok = enviarComandoRobot({
        accion: 'rotar',
        datos: { angulo }
    });

    res.json({
        exito: ok,
        mensaje: ok ? '✅ Comando enviado' : '❌ Error enviando comando',
        comando: { angulo }
    });
});

/**
 * POST /api/robot/buscar
 * Buscar un objeto específico
 */
router.post('/buscar', verificarToken, (req, res) => {
    const { objeto, distancia_max } = req.body;

    if (!objeto) {
        return res.status(400).json({ error: 'Objeto a buscar requerido' });
    }

    const ok = enviarComandoRobot({
        accion: 'buscar',
        datos: { objeto, distancia_max: distancia_max || 500 }
    });

    res.json({
        exito: ok,
        mensaje: ok ? '✅ Búsqueda iniciada' : '❌ Error iniciando búsqueda',
        comando: { objeto, distancia_max: distancia_max || 500 }
    });
});

/**
 * POST /api/robot/parar
 * Detener el robot
 */
router.post('/parar', verificarToken, (req, res) => {
    const ok = enviarComandoRobot({ accion: 'parar' });

    res.json({
        exito: ok,
        mensaje: ok ? '✅ Robot detenido' : '❌ Error deteniendo robot'
    });
});

/**
 * POST /api/robot/volver_inicio
 * Devolver robot al punto inicial
 */
router.post('/volver_inicio', verificarToken, (req, res) => {
    const ok = enviarComandoRobot({ accion: 'inicio' });

    res.json({
        exito: ok,
        mensaje: ok ? '✅ Robot retornando al inicio' : '❌ Error en comando'
    });
});

/**
 * POST /api/robot/calibrar
 * Calibrar sensores del robot
 */
router.post('/calibrar', verificarToken, (req, res) => {
    const ok = enviarComandoRobot({ accion: 'calibrar' });

    res.json({
        exito: ok,
        mensaje: ok ? '✅ Calibración iniciada' : '❌ Error en calibración'
    });
});

/**
 * GET /api/robot/posicion
 * Obtener última posición del robot
 */
router.get('/posicion', verificarToken, async (req, res) => {
    try {
        const { limit = 1 } = req.query;
        const result = await obtenerDatos('posicion_robot', { dispositivo_id: 1 });

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        if (result.data.length === 0) {
            return res.json({ 
                mensaje: 'No hay datos de posición disponibles',
                posicion: null 
            });
        }

        const posiciones = result.data
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .slice(0, parseInt(limit));

        res.json({
            total: posiciones.length,
            data: posiciones
        });
    } catch (err) {
        console.error('❌ Error al obtener posición:', err);
        res.status(500).json({ error: 'Error al obtener posición' });
    }
});

/**
 * GET /api/robot/detecciones
 * Obtener objetos detectados por el robot
 */
router.get('/detecciones', verificarToken, async (req, res) => {
    try {
        const { limite = 50, objeto } = req.query;
        let filters = { dispositivo_id: 1 };
        if (objeto) filters.objeto_detectado = objeto;

        const result = await obtenerDatos('detecciones_objeto', filters);
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        const detecciones = result.data
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .slice(0, parseInt(limite));

        res.json({
            total: detecciones.length,
            data: detecciones
        });
    } catch (err) {
        console.error('❌ Error al obtener detecciones:', err);
        res.status(500).json({ error: 'Error al obtener detecciones' });
    }
});

/**
 * GET /api/robot/detecciones/:objeto
 * Obtener detecciones de un objeto específico
 */
router.get('/detecciones/:objeto', verificarToken, async (req, res) => {
    try {
        const { objeto } = req.params;
        const { limite = 50 } = req.query;

        const result = await obtenerDatos('detecciones_objeto', { 
            dispositivo_id: 1,
            objeto_detectado: objeto 
        });

        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        const detecciones = result.data
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .slice(0, parseInt(limite));

        res.json({
            objeto,
            total: detecciones.length,
            data: detecciones
        });
    } catch (err) {
        console.error('❌ Error al obtener detecciones:', err);
        res.status(500).json({ error: 'Error al obtener detecciones' });
    }
});

/**
 * GET /api/robot/estado
 * Obtener estado general del robot
 */
router.get('/estado', verificarToken, async (req, res) => {
    try {
        const posResult = await obtenerDatos('posicion_robot', { dispositivo_id: 1 });
        const dispResult = await obtenerDatos('dispositivos', { id: 1 });

        if (!posResult.success || !dispResult.success) {
            return res.status(500).json({ error: 'Error obteniendo estado' });
        }

        const ultimaPosicion = posResult.data?.[0];
        const dispositivo = dispResult.data?.[0];

        res.json({
            dispositivo: dispositivo?.nombre || 'Robot 1',
            estado: dispositivo?.estado || 'desconocido',
            bateria: ultimaPosicion?.bateria || 0,
            posicion: {
                x: ultimaPosicion?.x || 0,
                y: ultimaPosicion?.y || 0,
                angulo: ultimaPosicion?.angulo || 0
            },
            timestamp: ultimaPosicion?.fecha || new Date()
        });
    } catch (err) {
        console.error('❌ Error al obtener estado:', err);
        res.status(500).json({ error: 'Error al obtener estado' });
    }
});

/**
 * GET /api/robot/historial-movimientos
 * Obtener historial de movimientos del robot
 */
router.get('/historial-movimientos', verificarToken, async (req, res) => {
    try {
        const { limite = 100 } = req.query;

        const result = await obtenerDatos('posicion_robot', { dispositivo_id: 1 });
        if (!result.success) {
            return res.status(500).json({ error: result.error });
        }

        const movimientos = result.data
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
            .slice(0, parseInt(limite));

        res.json({
            total: movimientos.length,
            data: movimientos
        });
    } catch (err) {
        console.error('❌ Error al obtener historial:', err);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

/**
 * GET /api/robot/resumen
 * Obtener resumen de actividad del robot
 */
router.get('/resumen', verificarToken, async (req, res) => {
    try {
        const posResult = await obtenerDatos('posicion_robot', { dispositivo_id: 1 });
        const detResult = await obtenerDatos('detecciones_objeto', { dispositivo_id: 1 });

        const totalMovimientos = posResult.data?.length || 0;
        const totalDetecciones = detResult.data?.length || 0;

        const objetosUnicos = new Set(detResult.data?.map(d => d.objeto_detectado) || []);

        res.json({
            totalMovimientos,
            totalDetecciones,
            objetosDetectados: Array.from(objetosUnicos),
            ultimaActividad: posResult.data?.[0]?.fecha || null
        });
    } catch (err) {
        console.error('❌ Error al obtener resumen:', err);
        res.status(500).json({ error: 'Error al obtener resumen' });
    }
});

export default router;