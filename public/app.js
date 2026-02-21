// app.js — Health Connect Explorer frontend
(function () {
    'use strict';

    // ─── Chart.js defaults ───
    Chart.defaults.color = '#9096a8';
    Chart.defaults.borderColor = '#2e3140';
    Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyleWidth = 8;
    Chart.defaults.plugins.tooltip.backgroundColor = '#252836';
    Chart.defaults.plugins.tooltip.titleColor = '#e4e6ed';
    Chart.defaults.plugins.tooltip.bodyColor = '#9096a8';
    Chart.defaults.plugins.tooltip.borderColor = '#2e3140';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.padding = 10;

    const COLORS = {
        accent: '#6c8cff',
        accent2: '#4ecdc4',
        green: '#4caf50',
        orange: '#ff9800',
        red: '#f44336',
        purple: '#ab47bc',
        pink: '#ec407a',
        yellow: '#fdd835',
        lightBlue: '#29b6f6',
    };

    // ─── State ───
    const charts = {};
    const loadedPanels = new Set();
    let overviewData = null;

    // ─── Nav ───
    document.getElementById('nav').addEventListener('click', e => {
        if (e.target.tagName !== 'BUTTON') return;
        const panel = e.target.dataset.panel;
        document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${panel}`).classList.add('active');
        loadPanel(panel);
    });

    // ─── API helper ───
    async function api(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    }

    // ─── Time filtering helper ───
    function filterByDays(data, days, dateField = 'date') {
        if (!days) return data;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        return data.filter(d => d[dateField] >= cutoffStr);
    }

    function addTimeFilter(container, callback) {
        const div = document.createElement('div');
        div.className = 'time-filter';
        const ranges = [
            { label: '30 days', days: 30 },
            { label: '90 days', days: 90 },
            { label: '6 months', days: 180 },
            { label: '1 year', days: 365 },
            { label: 'All time', days: 0 },
        ];
        ranges.forEach(r => {
            const btn = document.createElement('button');
            btn.textContent = r.label;
            if (r.days === 90) btn.classList.add('active');
            btn.addEventListener('click', () => {
                div.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                callback(r.days || null);
            });
            div.appendChild(btn);
        });
        container.prepend(div);
        return 90; // default
    }

    // ─── Destroy chart helper ───
    function destroyChart(id) {
        if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    }

    // ─── Panel loaders ───
    async function loadPanel(name) {
        if (loadedPanels.has(name)) return;
        loadedPanels.add(name);
        try {
            switch (name) {
                case 'overview': await loadOverview(); break;
                case 'weight': await loadWeight(); break;
                case 'nutrition': await loadNutrition(); break;
                case 'steps': await loadSteps(); break;
                case 'sleep': await loadSleep(); break;
                case 'exercise': await loadExercise(); break;
                case 'heart': await loadHeartRate(); break;
                case 'explorer': await loadExplorer(); break;
            }
        } catch (err) {
            const panel = document.getElementById(`panel-${name}`);
            panel.innerHTML = `<div class="stat-card"><div class="label">Error</div><div class="value" style="font-size:16px;color:var(--red)">${err.message}</div></div>`;
        }
    }

    // ─── Overview ───
    async function loadOverview() {
        overviewData = await api('/api/overview');
        const d = overviewData;
        const panel = document.getElementById('panel-overview');

        const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
        const fmtRange = (obj) => obj ? `${fmtDate(obj.min)} — ${fmtDate(obj.max)}` : '';

        panel.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="label">Nutrition Records</div>
                    <div class="value">${d.nutrition?.count?.toLocaleString() || 0}</div>
                    <div class="sub">${fmtRange(d.nutrition)}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Weight Records</div>
                    <div class="value">${d.weight?.count?.toLocaleString() || 0}</div>
                    <div class="sub">${fmtRange(d.weight)}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Steps Records</div>
                    <div class="value">${d.steps?.count?.toLocaleString() || 0}</div>
                    <div class="sub">Total: ${(d.steps?.totalSteps || 0).toLocaleString()} steps</div>
                </div>
                <div class="stat-card">
                    <div class="label">Sleep Sessions</div>
                    <div class="value">${d.sleep?.count?.toLocaleString() || 0}</div>
                    <div class="sub">${fmtRange(d.sleep)}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Exercise Sessions</div>
                    <div class="value">${d.exercise?.count?.toLocaleString() || 0}</div>
                    <div class="sub">${fmtRange(d.exercise)}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Heart Rate Data Points</div>
                    <div class="value">${(d.heartRate?.dataPoints || 0).toLocaleString()}</div>
                    <div class="sub">From Samsung Health</div>
                </div>
                <div class="stat-card">
                    <div class="label">SpO2 Records</div>
                    <div class="value">${d.oxygenSaturation?.count?.toLocaleString() || 0}</div>
                    <div class="sub">${fmtRange(d.oxygenSaturation)}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Data Sources</div>
                    <div class="value">${d.apps?.length || 0}</div>
                    <div class="sub">${(d.apps || []).map(a => a.name).join(', ')}</div>
                </div>
            </div>
        `;

        document.getElementById('dbInfo').textContent =
            `${fmtDate(d.nutrition?.min || d.steps?.min)} to ${fmtDate(d.nutrition?.max || d.steps?.max)}`;
    }

    // ─── Weight ───
    async function loadWeight() {
        const data = await api('/api/weight');
        const panel = document.getElementById('panel-weight');
        if (!data.length) { panel.innerHTML = '<div class="stat-card"><div class="label">No weight data</div></div>'; return; }

        const latest = data[data.length - 1];
        const first = data[0];
        const change = (latest.weightKg - first.weightKg).toFixed(1);
        const min = Math.min(...data.map(d => d.weightKg));
        const max = Math.max(...data.map(d => d.weightKg));

        panel.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="label">Current Weight</div>
                    <div class="value">${latest.weightKg} kg</div>
                    <div class="sub">${latest.date}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Total Change</div>
                    <div class="value" style="color:${change <= 0 ? 'var(--green)' : 'var(--orange)'}">${change > 0 ? '+' : ''}${change} kg</div>
                    <div class="sub">Since ${first.date}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Range</div>
                    <div class="value" style="font-size:22px">${min} — ${max} kg</div>
                    <div class="sub">${data.length} measurements</div>
                </div>
            </div>
            <div class="chart-box">
                <h3>Weight Over Time</h3>
                <div class="chart-wrap tall"><canvas id="chart-weight"></canvas></div>
            </div>
        `;

        const defaultDays = addTimeFilter(panel, (days) => {
            renderWeightChart(data, days);
        });
        renderWeightChart(data, defaultDays);
    }

    function renderWeightChart(allData, days) {
        const data = filterByDays(allData, days);
        destroyChart('weight');
        charts['weight'] = new Chart(document.getElementById('chart-weight'), {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: 'Weight (kg)',
                    data: data.map(d => d.weightKg),
                    borderColor: COLORS.accent,
                    backgroundColor: COLORS.accent + '20',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: days && days <= 90 ? 'day' : 'week' } },
                    y: { title: { display: true, text: 'kg' } }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.parsed.y} kg`
                        }
                    }
                }
            }
        });
    }

    // ─── Nutrition ───
    async function loadNutrition() {
        const { daily, meals } = await api('/api/nutrition');
        const panel = document.getElementById('panel-nutrition');
        if (!daily.length) { panel.innerHTML = '<div class="stat-card"><div class="label">No nutrition data</div></div>'; return; }

        // Averages (last 30 days)
        const last30 = filterByDays(daily, 30);
        const avg = (arr, key) => arr.length ? Math.round(arr.reduce((s, d) => s + d[key], 0) / arr.length) : 0;

        panel.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="label">Avg Daily Calories (30d)</div>
                    <div class="value">${avg(last30, 'kcal').toLocaleString()}</div>
                    <div class="sub">kcal/day</div>
                </div>
                <div class="stat-card">
                    <div class="label">Avg Protein (30d)</div>
                    <div class="value" style="color:var(--accent2)">${avg(last30, 'protein')}g</div>
                    <div class="sub">per day</div>
                </div>
                <div class="stat-card">
                    <div class="label">Avg Carbs (30d)</div>
                    <div class="value" style="color:var(--orange)">${avg(last30, 'carbs')}g</div>
                    <div class="sub">per day</div>
                </div>
                <div class="stat-card">
                    <div class="label">Avg Fat (30d)</div>
                    <div class="value" style="color:var(--pink)">${avg(last30, 'fat')}g</div>
                    <div class="sub">per day</div>
                </div>
            </div>
            <div class="chart-row">
                <div class="chart-box">
                    <h3>Daily Calories</h3>
                    <div class="chart-wrap tall"><canvas id="chart-calories"></canvas></div>
                </div>
            </div>
            <div class="chart-row two-col">
                <div class="chart-box">
                    <h3>Macronutrients</h3>
                    <div class="chart-wrap tall"><canvas id="chart-macros"></canvas></div>
                </div>
                <div class="chart-box">
                    <h3>Macro Split (Last 30 Days)</h3>
                    <div class="chart-wrap"><canvas id="chart-macro-pie"></canvas></div>
                </div>
            </div>
            <div class="chart-box">
                <h3>Recent Meals</h3>
                <div class="table-wrap" style="max-height:400px;overflow-y:auto">
                    <table>
                        <thead><tr><th>Date</th><th>Meal</th><th>Name</th><th>Kcal</th><th>Protein</th><th>Carbs</th><th>Fat</th></tr></thead>
                        <tbody id="meals-table"></tbody>
                    </table>
                </div>
            </div>
        `;

        const defaultDays = addTimeFilter(panel, (days) => {
            renderNutritionCharts(daily, days);
        });
        renderNutritionCharts(daily, defaultDays);

        // Meals table (last 100)
        const tbody = document.getElementById('meals-table');
        const recentMeals = meals.slice(-100).reverse();
        tbody.innerHTML = recentMeals.map(m => `
            <tr>
                <td>${m.date}</td>
                <td><span class="pill blue">${m.mealType}</span></td>
                <td>${escHtml(m.mealName)}</td>
                <td>${Math.round(m.kcal)}</td>
                <td>${m.protein}g</td>
                <td>${m.carbs}g</td>
                <td>${m.fat}g</td>
            </tr>
        `).join('');
    }

    function renderNutritionCharts(allDaily, days) {
        const daily = filterByDays(allDaily, days);

        // Calories chart
        destroyChart('calories');
        charts['calories'] = new Chart(document.getElementById('chart-calories'), {
            type: 'bar',
            data: {
                labels: daily.map(d => d.date),
                datasets: [{
                    label: 'Calories (kcal)',
                    data: daily.map(d => d.kcal),
                    backgroundColor: COLORS.accent + '80',
                    borderColor: COLORS.accent,
                    borderWidth: 1,
                    borderRadius: 3,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: days && days <= 90 ? 'day' : 'week' } },
                    y: { title: { display: true, text: 'kcal' }, beginAtZero: true }
                }
            }
        });

        // Macros stacked
        destroyChart('macros');
        charts['macros'] = new Chart(document.getElementById('chart-macros'), {
            type: 'line',
            data: {
                labels: daily.map(d => d.date),
                datasets: [
                    { label: 'Protein (g)', data: daily.map(d => d.protein), borderColor: COLORS.accent2, backgroundColor: COLORS.accent2 + '15', fill: true, tension: 0.3, pointRadius: 0 },
                    { label: 'Carbs (g)', data: daily.map(d => d.carbs), borderColor: COLORS.orange, backgroundColor: COLORS.orange + '15', fill: true, tension: 0.3, pointRadius: 0 },
                    { label: 'Fat (g)', data: daily.map(d => d.fat), borderColor: COLORS.pink, backgroundColor: COLORS.pink + '15', fill: true, tension: 0.3, pointRadius: 0 },
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: days && days <= 90 ? 'day' : 'week' } },
                    y: { title: { display: true, text: 'grams' }, beginAtZero: true }
                }
            }
        });

        // Macro pie — use whatever filtered range we have
        const totalP = daily.reduce((s, d) => s + d.protein, 0);
        const totalC = daily.reduce((s, d) => s + d.carbs, 0);
        const totalF = daily.reduce((s, d) => s + d.fat, 0);
        destroyChart('macroPie');
        charts['macroPie'] = new Chart(document.getElementById('chart-macro-pie'), {
            type: 'doughnut',
            data: {
                labels: ['Protein', 'Carbs', 'Fat'],
                datasets: [{
                    data: [Math.round(totalP), Math.round(totalC), Math.round(totalF)],
                    backgroundColor: [COLORS.accent2, COLORS.orange, COLORS.pink],
                    borderColor: '#1a1d27',
                    borderWidth: 3,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? Math.round(ctx.parsed / total * 100) : 0;
                                return `${ctx.label}: ${ctx.parsed.toLocaleString()}g (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // ─── Steps ───
    async function loadSteps() {
        const data = await api('/api/steps');
        const panel = document.getElementById('panel-steps');
        if (!data.length) { panel.innerHTML = '<div class="stat-card"><div class="label">No steps data</div></div>'; return; }

        const last30 = filterByDays(data, 30);
        const avg30 = last30.length ? Math.round(last30.reduce((s, d) => s + d.totalSteps, 0) / last30.length) : 0;
        const maxDay = data.reduce((best, d) => d.totalSteps > best.totalSteps ? d : best, data[0]);
        const totalAll = data.reduce((s, d) => s + d.totalSteps, 0);

        panel.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="label">Avg Daily Steps (30d)</div>
                    <div class="value">${avg30.toLocaleString()}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Best Day</div>
                    <div class="value" style="color:var(--green)">${maxDay.totalSteps.toLocaleString()}</div>
                    <div class="sub">${maxDay.date}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Total Steps</div>
                    <div class="value">${totalAll.toLocaleString()}</div>
                    <div class="sub">${data.length} days tracked</div>
                </div>
            </div>
            <div class="chart-box">
                <h3>Daily Steps</h3>
                <div class="chart-wrap tall"><canvas id="chart-steps"></canvas></div>
            </div>
        `;

        const defaultDays = addTimeFilter(panel, (days) => renderStepsChart(data, days));
        renderStepsChart(data, defaultDays);
    }

    function renderStepsChart(allData, days) {
        const data = filterByDays(allData, days);
        destroyChart('steps');

        // Color bars based on step count
        const bgColors = data.map(d =>
            d.totalSteps >= 10000 ? COLORS.green + '80' :
            d.totalSteps >= 5000 ? COLORS.orange + '80' :
            COLORS.red + '60'
        );

        charts['steps'] = new Chart(document.getElementById('chart-steps'), {
            type: 'bar',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: 'Steps',
                    data: data.map(d => d.totalSteps),
                    backgroundColor: bgColors,
                    borderRadius: 3,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: days && days <= 90 ? 'day' : 'week' } },
                    y: { title: { display: true, text: 'Steps' }, beginAtZero: true }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // ─── Sleep ───
    async function loadSleep() {
        const data = await api('/api/sleep');
        const panel = document.getElementById('panel-sleep');
        if (!data.length) { panel.innerHTML = '<div class="stat-card"><div class="label">No sleep data</div></div>'; return; }

        const last30 = filterByDays(data, 30);
        const avgDuration = last30.length ? (last30.reduce((s, d) => s + d.durationHrs, 0) / last30.length).toFixed(1) : '—';
        const avgDeep = last30.length ? Math.round(last30.reduce((s, d) => s + d.deepMin, 0) / last30.length) : 0;
        const avgRem = last30.length ? Math.round(last30.reduce((s, d) => s + d.remMin, 0) / last30.length) : 0;

        panel.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="label">Avg Sleep Duration (30d)</div>
                    <div class="value">${avgDuration} hrs</div>
                </div>
                <div class="stat-card">
                    <div class="label">Avg Deep Sleep (30d)</div>
                    <div class="value" style="color:var(--purple)">${avgDeep} min</div>
                </div>
                <div class="stat-card">
                    <div class="label">Avg REM Sleep (30d)</div>
                    <div class="value" style="color:var(--accent)">${avgRem} min</div>
                </div>
                <div class="stat-card">
                    <div class="label">Total Sessions</div>
                    <div class="value">${data.length}</div>
                </div>
            </div>
            <div class="chart-box">
                <h3>Sleep Duration</h3>
                <div class="chart-wrap tall"><canvas id="chart-sleep-duration"></canvas></div>
            </div>
            <div class="chart-box" style="margin-top:16px">
                <h3>Sleep Stages Breakdown</h3>
                <div class="chart-wrap tall"><canvas id="chart-sleep-stages"></canvas></div>
            </div>
        `;

        const defaultDays = addTimeFilter(panel, (days) => renderSleepCharts(data, days));
        renderSleepCharts(data, defaultDays);
    }

    function renderSleepCharts(allData, days) {
        const data = filterByDays(allData, days);

        // Duration chart
        destroyChart('sleepDuration');
        charts['sleepDuration'] = new Chart(document.getElementById('chart-sleep-duration'), {
            type: 'bar',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: 'Duration (hrs)',
                    data: data.map(d => d.durationHrs),
                    backgroundColor: data.map(d =>
                        d.durationHrs >= 7 ? COLORS.green + '70' :
                        d.durationHrs >= 5 ? COLORS.orange + '70' :
                        COLORS.red + '70'
                    ),
                    borderRadius: 3,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: days && days <= 90 ? 'day' : 'week' } },
                    y: { title: { display: true, text: 'Hours' }, beginAtZero: true }
                },
                plugins: { legend: { display: false } }
            }
        });

        // Stages stacked bar
        destroyChart('sleepStages');
        charts['sleepStages'] = new Chart(document.getElementById('chart-sleep-stages'), {
            type: 'bar',
            data: {
                labels: data.map(d => d.date),
                datasets: [
                    { label: 'Deep', data: data.map(d => d.deepMin), backgroundColor: COLORS.purple + 'bb' },
                    { label: 'REM', data: data.map(d => d.remMin), backgroundColor: COLORS.accent + 'bb' },
                    { label: 'Light', data: data.map(d => d.lightMin), backgroundColor: COLORS.lightBlue + '70' },
                    { label: 'Awake', data: data.map(d => d.awakeMin), backgroundColor: COLORS.orange + '50' },
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: days && days <= 90 ? 'day' : 'week' }, stacked: true },
                    y: { title: { display: true, text: 'Minutes' }, stacked: true, beginAtZero: true }
                }
            }
        });
    }

    // ─── Exercise ───
    async function loadExercise() {
        const data = await api('/api/exercise');
        const panel = document.getElementById('panel-exercise');
        if (!data.length) { panel.innerHTML = '<div class="stat-card"><div class="label">No exercise data</div></div>'; return; }

        // Count by type
        const typeCounts = {};
        data.forEach(d => {
            typeCounts[d.exerciseType] = (typeCounts[d.exerciseType] || 0) + 1;
        });
        const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

        const totalMin = data.reduce((s, d) => s + d.durationMin, 0);
        const last30 = filterByDays(data, 30);
        const last30Min = last30.reduce((s, d) => s + d.durationMin, 0);

        panel.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="label">Total Sessions</div>
                    <div class="value">${data.length}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Total Exercise Time</div>
                    <div class="value">${Math.round(totalMin / 60)} hrs</div>
                    <div class="sub">${totalMin.toLocaleString()} minutes</div>
                </div>
                <div class="stat-card">
                    <div class="label">Last 30 Days</div>
                    <div class="value">${last30.length} sessions</div>
                    <div class="sub">${Math.round(last30Min / 60)} hours</div>
                </div>
                <div class="stat-card">
                    <div class="label">Most Common</div>
                    <div class="value" style="font-size:20px">${sortedTypes[0]?.[0] || '—'}</div>
                    <div class="sub">${sortedTypes[0]?.[1] || 0} sessions</div>
                </div>
            </div>
            <div class="chart-row two-col">
                <div class="chart-box">
                    <h3>Sessions by Type</h3>
                    <div class="chart-wrap"><canvas id="chart-exercise-types"></canvas></div>
                </div>
                <div class="chart-box">
                    <h3>Weekly Exercise Minutes</h3>
                    <div class="chart-wrap"><canvas id="chart-exercise-weekly"></canvas></div>
                </div>
            </div>
            <div class="chart-box">
                <h3>Recent Sessions</h3>
                <div class="table-wrap" style="max-height:400px;overflow-y:auto">
                    <table>
                        <thead><tr><th>Date</th><th>Type</th><th>Title</th><th>Duration</th></tr></thead>
                        <tbody id="exercise-table"></tbody>
                    </table>
                </div>
            </div>
        `;

        // Types donut
        const typeColors = [COLORS.accent, COLORS.accent2, COLORS.green, COLORS.orange, COLORS.purple, COLORS.pink, COLORS.yellow, COLORS.red, COLORS.lightBlue];
        charts['exerciseTypes'] = new Chart(document.getElementById('chart-exercise-types'), {
            type: 'doughnut',
            data: {
                labels: sortedTypes.slice(0, 8).map(t => t[0]),
                datasets: [{
                    data: sortedTypes.slice(0, 8).map(t => t[1]),
                    backgroundColor: typeColors,
                    borderColor: '#1a1d27',
                    borderWidth: 3,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } }
            }
        });

        // Weekly aggregation
        const weeklyMap = new Map();
        data.forEach(d => {
            const dt = new Date(d.date);
            const weekStart = new Date(dt);
            weekStart.setDate(dt.getDate() - dt.getDay());
            const key = weekStart.toISOString().slice(0, 10);
            weeklyMap.set(key, (weeklyMap.get(key) || 0) + d.durationMin);
        });
        const weeks = [...weeklyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

        charts['exerciseWeekly'] = new Chart(document.getElementById('chart-exercise-weekly'), {
            type: 'bar',
            data: {
                labels: weeks.map(w => w[0]),
                datasets: [{
                    label: 'Minutes',
                    data: weeks.map(w => w[1]),
                    backgroundColor: COLORS.green + '80',
                    borderRadius: 3,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: 'week' } },
                    y: { title: { display: true, text: 'Minutes' }, beginAtZero: true }
                },
                plugins: { legend: { display: false } }
            }
        });

        // Table
        const tbody = document.getElementById('exercise-table');
        const recent = data.slice(-50).reverse();
        tbody.innerHTML = recent.map(d => `
            <tr>
                <td>${d.date}</td>
                <td><span class="pill green">${escHtml(d.exerciseType)}</span></td>
                <td>${escHtml(d.title)}</td>
                <td>${d.durationMin} min</td>
            </tr>
        `).join('');
    }

    // ─── Heart Rate ───
    async function loadHeartRate() {
        const data = await api('/api/heart-rate');
        const panel = document.getElementById('panel-heart');
        if (!data.length) { panel.innerHTML = '<div class="stat-card"><div class="label">No heart rate data</div></div>'; return; }

        const last30 = filterByDays(data, 30);
        const avgResting = last30.length ? Math.round(last30.reduce((s, d) => s + d.minBpm, 0) / last30.length) : '—';
        const avgHr = last30.length ? Math.round(last30.reduce((s, d) => s + d.avgBpm, 0) / last30.length) : '—';

        panel.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="label">Avg Resting HR (30d)</div>
                    <div class="value" style="color:var(--red)">${avgResting} bpm</div>
                </div>
                <div class="stat-card">
                    <div class="label">Avg Heart Rate (30d)</div>
                    <div class="value">${avgHr} bpm</div>
                </div>
                <div class="stat-card">
                    <div class="label">Days Tracked</div>
                    <div class="value">${data.length}</div>
                    <div class="sub">${data.reduce((s, d) => s + d.dataPoints, 0).toLocaleString()} data points</div>
                </div>
            </div>
            <div class="chart-box">
                <h3>Heart Rate — Daily Min / Avg / Max</h3>
                <div class="chart-wrap tall"><canvas id="chart-hr"></canvas></div>
            </div>
        `;

        const defaultDays = addTimeFilter(panel, (days) => renderHRChart(data, days));
        renderHRChart(data, defaultDays);
    }

    function renderHRChart(allData, days) {
        const data = filterByDays(allData, days);
        destroyChart('hr');
        charts['hr'] = new Chart(document.getElementById('chart-hr'), {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [
                    {
                        label: 'Max BPM',
                        data: data.map(d => d.maxBpm),
                        borderColor: COLORS.red + '90',
                        backgroundColor: COLORS.red + '10',
                        fill: '+1',
                        tension: 0.3,
                        pointRadius: 0,
                    },
                    {
                        label: 'Avg BPM',
                        data: data.map(d => d.avgBpm),
                        borderColor: COLORS.orange,
                        tension: 0.3,
                        pointRadius: 0,
                        borderWidth: 2,
                    },
                    {
                        label: 'Min BPM',
                        data: data.map(d => d.minBpm),
                        borderColor: COLORS.green + '90',
                        backgroundColor: COLORS.green + '10',
                        fill: '-1',
                        tension: 0.3,
                        pointRadius: 0,
                    },
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: days && days <= 90 ? 'day' : 'week' } },
                    y: { title: { display: true, text: 'BPM' } }
                }
            }
        });
    }

    // ─── Data Explorer ───
    async function loadExplorer() {
        const tables = await api('/api/tables');
        const panel = document.getElementById('panel-explorer');

        panel.innerHTML = `
            <div class="explorer-controls">
                <select id="table-select">
                    ${tables.map(t => `<option value="${escHtml(t.name)}">${escHtml(t.name)} (${t.rows.toLocaleString()} rows)</option>`).join('')}
                </select>
                <button id="table-load">Load</button>
                <button id="table-prev" disabled>&larr; Prev</button>
                <button id="table-next">Next &rarr;</button>
                <span class="info" id="table-info"></span>
            </div>
            <div class="chart-box">
                <div class="table-wrap" style="max-height:600px;overflow:auto">
                    <table>
                        <thead id="explorer-thead"><tr></tr></thead>
                        <tbody id="explorer-tbody"></tbody>
                    </table>
                </div>
            </div>
        `;

        let currentOffset = 0;
        const pageSize = 100;

        async function loadTable() {
            const name = document.getElementById('table-select').value;
            const result = await api(`/api/table/${encodeURIComponent(name)}?limit=${pageSize}&offset=${currentOffset}`);

            document.getElementById('table-info').textContent =
                `Showing ${currentOffset + 1}–${Math.min(currentOffset + pageSize, result.totalRows)} of ${result.totalRows.toLocaleString()} rows`;

            const thead = document.getElementById('explorer-thead');
            thead.innerHTML = '<tr>' + result.columns.map(c => `<th>${escHtml(c.name)}<br><small style="color:var(--text2)">${c.type}</small></th>`).join('') + '</tr>';

            const tbody = document.getElementById('explorer-tbody');
            tbody.innerHTML = result.rows.map(row =>
                '<tr>' + row.map(cell => `<td>${formatCell(cell)}</td>`).join('') + '</tr>'
            ).join('');

            document.getElementById('table-prev').disabled = currentOffset === 0;
            document.getElementById('table-next').disabled = currentOffset + pageSize >= result.totalRows;
        }

        document.getElementById('table-load').addEventListener('click', () => { currentOffset = 0; loadTable(); });
        document.getElementById('table-prev').addEventListener('click', () => { currentOffset = Math.max(0, currentOffset - pageSize); loadTable(); });
        document.getElementById('table-next').addEventListener('click', () => { currentOffset += pageSize; loadTable(); });
        document.getElementById('table-select').addEventListener('change', () => { currentOffset = 0; loadTable(); });

        // Auto-load first table
        loadTable();
    }

    // ─── Utils ───
    function escHtml(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatCell(val) {
        if (val == null) return '<span style="color:var(--text2)">null</span>';
        if (val instanceof Uint8Array || (typeof val === 'object' && val !== null)) return '<span style="color:var(--text2)">[binary]</span>';
        if (typeof val === 'number') {
            // Detect epoch milliseconds (> year 2000 in ms)
            if (val > 946684800000 && val < 2000000000000) {
                return `<span title="${val}">${new Date(val).toLocaleString()}</span>`;
            }
            return val.toLocaleString();
        }
        return escHtml(String(val));
    }

    // ─── Boot ───
    loadPanel('overview');
})();
