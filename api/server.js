// server.js — Entry Point
// แต่ละ Instance มี INSTANCE_ID ไม่ซ้ำกัน เพื่อพิสูจน์ว่า Load Balancing ทำงาน!

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const taskRoutes = require('./src/routes/taskRoutes');
const errorHandler = require('./src/middleware/errorHandler');
const { healthCheck: dbHealthCheck } = require('./src/config/database');
const { connectRedis, redisHealthCheck, stats: cacheStats } = require('./src/config/redis');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// 🆔 Instance ID — สุ่มเพื่อแยกแต่ละ Instance
const INSTANCE_ID = `app-${os.hostname().slice(-4)}-${Math.random().toString(36).slice(2, 6)}`;
console.log(`\n🆔 Instance ID: ${INSTANCE_ID}\n`);

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('short'));

// ⭐ Health Check — แสดง Instance ID + Cache Stats
app.get('/api/health', async (req, res) => {
    const dbStatus = await dbHealthCheck();
    const redisStatus = await redisHealthCheck();
    res.json({
        status: 'ok',
        instanceId: INSTANCE_ID,
        timestamp: new Date().toISOString(),
        database: dbStatus,
        redis: redisStatus,
        cache: {
            hits: cacheStats.hits,
            misses: cacheStats.misses,
            hitRate: `${cacheStats.hitRate}%`
        }
    });
});

// API Routes
app.use('/api', taskRoutes);

// Error Handler
app.use(errorHandler);

// Start Server + Connect Redis
const startServer = async () => {
    await connectRedis();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 TaskBoard API running on port ${PORT}`);
        console.log(`🆔 Instance: ${INSTANCE_ID}`);
        console.log(`📊 Health: http://localhost:${PORT}/api/health\n`);
    });
};

startServer();