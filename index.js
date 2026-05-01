const express = require('express');
const fetch = require('node-fetch');
const { Client } = require('pg');
const app = express();
app.use(express.json());

// Conexión automática con la base de datos de Railway
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
    .then(() => console.log('Conexión a base de datos de clientes exitosa'))
    .catch(err => console.error('Error de conexión a base de datos', err.stack));

app.post('/v1/chat/completions', async (req, res) => {
    // El frontend debe enviar el correo del usuario en los Headers como 'x-user-email'
    const userEmail = req.headers['x-user-email']; 

    if (!userEmail) {
        return res.status(400).json({ error: "No se proporcionó correo de usuario." });
    }

    try {
        // 1. Buscamos al cliente en la tabla que creaste antes en Railway
        const query = 'SELECT activo, fecha_vencimiento FROM clientes WHERE email = $1';
        const resDb = await client.query(query, [userEmail]);
        
        // 2. Si el cliente no existe o no está activo, bloqueamos el acceso
        if (resDb.rows.length === 0 || !resDb.rows[0].activo) {
            return res.status(403).json({ error: "Suscripción vencida o usuario no registrado. Yapea S/ 35 para renovar." });
        }

        const usuario = resDb.rows[0];
        const hoy = new Date();
        const fechaVencimiento = new Date(usuario.fecha_vencimiento);

        // 3. Verificamos la fecha de vencimiento
        if (fechaVencimiento < hoy) {
            return res.status(403).json({ error: "Tu mes de servicio ha vencido. Por favor, yapea S/ 35 para renovar." });
        }

        // 4. Si todo está en orden, llamamos a OpenRouter en secreto
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`, // Tu clave secreta, oculta del cliente
                "Content-Type": "application/json",
                "HTTP-Referer": "https://tu-sitio.com", // Opcional para OpenRouter
                "X-Title": "Tu Proyecto de IA Profesional"
            },
            body: JSON.stringify(req.body) // Reenviamos la pregunta del usuario
        });

        const data = await response.json();
        res.json(data); // Devolvemos la respuesta de la IA al cliente

    } catch (error) {
        console.error('Error en el proxy:', error);
        res.status(500).json({ error: "Error interno en el servidor puente." });
    }
});

// Configuración del puerto obligatoria para Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Puente activo y escuchando en el puerto ${PORT}`);
});
