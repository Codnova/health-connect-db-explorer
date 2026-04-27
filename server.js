// server.js — Health Connect Explorer API
const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlJsInit = require('sql.js');
const multer = require('multer');

const PORT = parseInt(process.env.PORT, 10) || 3500;

// Configure multer to use memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB max limit
});
// The DB export uses an older sequence of internal integer IDs which differs from the public Android 14 SDK constants.
const EXERCISE_TYPES = {
    0: 'Unknown', 2: 'Badminton', 4: 'Running', 5: 'Basketball', 8: 'Biking',
    10: 'Boxing', 11: 'Calisthenics', 13: 'Cricket', 14: 'Dancing', 16: 'Fencing',
    17: 'Football (American)', 18: 'Football (Australian)', 20: 'Golf', 22: 'Gymnastics',
    23: 'Handball', 24: 'High-Intensity Interval', 25: 'Hiking', 26: 'Ice Hockey',
    27: 'Ice Skating', 29: 'Martial Arts', 31: 'Paddling', 32: 'Paragliding',
    33: 'Elliptical', 34: 'Treadmill', 35: 'Rock Climbing', 36: 'Roller Hockey',
    37: 'Rowing', 38: 'Rugby', 39: 'Running', 40: 'Sailing', 42: 'Scuba Diving',
    43: 'Skating', 44: 'Skiing', 45: 'Snowboarding', 46: 'Snowshoeing',
    47: 'Soccer', 48: 'Softball', 49: 'Squash', 50: 'Stair Climbing',
    51: 'Strength Training', 52: 'Stretching', 53: 'Walking', 54: 'Surfing',
    55: 'Swimming (Open Water)', 56: 'Swimming (Pool)', 57: 'Table Tennis',
    58: 'Weight Training', 59: 'Volleyball', 60: 'Dynamic Workout', 61: 'Water Polo',
    62: 'Wheelchair', 63: 'Yoga'
};

const SEGMENT_TYPES = {
    0: 'Unknown',
    1: 'Arm Curl', 2: 'Back Extension', 3: 'Ball Slam', 4: 'Barbell Shoulder Press',
    5: 'Bench Press', 6: 'Bench Sit Up', 7: 'Biking', 8: 'Biking Stationary',
    9: 'Burpee', 10: 'Crunch', 11: 'Deadlift', 12: 'Double Arm Triceps Extension',
    13: 'Dumbbell Curl Left Arm', 14: 'Dumbbell Curl Right Arm', 15: 'Dumbbell Front Raise',
    16: 'Dumbbell Lateral Raise', 17: 'Dumbbell Row', 18: 'Dumbbell Triceps Extension Left Arm',
    19: 'Dumbbell Triceps Extension Right Arm', 20: 'Dumbbell Triceps Extension Two Arm',
    21: 'Elliptical', 22: 'Forward Twist', 23: 'Front Raise', 24: 'High Intensity Interval Training',
    25: 'Hip Thrust', 26: 'Hula Hoop', 27: 'Jumping Jack', 28: 'Jump Rope',
    29: 'Kettlebell Swing', 30: 'Lateral Raise', 31: 'Lat Pull Down', 32: 'Leg Curl',
    33: 'Leg Extension', 34: 'Leg Press', 35: 'Leg Raise', 36: 'Lunge',
    37: 'Mountain Climber', 38: 'Other Workout', 39: 'Pause', 40: 'Pilates',
    41: 'Plank', 42: 'Pull Up', 43: 'Punch', 44: 'Rest', 45: 'Rowing Machine',
    46: 'Running', 47: 'Running Treadmill', 48: 'Shoulder Press', 49: 'Single Arm Triceps Extension',
    50: 'Sit Up', 51: 'Squat', 52: 'Stair Climbing', 53: 'Stair Climbing Machine',
    54: 'Stretching', 55: 'Swimming Backstroke', 56: 'Swimming Breaststroke', 57: 'Swimming Butterfly',
    58: 'Swimming Freestyle', 59: 'Swimming Mixed', 60: 'Swimming Open Water', 61: 'Swimming Other',
    62: 'Swimming Pool', 63: 'Upper Twist', 64: 'Walking', 65: 'Weightlifting',
    66: 'Wheelchair', 67: 'Yoga',
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
    let currentDbSource = null;

    console.log(`[Init] Waiting for database upload via UI...`);

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
            currentDbSource = req.file.originalname || 'Uploaded Database';

            // Create indexes to optimize heavy queries (especially the 1.5M row HR table)
            try {
                console.log('[Init] Creating indexes for fast queries...');
                db.exec(`CREATE INDEX IF NOT EXISTS idx_hr_parent ON heart_rate_record_series_table(parent_key)`);
                db.exec(`CREATE INDEX IF NOT EXISTS idx_hr_time ON heart_rate_record_series_table(epoch_millis)`);
                db.exec(`CREATE INDEX IF NOT EXISTS idx_hr_main_time ON heart_rate_record_table(start_time, end_time)`);
                db.exec(`CREATE INDEX IF NOT EXISTS idx_speed_parent ON speed_record_table(parent_key)`);
                db.exec(`CREATE INDEX IF NOT EXISTS idx_speed_main_time ON SpeedRecordTable(start_time, end_time)`);
                console.log('[Init] Indexes created successfully');
            } catch(e) {
                console.error('[Init] Error creating indexes', e.message);
            }

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

            const stats = { dbSource: currentDbSource };

            // Helper for safe count queries
            const safeCount = (query) => { try { return db.exec(query); } catch(e) { return []; } };

            // Date ranges
            const nut = safeCount('SELECT MIN(start_time), MAX(start_time), COUNT(*) FROM nutrition_record_table');
            if (nut[0]) {
                stats.nutrition = { min: msToDate(nut[0].values[0][0]), max: msToDate(nut[0].values[0][1]), count: nut[0].values[0][2] };
            }
            const wt = safeCount('SELECT MIN(time), MAX(time), COUNT(*) FROM weight_record_table');
            if (wt[0]) {
                stats.weight = { min: msToDate(wt[0].values[0][0]), max: msToDate(wt[0].values[0][1]), count: wt[0].values[0][2] };
            }
            const st = safeCount('SELECT MIN(start_time), MAX(start_time), COUNT(*), SUM(count) FROM steps_record_table');
            if (st[0]) {
                stats.steps = { min: msToDate(st[0].values[0][0]), max: msToDate(st[0].values[0][1]), count: st[0].values[0][2], totalSteps: st[0].values[0][3] };
            }
            const sl = safeCount('SELECT MIN(start_time), MAX(start_time), COUNT(*) FROM sleep_session_record_table');
            if (sl[0]) {
                stats.sleep = { min: msToDate(sl[0].values[0][0]), max: msToDate(sl[0].values[0][1]), count: sl[0].values[0][2] };
            }
            const ex = safeCount('SELECT MIN(start_time), MAX(start_time), COUNT(*) FROM exercise_session_record_table');
            if (ex[0]) {
                stats.exercise = { min: msToDate(ex[0].values[0][0]), max: msToDate(ex[0].values[0][1]), count: ex[0].values[0][2] };
            }
            const hr = safeCount('SELECT COUNT(*) FROM heart_rate_record_series_table');
            if (hr[0]) {
                stats.heartRate = { dataPoints: hr[0].values[0][0] };
            }
            const o2 = safeCount('SELECT MIN(time), MAX(time), COUNT(*) FROM oxygen_saturation_record_table');
            if (o2[0]) {
                stats.oxygenSaturation = { min: msToDate(o2[0].values[0][0]), max: msToDate(o2[0].values[0][1]), count: o2[0].values[0][2] };
            }
            const vo2 = safeCount('SELECT MIN(time), MAX(time), COUNT(*) FROM vo2_max_record_table');
            if (vo2[0]) {
                stats.vo2Max = { min: msToDate(vo2[0].values[0][0]), max: msToDate(vo2[0].values[0][1]), count: vo2[0].values[0][2] };
            }
            const ht = safeCount('SELECT COUNT(*) FROM height_record_table');
            if (ht[0]) {
                stats.height = { count: ht[0].values[0][0] };
            }
            const bf = safeCount('SELECT COUNT(*) FROM body_fat_record_table');
            if (bf[0]) {
                stats.bodyFat = { count: bf[0].values[0][0] };
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
                    stages: stages,
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

            // Grab distance & calories to link to exercise sessions by time overlap
            let distByTime = [];
            try {
                const distRows = db.exec(`SELECT start_time, end_time, distance FROM distance_record_table ORDER BY start_time ASC`);
                if (distRows[0]) distByTime = distRows[0].values;
            } catch(e) {}

            let calByTime = [];
            try {
                const calRows = db.exec(`SELECT start_time, end_time, energy FROM total_calories_burned_record_table ORDER BY start_time ASC`);
                if (calRows[0]) calByTime = calRows[0].values;
            } catch(e) {}

            // Detect if exercise_segments_table has weight/RPE columns (newer SDK)
            let segHasWeight = false, segHasRpe = false, segHasSetIndex = false;
            try {
                const segCols = db.exec(`PRAGMA table_info(exercise_segments_table)`);
                if (segCols[0]) {
                    const colNames = segCols[0].values.map(c => c[1]);
                    segHasWeight = colNames.includes('weight');
                    segHasRpe = colNames.includes('rpe') || colNames.includes('rate_of_perceived_exertion');
                    segHasSetIndex = colNames.includes('set_index');
                }
            } catch(e) {}

            // Build segment query dynamically
            let segSelect = 'parent_key, segment_start_time, segment_end_time, segment_type, repetitions_count';
            if (segHasWeight) segSelect += ', weight';
            if (segHasRpe) segSelect += ', ' + (segHasRpe ? 'rate_of_perceived_exertion' : 'rpe');
            if (segHasSetIndex) segSelect += ', set_index';

            const segRows = db.exec(`SELECT ${segSelect} FROM exercise_segments_table ORDER BY parent_key, segment_start_time ASC`);
            const segmentsByParent = new Map();
            if (segRows[0]) {
                for (const r of segRows[0].values) {
                    const list = segmentsByParent.get(r[0]) || [];
                    const seg = {
                        startTimeMs: r[1],
                        endTimeMs: r[2],
                        segmentType: r[3],
                        reps: r[4] || 0,
                    };
                    let colIdx = 5;
                    if (segHasWeight) { seg.weight = r[colIdx] || null; colIdx++; }
                    if (segHasRpe) { seg.rpe = r[colIdx] || null; colIdx++; }
                    if (segHasSetIndex) { seg.setIndex = r[colIdx] || null; colIdx++; }
                    list.push(seg);
                    segmentsByParent.set(r[0], list);
                }
            }

            // Helper to sum overlapping distance/calories for a time window
            function sumOverlap(records, startMs, endMs) {
                let total = 0;
                for (const [rStart, rEnd, val] of records) {
                    if (rEnd >= startMs && rStart <= endMs && val) {
                        total += val;
                    }
                }
                return total;
            }

            const data = rows[0].values.map(r => {
                const segments = segmentsByParent.get(r[0]) || [];
                const startMs = r[1];
                const endMs = r[3];
                return {
                    date: msToLocalDate(startMs, r[2]),
                    startTime: msToDate(startMs),
                    endTime: msToDate(endMs),
                    durationMin: msDurationToMinutes(startMs, endMs),
                    exerciseType: EXERCISE_TYPES[r[4]] || `Type ${r[4]}`,
                    exerciseTypeId: r[4],
                    title: r[5] || '',
                    notes: r[6] || '',
                    totalSets: segments.filter(s => s.reps > 0).length,
                    totalReps: segments.reduce((acc, s) => acc + s.reps, 0),
                    distanceM: Math.round(sumOverlap(distByTime, startMs, endMs) * 100) / 100,
                    caloriesBurned: calToKcal(sumOverlap(calByTime, startMs, endMs)),
                    hasWeightData: segHasWeight && segments.some(s => s.weight),
                    hasRpeData: segHasRpe && segments.some(s => s.rpe),
                    segments: segments
                };
            });

            // Attach session IDs and compute HR/speed stats for recent sessions only (last 50)
            // Doing a bulk JOIN across 857 sessions × 1.56M HR rows is too heavy for sql.js
            const recentIds = new Set();
            for (let i = data.length - 1; i >= Math.max(0, data.length - 50); i--) {
                recentIds.add(rows[0].values[i][0]);
            }

            for (let i = 0; i < data.length; i++) {
                const rowId = rows[0].values[i][0];
                data[i].sessionId = rowId;
                data[i].avgBpm = null;
                data[i].maxBpm = null;
                data[i].minBpm = null;
                data[i].hrPoints = 0;
                data[i].avgSpeedKmh = null;

                if (!recentIds.has(rowId)) continue;

                const startMs = rows[0].values[i][1];
                const endMs = rows[0].values[i][3];

                // Per-session HR stats (small targeted query)
                try {
                    const hrRes = db.exec(`
                        SELECT MIN(s.beats_per_minute), ROUND(AVG(s.beats_per_minute)), MAX(s.beats_per_minute), COUNT(*)
                        FROM heart_rate_record_table h
                        JOIN heart_rate_record_series_table s ON s.parent_key = h.row_id
                        WHERE h.start_time <= ${endMs} AND h.end_time >= ${startMs}
                          AND s.epoch_millis >= ${startMs} AND s.epoch_millis <= ${endMs}
                    `);
                    if (hrRes[0] && hrRes[0].values[0][3] > 0) {
                        data[i].minBpm = hrRes[0].values[0][0];
                        data[i].avgBpm = hrRes[0].values[0][1];
                        data[i].maxBpm = hrRes[0].values[0][2];
                        data[i].hrPoints = hrRes[0].values[0][3];
                    }
                } catch(e) {}

                // Per-session avg speed
                try {
                    const spRes = db.exec(`
                        SELECT AVG(sr.speed)
                        FROM SpeedRecordTable sp
                        JOIN speed_record_table sr ON sr.parent_key = sp.row_id
                        WHERE sp.start_time >= ${startMs} AND sp.end_time <= ${endMs}
                    `);
                    if (spRes[0] && spRes[0].values[0][0]) {
                        data[i].avgSpeedKmh = Math.round(spRes[0].values[0][0] * 3.6 * 100) / 100;
                    }
                } catch(e) {}
            }

            res.json(data);
        } catch (err) {
            console.error('[exercise]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Exercise session detail — HR timeline, speed timeline, HR zones
    app.get('/api/exercise-detail/:id', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const sessionId = parseInt(req.params.id);

            // Get session time range
            const session = db.exec(`SELECT start_time, end_time FROM exercise_session_record_table WHERE row_id = ${sessionId}`);
            if (!session[0]) return res.status(404).json({ error: 'Session not found' });
            const [startMs, endMs] = session[0].values[0];

            // HR timeline (downsample to ~1 per 5 seconds max)
            let hrTimeline = [];
            try {
                const hrRows = db.exec(`
                    SELECT s.epoch_millis, s.beats_per_minute
                    FROM heart_rate_record_table h
                    JOIN heart_rate_record_series_table s ON s.parent_key = h.row_id
                    WHERE h.start_time <= ${endMs} AND h.end_time >= ${startMs}
                      AND s.epoch_millis >= ${startMs} AND s.epoch_millis <= ${endMs}
                    ORDER BY s.epoch_millis
                `);
                if (hrRows[0]) {
                    const raw = hrRows[0].values;
                    // Downsample: keep 1 point per 5 seconds
                    let lastKept = -Infinity;
                    for (const [ts, bpm] of raw) {
                        if (ts - lastKept >= 5000) {
                            hrTimeline.push({ t: ts - startMs, bpm });
                            lastKept = ts;
                        }
                    }
                }
            } catch(e) {}

            // HR Zones (standard 5-zone model based on rough age-adjusted max)
            // Using fixed thresholds that work for general population
            const zones = { rest: 0, warmup: 0, fatBurn: 0, cardio: 0, peak: 0 };
            const zoneLabels = { rest: '<100', warmup: '100-120', fatBurn: '120-140', cardio: '140-160', peak: '160+' };
            try {
                const hrAll = db.exec(`
                    SELECT s.beats_per_minute
                    FROM heart_rate_record_table h
                    JOIN heart_rate_record_series_table s ON s.parent_key = h.row_id
                    WHERE h.start_time <= ${endMs} AND h.end_time >= ${startMs}
                      AND s.epoch_millis >= ${startMs} AND s.epoch_millis <= ${endMs}
                `);
                if (hrAll[0]) {
                    for (const [bpm] of hrAll[0].values) {
                        if (bpm >= 160) zones.peak++;
                        else if (bpm >= 140) zones.cardio++;
                        else if (bpm >= 120) zones.fatBurn++;
                        else if (bpm >= 100) zones.warmup++;
                        else zones.rest++;
                    }
                }
            } catch(e) {}

            // Speed timeline
            let speedTimeline = [];
            try {
                const speedRows = db.exec(`
                    SELECT sr.epoch_millis, sr.speed
                    FROM SpeedRecordTable sp
                    JOIN speed_record_table sr ON sr.parent_key = sp.row_id
                    WHERE sp.start_time >= ${startMs} AND sp.end_time <= ${endMs}
                    ORDER BY sr.epoch_millis
                `);
                if (speedRows[0]) {
                    speedTimeline = speedRows[0].values.map(r => ({
                        t: r[0] - startMs,
                        speedMs: Math.round(r[1] * 1000) / 1000,
                        speedKmh: Math.round(r[1] * 3.6 * 100) / 100,
                    }));
                }
            } catch(e) {}

            res.json({
                sessionId,
                durationMs: endMs - startMs,
                hrTimeline,
                hrZones: zones,
                hrZoneLabels: zoneLabels,
                speedTimeline,
                totalHrPoints: hrTimeline.length,
                totalSpeedPoints: speedTimeline.length,
            });
        } catch (err) {
            console.error('[exercise-detail]', err);
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

    // Basal Metabolic Rate
    app.get('/api/bmr', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const rows = db.exec(`
                SELECT time, zone_offset, basal_metabolic_rate
                FROM basal_metabolic_rate_record_table
                ORDER BY time ASC
            `);
            if (!rows[0]) return res.json([]);

            const dailyMap = new Map();
            const wattsToKcalDay = 86400 / 4184; // Conversion from Watts to kcal/day

            for (const r of rows[0].values) {
                const date = msToLocalDate(r[0], r[1]);
                if (!date) continue;
                // Get the latest BMR for that day, convert to kcal
                dailyMap.set(date, Math.round(r[2] * wattsToKcalDay));
            }

            const data = [...dailyMap.entries()].map(([date, bmr]) => ({ date, bmr }));
            res.json(data);
        } catch (err) {
            console.error('[bmr]', err);
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

    // VO2 Max
    app.get('/api/vo2max', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const rows = db.exec(`
                SELECT time, zone_offset, vo2_milliliters_per_minute_kilogram, measurement_method
                FROM vo2_max_record_table
                ORDER BY time ASC
            `);
            if (!rows[0]) return res.json([]);

            const data = rows[0].values.map(r => ({
                date: msToLocalDate(r[0], r[1]),
                timestamp: msToDate(r[0]),
                vo2Max: Math.round(r[2] * 100) / 100,
                method: r[3],
            }));
            res.json(data);
        } catch (err) {
            console.error('[vo2max]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Height
    app.get('/api/height', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const rows = db.exec(`
                SELECT time, zone_offset, height
                FROM height_record_table
                ORDER BY time ASC
            `);
            if (!rows[0]) return res.json([]);

            const data = rows[0].values.map(r => ({
                date: msToLocalDate(r[0], r[1]),
                timestamp: msToDate(r[0]),
                heightM: Math.round(r[2] * 100) / 100,
            }));
            res.json(data);
        } catch (err) {
            console.error('[height]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Active Calories Burned
    app.get('/api/active-calories', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const rows = db.exec(`
                SELECT start_time, start_zone_offset, end_time, energy
                FROM active_calories_burned_record_table
                ORDER BY start_time ASC
            `);
            if (!rows[0]) return res.json([]);

            const dailyMap = new Map();
            for (const r of rows[0].values) {
                const date = msToLocalDate(r[0], r[1]);
                if (!date) continue;
                const existing = dailyMap.get(date) || { date, kcal: 0 };
                existing.kcal += calToKcal(r[3]);
                dailyMap.set(date, existing);
            }

            const data = [...dailyMap.values()].map(d => ({ date: d.date, kcal: Math.round(d.kcal) }));
            res.json(data);
        } catch (err) {
            console.error('[active-calories]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Total Calories Burned (daily)
    app.get('/api/total-calories-burned', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const rows = db.exec(`
                SELECT start_time, start_zone_offset, end_time, energy
                FROM total_calories_burned_record_table
                ORDER BY start_time ASC
            `);
            if (!rows[0]) return res.json([]);

            const dailyMap = new Map();
            for (const r of rows[0].values) {
                const date = msToLocalDate(r[0], r[1]);
                if (!date) continue;
                const existing = dailyMap.get(date) || { date, kcal: 0 };
                existing.kcal += calToKcal(r[3]);
                dailyMap.set(date, existing);
            }

            const data = [...dailyMap.values()].map(d => ({ date: d.date, kcal: Math.round(d.kcal) }));
            res.json(data);
        } catch (err) {
            console.error('[total-calories-burned]', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Distance (daily)
    app.get('/api/distance', (req, res) => {
        try {
            if (!db) return res.status(400).json({ error: 'Database not loaded' });
            const rows = db.exec(`
                SELECT start_time, start_zone_offset, distance
                FROM distance_record_table
                ORDER BY start_time ASC
            `);
            if (!rows[0]) return res.json([]);

            const dailyMap = new Map();
            for (const r of rows[0].values) {
                const date = msToLocalDate(r[0], r[1]);
                if (!date) continue;
                const existing = dailyMap.get(date) || { date, distanceM: 0 };
                existing.distanceM += (r[2] || 0);
                dailyMap.set(date, existing);
            }

            const data = [...dailyMap.values()].map(d => ({
                date: d.date,
                distanceKm: metersToKm(d.distanceM),
            }));
            res.json(data);
        } catch (err) {
            console.error('[distance]', err);
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

            let rows = data[0] ? data[0].values : [];

            // Decode integers into human readable strings
            const exTypeIdx = columns.findIndex(c => c.name === 'exercise_type');
            const segTypeIdx = columns.findIndex(c => c.name === 'segment_type');

            if (exTypeIdx >= 0 || segTypeIdx >= 0) {
                rows = rows.map(row => {
                    const newRow = [...row];
                    if (exTypeIdx >= 0 && newRow[exTypeIdx] != null) {
                        const val = newRow[exTypeIdx];
                        newRow[exTypeIdx] = EXERCISE_TYPES[val] || `${val} (Unknown)`;
                    }
                    if (segTypeIdx >= 0 && newRow[segTypeIdx] != null) {
                        const val = newRow[segTypeIdx];
                        newRow[segTypeIdx] = SEGMENT_TYPES[val] || `${val} (Unknown)`;
                    }
                    return newRow;
                });
            }

            res.json({
                table: name,
                columns,
                totalRows: count[0] ? count[0].values[0][0] : 0,
                offset,
                limit,
                rows,
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
        console.log(`  Database: Waiting for upload via UI`);
        console.log(`  Server:   http://localhost:${PORT}\n`);
    });
}

main().catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
});
