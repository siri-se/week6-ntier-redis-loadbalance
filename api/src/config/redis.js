// src/config/redis.js
// Redis Cache Configuration — NEW in Week 6!
//
// Redis = In-Memory Key-Value Store
// ใช้เป็น Cache Layer เพื่อลด Database Load
//
// Pattern: Cache-Aside (Lazy Loading)
// 1. App ดู Cache ก่อน → ถ้ามี (HIT) → return ทันที
// 2. ถ้าไม่มี (MISS) → Query DB → เก็บใน Cache → return
// 3. เมื่อ Data เปลี่ยน → ลบ Cache (Invalidate)

const { createClient } = require('redis');

let client = null;
let isConnected = false;

// สถิติ Cache (เก็บในหน่วยความจำ)
const stats = {
    hits: 0,
    misses: 0,
    errors: 0,
    get hitRate() {
        const total = this.hits + this.misses;
        return total > 0 ? Math.round((this.hits / total) * 100) : 0;
    }
};

// เชื่อมต่อ Redis
const connectRedis = async () => {
    try {
        client = createClient({
            url: `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`
        });

        client.on('error', (err) => {
            console.error('❌ Redis error:', err.message);
            isConnected = false;
        });

        client.on('connect', () => {
            console.log('✅ Connected to Redis');
            isConnected = true;
        });

        await client.connect();
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
        console.log('⚠️  App will work without cache (degraded mode)');
        isConnected = false;
    }
};

// ดึงข้อมูลจาก Cache
const getCache = async (key) => {
    if (!isConnected || !client) {
        stats.misses++;
        return null;
    }
    try {
        const data = await client.get(key);
        if (data) {
            stats.hits++;
            console.log(`🟢 CACHE HIT: ${key}`);
            return JSON.parse(data);
        }
        stats.misses++;
        console.log(`🔴 CACHE MISS: ${key}`);
        return null;
    } catch (error) {
        stats.errors++;
        console.error('❌ Cache get error:', error.message);
        return null;
    }
};

// เก็บข้อมูลลง Cache
const setCache = async (key, data, ttlSeconds) => {
    if (!isConnected || !client) return;
    try {
        const ttl = ttlSeconds || parseInt(process.env.REDIS_TTL) || 60;
        await client.setEx(key, ttl, JSON.stringify(data));
        console.log(`💾 CACHE SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
        stats.errors++;
        console.error('❌ Cache set error:', error.message);
    }
};

// ลบ Cache (เมื่อข้อมูลเปลี่ยน)
const invalidateCache = async (pattern) => {
    if (!isConnected || !client) return;
    try {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
            await client.del(keys);
            console.log(`🗑️ CACHE INVALIDATED: ${keys.length} keys matching "${pattern}"`);
        }
    } catch (error) {
        console.error('❌ Cache invalidate error:', error.message);
    }
};

// ตรวจสอบสถานะ Redis
const redisHealthCheck = async () => {
    if (!isConnected || !client) {
        return { status: 'disconnected', stats };
    }
    try {
        await client.ping();
        return { status: 'healthy', stats };
    } catch {
        return { status: 'unhealthy', stats };
    }
};

module.exports = { connectRedis, getCache, setCache, invalidateCache, redisHealthCheck, stats };