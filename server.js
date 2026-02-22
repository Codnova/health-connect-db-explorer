// server.js — Health Connect Explorer API
const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlJsInit = require('sql.js');
const multer = require('multer');

const DB_PATH = process.env.HC_DB_PATH || path.join(__dirname, '..', 'health_connect_export.db');
const PORT = parseInt(process.env.PORT, 10) || 3500;

// Configure multer to use memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB max limit
});
const EXERCISE_TYPES = {
    0: 'Unknown', 2: 'Badminton', 4: 'Baseball', 5: 'Basketball', 8: 'Biking',
    10: 'Boxing', 11: 'Calisthenics', 13: 'Cricket', 14: 'Dancing', 16: 'Fencing',
    17: 'Football (American)', 18: 'Football (Australian)', 20: 'Golf', 22: 'Gymnastics',
    23: 'Handball', 24: 'High-Intensity Interval', 25: 'Hiking', 26: 'Ice Hockey',
    27: 'Ice Skating', 29: 'Martial Arts', 31: 'Paddling', 32: 'Paragliding',
    33: 'Pilates', 34: 'Racquetball', 35: 'Rock Climbing', 36: 'Roller Hockey',
    37: 'Rowing', 38: 'Rugby', 39: 'Running', 40: 'Sailing', 42: 'Scuba Diving',
    43: 'Skating', 44: 'Skiing', 45: 'Snowboarding', 46: 'Snowshoeing',
    47: 'Soccer', 48: 'Softball', 49: 'Squash', 50: 'Stair Climbing',
    51: 'Strength Training', 52: 'Stretching', 53: 'Surfing', 54: 'Swimming (Open Water)',
    55: 'Swimming (Pool)', 56: 'Table Tennis', 57: 'Tennis', 58: 'Weightlifting',
    59: 'Volleyball', 61: 'Walking', 62: 'Water Polo', 63: 'Wheelchair',
    64: 'Yoga', 75: 'Elliptical', 76: 'Rowing Machine', 77: 'Stair Climbing Machine',
    78: 'Exercise Class', 79: 'Other',
};

// Actually — looking at the data, type 53 appears frequently and is "walking" in some mappings
// Let me use a simpler mapping based on what the Health Connect Android SDK uses
const EXERCISE_TYPE_MAP = {
    0: 'Other', 1: 'Back Extension', 2: 'Badminton', 3: 'Barbell Shoulder Press',
    4: 'Baseball', 5: 'Basketball', 6: 'Bench Press', 7: 'Bench Sit-Up',
    8: 'Biking', 9: 'Biking (Stationary)', 10: 'Boot Camp', 11: 'Boxing',
    12: 'Burpee', 13: 'Calisthenics', 14: 'Cricket', 15: 'Crunch',
    16: 'Dancing', 17: 'Deadlift', 18: 'Dumbbell Curl (Right)', 19: 'Dumbbell Curl (Left)',
    20: 'Dumbbell Front Raise', 21: 'Dumbbell Lateral Raise', 22: 'Dumbbell Row',
    23: 'Dumbbell Triceps Extension (Left)', 24: 'Dumbbell Triceps Extension (Right)',
    25: 'Elliptical', 26: 'Exercise Class', 27: 'Fencing',
    28: 'Football (American)', 29: 'Football (Australian)', 30: 'Forward Twist',
    31: 'Frisbee Disc', 32: 'Golf', 33: 'Guided Breathing', 34: 'Gymnastics',
    35: 'Handball', 36: 'HIIT', 37: 'Hiking', 38: 'Ice Hockey', 39: 'Ice Skating',
    40: 'Jump Rope', 41: 'Jumping Jack', 42: 'Lat Pull-Down', 43: 'Lunge',
    44: 'Martial Arts', 45: 'Meditation', 46: 'Mixed Martial Arts',
    47: 'Other', 48: 'Paddling', 49: 'Paragliding', 50: 'Pilates',
    51: 'Plank', 52: 'Racquetball', 53: 'Rock Climbing', 54: 'Roller Hockey',
    55: 'Rowing', 56: 'Rowing Machine', 57: 'Rugby', 58: 'Running',
    59: 'Running (Treadmill)', 60: 'Sailing', 61: 'Scuba Diving', 62: 'Skating',
    63: 'Skiing', 64: 'Snowboarding', 65: 'Snowshoeing', 66: 'Soccer',
    67: 'Softball', 68: 'Squash', 69: 'Squat', 70: 'Stair Climbing',
    71: 'Stair Climbing Machine', 72: 'Strength Training', 73: 'Stretching',
    74: 'Surfing', 75: 'Swimming (Open Water)', 76: 'Swimming (Pool)',
    77: 'Table Tennis', 78: 'Tennis', 79: 'Volleyball',
    80: 'Walking', 81: 'Water Polo', 82: 'Weightlifting',
    83: 'Wheelchair', 84: 'Yoga',
};

const MEAL_TYPES = { 0: 'Unknown', 1: 'Breakfast', 2: 'Lunch', 3: 'Dinner', 4: 'Snack' };

const SLEEP_STAGE_TYPES = {
    0: 'Unknown', 1: 'Awake', 2: 'Sleeping', 3: 'Out of Bed',
    4: 'Light', 5: 'Deep', 6: 'REM',
};

// Helpers
function msToDate(ms) {
    return ms ? new Date(ms).toISOString() : null;
}

function msToLocalDate(ms, offsetSec) {
    if (!ms) return null;
    const d = new Date(ms + (offsetSec || 0) * 1000);
    return d.toISOString().slice(0, 10);
}

function calToKcal(cal) {
    return cal ? Math.round((cal / 1000) * 10) / 10 : 0;
}

function gramsToKg(g) {
    return g ? Math.round((g / 1000) * 100) / 100 : 0;
}

function metersToKm(m) {
    return m ? Math.round((m / 1000) * 100) / 100 : 0;
}

function msDurationToMinutes(startMs, endMs) {
    if (!startMs || !endMs) return 0;
    return Math.round((endMs - startMs) / 60000);
}

function msDurationToHours(startMs, endMs) {
    if (!startMs || !endMs) return 0;
    return Math.round(((endMs - startMs) / 3600000) * 100) / 100;
}

async function main() {
    // Load SQLite
    let SQL = await sqlJsInit();
    let db = null;

    try {
        if (fs.existsSync(DB_PATH)) {
            const dbBuffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(dbBuffer);
            console.log(`[Init] Loaded database from ${DB_PATH}`);
        } else {
            console.log(`[Init] No database found at ${DB_PATH}. Waiting for upload...`);
        }
    } catch (e) {
        console.error(`[Init] Failed to load initial db:`, e.message);
    }

    const app = express();
    app.use(express.static(path.join(__dirname, 'public')));

    // ─── API ────────────────────────────────────────────────────

    // DB Upload endpoint
    app.post('/api/database', upload.single('database'), (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No database file provided' });
            }

            // Close old DB if exists
            if (db) {
                try { db.close(); } catch (e) { }
            }

            // Load new DB buffering in SQL.js
            db = new SQL.Database(req.file.buffer);
            console.log(`[API] Successfully loaded new database from upload`);
            res.json({ success: true, message: 'Database loaded successfully' });
        } catch (err) {
            console.error('[upload]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Overview stats
    app.get('/api/overview', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });

            const stats = {};

            // Date ranges
            const nut = db.exec('SELECT MIN(start_time), MAX(start_time), COUNT(*) FROM nutrition_record_table');
            if (nut[0]) {
                stats.nutrition = { min: msToDate(nut[0].values[0][0]), max: msToDate(nut[0].values[0][1]), count: nut[0].values[0][2] };
            }
            const wt = db.exec('SELECT MIN(time), MAX(time), COUNT(*) FROM weight_record_table');
            if (wt[0]) {
                stats.weight = { min: msToDate(wt[0].values[0][0]), max: msToDate(wt[0].values[0][1]), count: wt[0].values[0][2] };
            }
            const st = db.exec('SELECT MIN(start_time), MAX(start_time), COUNT(*), SUM(count) FROM steps_record_table');
            if (st[0]) {
                stats.steps = { min: msToDate(st[0].values[0][0]), max: msToDate(st[0].values[0][1]), count: st[0].values[0][2], totalSteps: st[0].values[0][3] };
            }
            const sl = db.exec('SELECT MIN(start_time), MAX(start_time), COUNT(*) FROM sleep_session_record_table');
            if (sl[0]) {
                stats.sleep = { min: msToDate(sl[0].values[0][0]), max: msToDate(sl[0].values[0][1]), count: sl[0].values[0][2] };
            }
            const ex = db.exec('SELECT MIN(start_time), MAX(start_time), COUNT(*) FROM exercise_session_record_table');
            if (ex[0]) {
                stats.exercise = { min: msToDate(ex[0].values[0][0]), max: msToDate(ex[0].values[0][1]), count: ex[0].values[0][2] };
            }
            const hr = db.exec('SELECT COUNT(*) FROM heart_rate_record_series_table');
            if (hr[0]) {
                stats.heartRate = { dataPoints: hr[0].values[0][0] };
            }
            const o2 = db.exec('SELECT MIN(time), MAX(time), COUNT(*) FROM oxygen_saturation_record_table');
            if (o2[0]) {
                stats.oxygenSaturation = { min: msToDate(o2[0].values[0][0]), max: msToDate(o2[0].values[0][1]), count: o2[0].values[0][2] };
            }

            // Apps
            const apps = db.exec('SELECT package_name, app_name FROM application_info_table');
            stats.apps = apps[0] ? apps[0].values.map(r => ({ package: r[0], name: r[1] })) : [];

            res.json(stats);
        } catch (err) {
            console.error('[overview]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Weight history
    app.get('/api/weight', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const rows = db.exec(`
                SELECT time, zone_offset, weight
                FROM weight_record_table
                ORDER BY time ASC
            `);
            if (!rows[0]) return res.json([]);

            const data = rows[0].values.map(r => ({
                date: msToLocalDate(r[0], r[1]),
                timestamp: msToDate(r[0]),
                weightKg: gramsToKg(r[2]),
            }));
            res.json(data);
        } catch (err) {
            console.error('[weight]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Nutrition — daily aggregates
    app.get('/api/nutrition', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const limit = Math.min(parseInt(req.query.limit) || 365, 1000);
            const rows = db.exec(`
                SELECT
                    start_time, start_zone_offset,
                    meal_type, meal_name,
                    energy, protein, total_carbohydrate, total_fat,
                    sugar, dietary_fiber, sodium, cholesterol, saturated_fat,
                    calcium, iron, potassium, vitamin_a, vitamin_c, vitamin_d
                FROM nutrition_record_table
                ORDER BY start_time ASC
            `);
            if (!rows[0]) return res.json({ daily: [], meals: [] });

            // Build daily aggregates
            const dailyMap = new Map();
            const meals = [];

            for (const r of rows[0].values) {
                const date = msToLocalDate(r[0], r[1]);
                if (!date) continue;

                const kcal = calToKcal(r[4]);
                const protein = r[5] || 0;
                const carbs = r[6] || 0;
                const fat = r[7] || 0;

                // filter out near-zero values (5e-324 is the DB's "null" sentinel)
                const clean = (v) => (v && v > 0.001) ? Math.round(v * 100) / 100 : 0;

                if (!dailyMap.has(date)) {
                    dailyMap.set(date, { date, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, mealCount: 0 });
                }
                const day = dailyMap.get(date);
                day.kcal += kcal;
                day.protein += clean(protein);
                day.carbs += clean(carbs);
                day.fat += clean(fat);
                day.fiber += clean(r[9]);
                day.sugar += clean(r[8]);
                day.mealCount++;

                meals.push({
                    date,
                    timestamp: msToDate(r[0]),
                    mealType: MEAL_TYPES[r[2]] || 'Unknown',
                    mealName: r[3] || '(unnamed)',
                    kcal,
                    protein: clean(protein),
                    carbs: clean(carbs),
                    fat: clean(fat),
                });
            }

            const daily = [...dailyMap.values()].map(d => ({
                ...d,
                kcal: Math.round(d.kcal),
                protein: Math.round(d.protein * 10) / 10,
                carbs: Math.round(d.carbs * 10) / 10,
                fat: Math.round(d.fat * 10) / 10,
                fiber: Math.round(d.fiber * 10) / 10,
                sugar: Math.round(d.sugar * 10) / 10,
            }));

            res.json({ daily: daily.slice(-limit), meals: meals.slice(-limit * 10) });
        } catch (err) {
            console.error('[nutrition]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Steps — daily totals
    app.get('/api/steps', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const rows = db.exec(`
                SELECT start_time, start_zone_offset, end_time, count
                FROM steps_record_table
                ORDER BY start_time ASC
            `);
            if (!rows[0]) return res.json([]);

            const dailyMap = new Map();
            for (const r of rows[0].values) {
                const date = msToLocalDate(r[0], r[1]);
                if (!date) continue;
                const existing = dailyMap.get(date) || { date, totalSteps: 0 };
                existing.totalSteps += (r[3] || 0);
                dailyMap.set(date, existing);
            }

            res.json([...dailyMap.values()]);
        } catch (err) {
            console.error('[steps]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Sleep sessions with stages
    app.get('/api/sleep', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const sessions = db.exec(`
                SELECT row_id, start_time, start_zone_offset, end_time, end_zone_offset, title, notes
                FROM sleep_session_record_table
                ORDER BY start_time ASC
            `);
            if (!sessions[0]) return res.json([]);

            // Get all stages grouped by parent
            const stagesResult = db.exec(`
                SELECT parent_key, stage_start_time, stage_end_time, stage_type
                FROM sleep_stages_table
                ORDER BY parent_key, stage_start_time
            `);
            const stagesByParent = new Map();
            if (stagesResult[0]) {
                for (const r of stagesResult[0].values) {
                    const list = stagesByParent.get(r[0]) || [];
                    list.push({
                        startTime: msToDate(r[1]),
                        endTime: msToDate(r[2]),
                        durationMin: msDurationToMinutes(r[1], r[2]),
                        stage: SLEEP_STAGE_TYPES[r[3]] || 'Unknown',
                        stageType: r[3],
                    });
                    stagesByParent.set(r[0], list);
                }
            }

            const data = sessions[0].values.map(r => {
                const stages = stagesByParent.get(r[0]) || [];
                const totalMin = msDurationToMinutes(r[1], r[3]);
                const lightMin = stages.filter(s => s.stageType === 4).reduce((acc, s) => acc + s.durationMin, 0);
                const deepMin = stages.filter(s => s.stageType === 5).reduce((acc, s) => acc + s.durationMin, 0);
                const remMin = stages.filter(s => s.stageType === 6).reduce((acc, s) => acc + s.durationMin, 0);
                const awakeMin = stages.filter(s => s.stageType === 1).reduce((acc, s) => acc + s.durationMin, 0);

                return {
                    date: msToLocalDate(r[1], r[2]),
                    startTime: msToDate(r[1]),
                    endTime: msToDate(r[3]),
                    durationHrs: msDurationToHours(r[1], r[3]),
                    durationMin: totalMin,
                    title: r[5],
                    lightMin,
                    deepMin,
                    remMin,
                    awakeMin,
                    stageCount: stages.length,
                };
            });

            res.json(data);
        } catch (err) {
            console.error('[sleep]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Exercise sessions
    app.get('/api/exercise', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const rows = db.exec(`
                SELECT row_id, start_time, start_zone_offset, end_time, exercise_type, title, notes
                FROM exercise_session_record_table
                ORDER BY start_time ASC
            `);
            if (!rows[0]) return res.json([]);

            // Also grab distance & calories for correlation
            const distRows = db.exec(`
                SELECT start_time, start_zone_offset, distance
                FROM distance_record_table
                ORDER BY start_time ASC
            `);
            const calRows = db.exec(`
                SELECT start_time, start_zone_offset, energy
                FROM total_calories_burned_record_table
                ORDER BY start_time ASC
            `);

            const data = rows[0].values.map(r => ({
                date: msToLocalDate(r[1], r[2]),
                startTime: msToDate(r[1]),
                endTime: msToDate(r[3]),
                durationMin: msDurationToMinutes(r[1], r[3]),
                exerciseType: EXERCISE_TYPE_MAP[r[4]] || `Type ${r[4]}`,
                exerciseTypeId: r[4],
                title: r[5] || '',
                notes: r[6] || '',
            }));

            res.json(data);
        } catch (err) {
            console.error('[exercise]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Heart rate — daily averages/min/max (too many data points for raw)
    app.get('/api/heart-rate', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            // Get daily aggregates from the series table joined with parent record
            const rows = db.exec(`
                SELECT
                    h.start_time,
                    h.start_zone_offset,
                    MIN(s.beats_per_minute) as min_bpm,
                    AVG(s.beats_per_minute) as avg_bpm,
                    MAX(s.beats_per_minute) as max_bpm,
                    COUNT(s.beats_per_minute) as data_points
                FROM heart_rate_record_table h
                JOIN heart_rate_record_series_table s ON s.parent_key = h.row_id
                GROUP BY h.row_id
                ORDER BY h.start_time ASC
            `);
            if (!rows[0]) return res.json([]);

            // Aggregate by day
            const dailyMap = new Map();
            for (const r of rows[0].values) {
                const date = msToLocalDate(r[0], r[1]);
                if (!date) continue;
                if (!dailyMap.has(date)) {
                    dailyMap.set(date, { date, minBpm: Infinity, maxBpm: 0, sumBpm: 0, count: 0, dataPoints: 0 });
                }
                const day = dailyMap.get(date);
                day.minBpm = Math.min(day.minBpm, r[2]);
                day.maxBpm = Math.max(day.maxBpm, r[4]);
                day.sumBpm += r[3] * r[5]; // weighted average
                day.count += r[5];
                day.dataPoints += r[5];
            }

            const data = [...dailyMap.values()].map(d => ({
                date: d.date,
                minBpm: d.minBpm === Infinity ? 0 : d.minBpm,
                avgBpm: d.count > 0 ? Math.round(d.sumBpm / d.count) : 0,
                maxBpm: d.maxBpm,
                dataPoints: d.dataPoints,
            }));

            res.json(data);
        } catch (err) {
            console.error('[heart-rate]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Oxygen saturation
    app.get('/api/spo2', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const rows = db.exec(`
                SELECT time, zone_offset, percentage
                FROM oxygen_saturation_record_table
                ORDER BY time ASC
            `);
            if (!rows[0]) return res.json([]);

            const data = rows[0].values.map(r => ({
                date: msToLocalDate(r[0], r[1]),
                timestamp: msToDate(r[0]),
                percentage: Math.round(r[2] * 100) / 100,
            }));
            res.json(data);
        } catch (err) {
            console.error('[spo2]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Body fat
    app.get('/api/body-fat', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const rows = db.exec(`
                SELECT time, zone_offset, percentage
                FROM body_fat_record_table
                ORDER BY time ASC
            `);
            if (!rows[0]) return res.json([]);

            const data = rows[0].values.map(r => ({
                date: msToLocalDate(r[0], r[1]),
                timestamp: msToDate(r[0]),
                percentage: Math.round(r[2] * 1000) / 1000,
            }));
            res.json(data);
        } catch (err) {
            console.error('[body-fat]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Blood Pressure
    app.get('/api/blood-pressure', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const rows = db.exec(`
                SELECT time, zone_offset, systolic, diastolic
                FROM blood_pressure_record_table
                ORDER BY time ASC
            `);
            if (!rows[0]) return res.json([]);

            const data = rows[0].values.map(r => ({
                date: msToLocalDate(r[0], r[1]),
                timestamp: msToDate(r[0]),
                systolic: Math.round(r[2]),
                diastolic: Math.round(r[3]),
            }));
            res.json(data);
        } catch (err) {
            console.error('[blood-pressure]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Generic table browser
    app.get('/api/tables', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
            if (!tables[0]) return res.json([]);

            const result = tables[0].values.map(r => {
                const name = r[0];
                const count = db.exec(`SELECT COUNT(*) FROM [${name}]`);
                return { name, rows: count[0] ? count[0].values[0][0] : 0 };
            }).filter(t => t.rows > 0);

            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get('/api/table/:name', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const name = req.params.name;
            // Whitelist check — only allow existing table names
            const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
            const validNames = tables[0] ? tables[0].values.map(r => r[0]) : [];
            if (!validNames.includes(name)) {
                return res.status(404).json({ error: 'Table not found' });
            }

            const limit = Math.min(parseInt(req.query.limit) || 100, 500);
            const offset = parseInt(req.query.offset) || 0;

            const cols = db.exec(`PRAGMA table_info([${name}])`);
            const columns = cols[0] ? cols[0].values.map(r => ({ name: r[1], type: r[2] })) : [];

            const data = db.exec(`SELECT * FROM [${name}] LIMIT ${limit} OFFSET ${offset}`);
            const count = db.exec(`SELECT COUNT(*) FROM [${name}]`);

            res.json({
                table: name,
                columns,
                totalRows: count[0] ? count[0].values[0][0] : 0,
                offset,
                limit,
                rows: data[0] ? data[0].values : [],
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Fallback
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    app.listen(PORT, () => {
        console.log(`\n  Health Connect Explorer`);
        console.log(`  Database: ${DB_PATH}`);
        console.log(`  Server:   http://localhost:${PORT}\n`);
    });
}

main().catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
});
