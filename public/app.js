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
        if (res.status === 400) {
            const data = await res.json();
            if (data.error === 'Database not loaded') {
                showUploadModal();
                throw new Error('Database not loaded');
            }
        }
        if (!res.ok) throw new Error(res.statusText);
        return await res.json();
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

    // ─── Time Math Helper (Circular Mean) ───
    function getAverageTimeOfDay(dateStrings) {
        if (!dateStrings || !dateStrings.length) return '—';
        let sumSin = 0;
        let sumCos = 0;

        for (const ds of dateStrings) {
            const d = new Date(ds);
            let hours = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
            // Convert hours to radians (24 hours = 2 * PI)
            let radians = (hours / 24) * 2 * Math.PI;
            sumSin += Math.sin(radians);
            sumCos += Math.cos(radians);
        }

        const avgSin = sumSin / dateStrings.length;
        const avgCos = sumCos / dateStrings.length;

        let avgRadians = Math.atan2(avgSin, avgCos);
        if (avgRadians < 0) avgRadians += 2 * Math.PI;

        let avgHours = (avgRadians / (2 * Math.PI)) * 24;

        const h = Math.floor(avgHours);
        const m = Math.round((avgHours - h) * 60);

        const d = new Date();
        d.setHours(h, m, 0);
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
                case 'blood-pressure': await loadBloodPressure(); break;
                case 'correlations': await loadCorrelations(); break;
                case 'goals': await loadGoals(); break;
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
        const [nutRes, bmrRes] = await Promise.all([
            api('/api/nutrition'),
            api('/api/bmr').catch(() => ([]))
        ]);
        const daily = nutRes.daily;
        const meals = nutRes.meals;
        const bmrMap = new Map(bmrRes.map(d => [d.date, d.bmr]));

        let activityFactor = parseFloat(localStorage.getItem('hc_activity_factor')) || 1.2;

        const panel = document.getElementById('panel-nutrition');
        if (!daily.length) { panel.innerHTML = '<div class="stat-card"><div class="label">No nutrition data</div></div>'; return; }

        panel.innerHTML = `
            <div id="nutrition-stats" class="stats-grid"></div>
            <div class="explorer-controls" style="margin-bottom:16px;text-align:right">
                <label style="font-size:14px;color:var(--text2)">Activity Factor (TDEE): 
                    <select id="activity-factor" style="margin-left:8px;padding:4px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:4px">
                        <option value="1.0">1.0 (BMR Only)</option>
                        <option value="1.2">1.2 (Sedentary)</option>
                        <option value="1.375">1.375 (Lightly Active)</option>
                        <option value="1.55">1.55 (Moderately Active)</option>
                        <option value="1.725">1.725 (Very Active)</option>
                        <option value="1.9">1.9 (Extremely Active)</option>
                    </select>
                </label>
            </div>
            <div class="chart-row">
                <div class="chart-box">
                    <h3>Energy Balance (Calories In vs Out)</h3>
                    <div class="chart-wrap tall"><canvas id="chart-calories"></canvas></div>
                </div>
            </div>
            <div class="chart-row two-col">
                <div class="chart-box">
                    <h3>Macronutrients</h3>
                    <div class="chart-wrap tall"><canvas id="chart-macros"></canvas></div>
                </div>
                <div class="chart-box">
                    <h3>Macro Split</h3>
                    <div class="chart-wrap"><canvas id="chart-macro-pie"></canvas></div>
                </div>
            </div>
            <div class="chart-row two-col">
                <div class="chart-box">
                    <h3>Day of Week Averages</h3>
                    <div class="chart-wrap tall"><canvas id="chart-nutrition-dow"></canvas></div>
                </div>
                <div class="chart-box">
                    <h3>Frequent Meals</h3>
                    <div id="frequent-meals-list" style="margin-top: 8px; max-height: 380px; overflow-y: auto; padding-right: 8px;"></div>
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

        document.getElementById('activity-factor').value = activityFactor;
        document.getElementById('activity-factor').addEventListener('change', (e) => {
            activityFactor = parseFloat(e.target.value);
            localStorage.setItem('hc_activity_factor', activityFactor);
            const activeFilter = document.querySelector('#panel-nutrition .time-filters .active');
            const days = parseInt(activeFilter ? activeFilter.dataset.days : 30) || 0;
            renderNutritionStats(daily, meals, days, bmrMap, activityFactor);
            renderNutritionCharts(daily, days, bmrMap, activityFactor);
        });

        const defaultDays = addTimeFilter(panel, (days) => {
            renderNutritionStats(daily, meals, days, bmrMap, activityFactor);
            renderNutritionCharts(daily, days, bmrMap, activityFactor);
        });
        renderNutritionStats(daily, meals, defaultDays, bmrMap, activityFactor);
        renderNutritionCharts(daily, defaultDays, bmrMap, activityFactor);

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

    function renderNutritionStats(allDaily, allMeals, days, bmrMap, af) {
        const daily = filterByDays(allDaily, days);
        const avg = (arr, key) => arr.length ? Math.round(arr.reduce((s, d) => s + d[key], 0) / arr.length) : 0;

        let validDays = 0;
        let totalBalance = 0;
        let totalTdee = 0;

        daily.forEach(d => {
            if (bmrMap.has(d.date)) {
                validDays++;
                const tdee = Math.round(bmrMap.get(d.date) * af);
                totalTdee += tdee;
                totalBalance += (d.kcal - tdee);
            }
        });

        const avgTdee = validDays ? Math.round(totalTdee / validDays) : 0;
        const avgBalance = validDays ? Math.round(totalBalance / validDays) : 0;
        const avgKcal = avg(daily, 'kcal');

        const labelSuffix = days ? `(${days}d)` : '(All Time)';

        document.getElementById('nutrition-stats').innerHTML = `
            <div class="stat-card">
                <div class="label">Avg Calories In ${labelSuffix}</div>
                <div class="value">${avgKcal.toLocaleString()}</div>
                <div class="sub">kcal/day</div>
            </div>
            <div class="stat-card">
                <div class="label">Avg TDEE ${labelSuffix}</div>
                <div class="value" style="color:var(--yellow)">${avgTdee.toLocaleString()}</div>
                <div class="sub">Activity Factor ${af}</div>
            </div>
            <div class="stat-card">
                <div class="label">Net Balance ${labelSuffix}</div>
                <div class="value" style="color:${avgBalance > 0 ? 'var(--orange)' : 'var(--green)'}">${avgBalance > 0 ? '+' : ''}${avgBalance.toLocaleString()}</div>
                <div class="sub">kcal/day</div>
            </div>
            <div class="stat-card">
                <div class="label">Avg Protein</div>
                <div class="value" style="color:var(--accent2)">${avg(daily, 'protein')}g</div>
            </div>
            <div class="stat-card">
                <div class="label">Avg Carbs</div>
                <div class="value" style="color:var(--orange)">${avg(daily, 'carbs')}g</div>
            </div>
            <div class="stat-card">
                <div class="label">Avg Fat</div>
                <div class="value" style="color:var(--pink)">${avg(daily, 'fat')}g</div>
            </div>
        `;

        const filteredMeals = filterByDays(allMeals, days, 'date');
        const mealCounts = {};
        filteredMeals.forEach(m => {
            if (!m.mealName || m.mealName === '(unnamed)') return;
            const key = m.mealName.trim();
            if (!mealCounts[key]) mealCounts[key] = { count: 0, kcal: Math.round(m.kcal) };
            mealCounts[key].count++;
        });

        const topMeals = Object.entries(mealCounts)
            .sort((a, b) => b[1].count - a[1].count || b[1].kcal - a[1].kcal)
            .slice(0, 10);

        document.getElementById('frequent-meals-list').innerHTML = topMeals.length ? topMeals.map(m => `
            <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border)">
                <span style="font-weight:600; font-size: 13px;">${escHtml(m[0])}</span>
                <span style="color:var(--text2); font-size: 13px;">${m[1].count}x &nbsp;<span class="pill blue" style="font-weight:normal; margin-left: 4px;">${m[1].kcal} kcal</span></span>
            </div>
        `).join('') : '<div style="color:var(--text2); padding: 12px 0;">Not enough data</div>';
    }

    function renderNutritionCharts(allDaily, days, bmrMap, af) {
        const daily = filterByDays(allDaily, days);

        // Calories chart (Grouped + Balance)
        destroyChart('calories');
        charts['calories'] = new Chart(document.getElementById('chart-calories'), {
            type: 'bar',
            data: {
                labels: daily.map(d => d.date),
                datasets: [
                    {
                        label: 'Calories In',
                        data: daily.map(d => d.kcal),
                        backgroundColor: COLORS.accent + '90',
                        borderColor: COLORS.accent,
                        borderWidth: 1,
                        borderRadius: 2,
                    },
                    {
                        label: 'Calories Out (TDEE)',
                        data: daily.map(d => bmrMap.has(d.date) ? Math.round(bmrMap.get(d.date) * af) : 0),
                        backgroundColor: COLORS.yellow + '90',
                        borderColor: COLORS.yellow,
                        borderWidth: 1,
                        borderRadius: 2,
                    },
                    {
                        label: 'Balance',
                        type: 'line',
                        data: daily.map(d => bmrMap.has(d.date) ? d.kcal - Math.round(bmrMap.get(d.date) * af) : 0),
                        borderColor: COLORS.red,
                        backgroundColor: COLORS.red,
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 2,
                        yAxisID: 'yBalance'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: days && days <= 90 ? 'day' : 'week' } },
                    y: { title: { display: true, text: 'kcal' }, beginAtZero: true, position: 'left' },
                    yBalance: { title: { display: true, text: 'Balance (kcal)' }, position: 'right', grid: { drawOnChartArea: false } }
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
                                return `${ctx.label}: ${ctx.parsed.toLocaleString()} g(${pct} %)`;
                            }
                        }
                    }
                }
            }
        });

        // Day-of-Week Averages
        const dowSums = [0, 0, 0, 0, 0, 0, 0];
        const dowCounts = [0, 0, 0, 0, 0, 0, 0];
        daily.forEach(d => {
            const dayIdx = new Date(d.date + 'T00:00:00').getDay();
            dowSums[dayIdx] += d.kcal;
            dowCounts[dayIdx]++;
        });
        const dowAvgs = dowSums.map((s, i) => dowCounts[i] ? Math.round(s / dowCounts[i]) : 0);

        destroyChart('nutritionDow');
        charts['nutritionDow'] = new Chart(document.getElementById('chart-nutrition-dow'), {
            type: 'bar',
            data: {
                labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                datasets: [{
                    label: 'Avg kcal',
                    data: dowAvgs,
                    backgroundColor: COLORS.accent + '80',
                    borderRadius: 3,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false }
                    },
                    y: { title: { display: true, text: 'kcal' }, beginAtZero: true }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // ─── Steps ───
    async function loadSteps() {
        const data = await api('/api/steps');
        const panel = document.getElementById('panel-steps');
        if (!data.length) { panel.innerHTML = '<div class="stat-card"><div class="label">No steps data</div></div>'; return; }

        const last30 = filterByDays(data, 30);
        // Stats now handled by renderStepsStats
        panel.innerHTML = `
            <div id="steps-stats" class="stats-grid"></div>
            <div class="chart-box">
                <h3>Daily Steps</h3>
                <div class="chart-wrap tall"><canvas id="chart-steps"></canvas></div>
            </div>
        `;

        const defaultDays = addTimeFilter(panel, (days) => {
            renderStepsStats(data, days);
            renderStepsChart(data, days);
        });
        renderStepsStats(data, defaultDays);
        renderStepsChart(data, defaultDays);
    }

    function renderStepsStats(allData, days) {
        const data = filterByDays(allData, days);
        const avg = data.length ? Math.round(data.reduce((s, d) => s + d.totalSteps, 0) / data.length) : 0;
        const maxDay = data.length ? data.reduce((best, d) => d.totalSteps > best.totalSteps ? d : best, data[0]) : { totalSteps: 0, date: '—' };
        const totalAll = data.reduce((s, d) => s + d.totalSteps, 0);

        const labelSuffix = days ? `(${days}d)` : '(All Time)';

        document.getElementById('steps-stats').innerHTML = `
            <div class="stat-card">
                <div class="label">Avg Daily Steps ${labelSuffix}</div>
                <div class="value">${avg.toLocaleString()}</div>
            </div>
            <div class="stat-card">
                <div class="label">Best Day ${labelSuffix}</div>
                <div class="value" style="color:var(--green)">${maxDay.totalSteps.toLocaleString()}</div>
                <div class="sub">${maxDay.date}</div>
            </div>
            <div class="stat-card">
                <div class="label">Total Steps ${labelSuffix}</div>
                <div class="value">${totalAll.toLocaleString()}</div>
                <div class="sub">${data.length} days tracked</div>
            </div>
        `;
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
        // Stats now handled by renderSleepStats
        panel.innerHTML = `
            <div id="sleep-stats" class="stats-grid"></div>
            <div class="chart-box" style="margin-bottom:16px">
                <h3>Sleep Duration</h3>
                <div class="chart-wrap tall"><canvas id="chart-sleep-duration"></canvas></div>
            </div>
            <div class="chart-row two-col" style="margin-bottom:16px">
                <div class="chart-box">
                    <h3>Bedtime Consistency</h3>
                    <div class="chart-wrap"><canvas id="chart-sleep-bedtime"></canvas></div>
                </div>
                <div class="chart-box">
                    <h3>Cumulative Sleep Debt</h3>
                    <div class="chart-wrap"><canvas id="chart-sleep-debt"></canvas></div>
                </div>
            </div>
            <div class="chart-box">
                <h3>Sleep Stages Breakdown</h3>
                <div class="chart-wrap tall"><canvas id="chart-sleep-stages"></canvas></div>
            </div>
        `;

        const defaultDays = addTimeFilter(panel, (days) => {
            renderSleepStats(data, days);
            renderSleepCharts(data, days);
        });
        renderSleepStats(data, defaultDays);
        renderSleepCharts(data, defaultDays);
    }

    function renderSleepStats(allData, days) {
        const data = filterByDays(allData, days);
        const avgDuration = data.length ? (data.reduce((s, d) => s + d.durationHrs, 0) / data.length).toFixed(1) : '—';
        const avgDeep = data.length ? Math.round(data.reduce((s, d) => s + d.deepMin, 0) / data.length) : 0;
        const avgRem = data.length ? Math.round(data.reduce((s, d) => s + d.remMin, 0) / data.length) : 0;
        const sleepDebt = data.reduce((s, d) => s + (8 - d.durationHrs), 0).toFixed(1);

        const bedtimes = data.map(d => d.startTime);
        const wakeups = data.map(d => d.endTime);
        const avgBedtime = getAverageTimeOfDay(bedtimes);
        const avgWakeup = getAverageTimeOfDay(wakeups);

        const labelSuffix = days ? `(${days}d)` : '(All Time)';

        document.getElementById('sleep-stats').innerHTML = `
            <div class="stat-card">
                <div class="label">Avg Sleep Duration ${labelSuffix}</div>
                <div class="value">${avgDuration} hrs</div>
            </div>
            <div class="stat-card">
                <div class="label">Avg Bedtime ${labelSuffix}</div>
                <div class="value" style="color:var(--accent)">${avgBedtime}</div>
            </div>
            <div class="stat-card">
                <div class="label">Avg Wake-up ${labelSuffix}</div>
                <div class="value" style="color:var(--orange)">${avgWakeup}</div>
            </div>
            <div class="stat-card">
                <div class="label">Sleep Debt ${labelSuffix}</div>
                <div class="value" style="color:${sleepDebt > 0 ? 'var(--red)' : 'var(--green)'}">${sleepDebt > 0 ? '+' : ''}${sleepDebt} hrs</div>
                <div class="sub">Compared to 8hr/night baseline</div>
            </div>
            <div class="stat-card">
                <div class="label">Avg Deep Sleep ${labelSuffix}</div>
                <div class="value" style="color:var(--purple)">${avgDeep} min</div>
            </div>
            <div class="stat-card">
                <div class="label">Avg REM Sleep ${labelSuffix}</div>
                <div class="value" style="color:var(--lightBlue)">${avgRem} min</div>
            </div>
        `;
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

        // Stages Architecture (Chronological Floating Bar)
        // Show only the most recent 14 days maximum to keep it legible
        const recentData = data.slice(-14);

        const deepData = [];
        const remData = [];
        const lightData = [];
        const awakeData = [];

        // Helper to normalize time to a single generic 24hr overlay day
        // so all nights align horizontally from PM to AM
        const normalizeTime = (timeStr) => {
            const d = new Date(timeStr);
            const hours = d.getHours();
            // Assign to Jan 1 if PM, Jan 2 if AM 
            const offsetDay = hours < 12 ? 2 : 1;
            return new Date(2000, 0, offsetDay, hours, d.getMinutes(), d.getSeconds()).getTime();
        };

        recentData.forEach(d => {
            if (d.stages && d.stages.length) {
                d.stages.forEach(s => {
                    const normStart = normalizeTime(s.startTime);
                    const normEnd = normalizeTime(s.endTime);
                    // Ensure end is strictly after start, else it might loop across the day divide strangely
                    let finalEnd = normEnd < normStart ? normEnd + 86400000 : normEnd;

                    const entry = { x: [normStart, finalEnd], y: d.date, rawStart: s.startTime, rawEnd: s.endTime };

                    if (s.stageType === 5) deepData.push(entry);
                    else if (s.stageType === 6) remData.push(entry);
                    else if (s.stageType === 4 || s.stageType === 2) lightData.push(entry);
                    else if (s.stageType === 1 || s.stageType === 3) awakeData.push(entry);
                });
            }
        });

        destroyChart('sleepStages');
        charts['sleepStages'] = new Chart(document.getElementById('chart-sleep-stages'), {
            type: 'bar',
            data: {
                datasets: [
                    { label: 'Deep', data: deepData, backgroundColor: COLORS.purple, borderRadius: 2 },
                    { label: 'REM', data: remData, backgroundColor: COLORS.accent, borderRadius: 2 },
                    { label: 'Light/Core', data: lightData, backgroundColor: COLORS.lightBlue + 'aa', borderRadius: 2 },
                    { label: 'Awake', data: awakeData, backgroundColor: COLORS.orange, borderRadius: 2 },
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'hour', tooltipFormat: 'HH:mm' },
                        title: { display: true, text: 'Time of Night' },
                        min: new Date(2000, 0, 1, 19, 0, 0).getTime(), // Start relative view at 7 PM
                        max: new Date(2000, 0, 2, 11, 0, 0).getTime(), // End at 11 AM
                    },
                    y: {
                        type: 'category',
                        labels: recentData.map(d => d.date)
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const startStr = new Date(ctx.raw.rawStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const endStr = new Date(ctx.raw.rawEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                return `${ctx.dataset.label}: ${startStr} - ${endStr}`;
                            }
                        }
                    }
                }
            }
        });


        // Bedtime consistency
        destroyChart('sleepBedtime');
        const rBedtimes = data.map(d => {
            const dt = new Date(d.startTime);
            let hrs = dt.getHours() + dt.getMinutes() / 60;
            // Shift past midnight forward so 1 AM == 25, for continuous scatter plotting
            if (hrs < 12) hrs += 24;
            return { x: d.date, y: hrs };
        });

        charts['sleepBedtime'] = new Chart(document.getElementById('chart-sleep-bedtime'), {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Bedtime',
                    data: rBedtimes,
                    backgroundColor: COLORS.accent,
                    pointRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: days && days <= 90 ? 'day' : 'week' } },
                    y: {
                        title: { display: true, text: 'Time of Day' },
                        ticks: {
                            callback: val => {
                                const h = Math.floor(val) % 24;
                                const m = Math.round((val - Math.floor(val)) * 60).toString().padStart(2, '0');
                                return `${h}:${m} `;
                            }
                        }
                    }
                }
            }
        });

        // Cumulative Sleep Debt
        destroyChart('sleepDebt');
        let cumDebt = 0;
        const debtData = data.map(d => {
            cumDebt += (8 - d.durationHrs);
            return cumDebt;
        });

        charts['sleepDebt'] = new Chart(document.getElementById('chart-sleep-debt'), {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [{
                    label: 'Cumulative Debt (hrs)',
                    data: debtData,
                    borderColor: COLORS.red,
                    backgroundColor: COLORS.red + '20',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: days && days <= 90 ? 'day' : 'week' } },
                    y: { title: { display: true, text: 'Debt (Hours)' } }
                }
            }
        });
    }

    // ─── Exercise ───
    function getExerciseStreakAndFrequency(data) {
        if (!data.length) return { streak: 0, perWeek: 0 };
        let maxStreak = 0;
        let currentStreak = 0;
        let lastDate = null;

        const uniqueDays = [...new Set(data.map(d => d.date))].sort();

        for (const dateStr of uniqueDays) {
            const d = new Date(dateStr);
            if (!lastDate) {
                currentStreak = 1;
                maxStreak = 1;
            } else {
                const diffTime = Math.abs(d - lastDate);
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    currentStreak++;
                    if (currentStreak > maxStreak) maxStreak = currentStreak;
                } else if (diffDays > 1) {
                    currentStreak = 1;
                }
            }
            lastDate = d;
        }

        const firstDay = new Date(uniqueDays[0]);
        const lastDayObj = new Date(uniqueDays[uniqueDays.length - 1]);
        const totalDaysSpan = Math.max(1, Math.round(Math.abs(lastDayObj - firstDay) / (1000 * 60 * 60 * 24))) + 1;
        const perWeek = ((data.length / totalDaysSpan) * 7).toFixed(1);

        return { streak: maxStreak, perWeek };
    }

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

        let currentExerciseType = 'All';

        panel.innerHTML = `
            <div class="explorer-controls" style="margin-bottom:16px;text-align:right">
                <label style="font-size:14px;color:var(--text2)">Exercise Type: 
                    <select id="exercise-type-filter" style="margin-left:8px;padding:4px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:4px">
                        <option value="All">All Types</option>
                        ${sortedTypes.map(t => `<option value="${t[0]}">${t[0]}</option>`).join('')}
                    </select>
                </label>
            </div>
            <div id="exercise-stats" class="stats-grid"></div>
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

        const typeColors = [COLORS.accent, COLORS.accent2, COLORS.green, COLORS.orange, COLORS.purple, COLORS.pink, COLORS.yellow, COLORS.red, COLORS.lightBlue];

        function filterExercise(allData, days, type) {
            let ft = filterByDays(allData, days);
            if (type !== 'All') ft = ft.filter(d => d.exerciseType === type);
            return ft;
        }

        function updateAll() {
            const activeFilter = document.querySelector('#panel-exercise .time-filter .active');
            const days = activeFilter ? parseInt(activeFilter.textContent.includes('All') ? 0 : activeFilter.textContent) : 90;
            // the filterByDays uses passed days, so we can just rely on the time filter. actually we can just pass the current active days.
            const dataFiltered = filterExercise(data, days, currentExerciseType);
            renderExerciseStats(dataFiltered, days ? days : 0);
            renderExerciseCharts(dataFiltered, days ? days : 0, typeColors);
        }

        document.getElementById('exercise-type-filter').addEventListener('change', (e) => {
            currentExerciseType = e.target.value;
            updateAll();
        });

        const defaultDays = addTimeFilter(panel, (days) => {
            const dataFiltered = filterExercise(data, days, currentExerciseType);
            renderExerciseStats(dataFiltered, days);
            renderExerciseCharts(dataFiltered, days, typeColors);
        });
        const dataFiltered = filterExercise(data, defaultDays, currentExerciseType);
        renderExerciseStats(dataFiltered, defaultDays);
        renderExerciseCharts(dataFiltered, defaultDays, typeColors);
    }

    function renderExerciseStats(data, days) {
        const typeCounts = {};
        data.forEach(d => {
            typeCounts[d.exerciseType] = (typeCounts[d.exerciseType] || 0) + 1;
        });
        const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

        const totalMin = data.reduce((s, d) => s + d.durationMin, 0);
        const insights = getExerciseStreakAndFrequency(data);

        const labelSuffix = days ? `(${days}d)` : '(All Time)';

        document.getElementById('exercise-stats').innerHTML = `
            <div class="stat-card">
                <div class="label">Total Sessions ${labelSuffix}</div>
                <div class="value">${data.length}</div>
            </div>
            <div class="stat-card">
                <div class="label">Exercise Time ${labelSuffix}</div>
                <div class="value">${Math.round(totalMin / 60)} hrs</div>
                <div class="sub">${totalMin.toLocaleString()} minutes</div>
            </div>
            <div class="stat-card">
                <div class="label">Workouts / Week</div>
                <div class="value" style="color:var(--accent2)">${insights.perWeek}</div>
            </div>
            <div class="stat-card">
                <div class="label">Longest Streak</div>
                <div class="value" style="color:var(--orange)">${insights.streak} days</div>
            </div>
            <div class="stat-card">
                <div class="label">Most Common ${labelSuffix}</div>
                <div class="value" style="font-size:20px">${sortedTypes[0]?.[0] || '—'}</div>
                <div class="sub">${sortedTypes[0]?.[1] || 0} sessions</div>
            </div>
        `;
    }

    function renderExerciseCharts(data, days, typeColors) {

        // Count by type using the filtered data
        const typeCounts = {};
        data.forEach(d => {
            typeCounts[d.exerciseType] = (typeCounts[d.exerciseType] || 0) + 1;
        });
        const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
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

        // Stats now handled by renderHRStats
        panel.innerHTML = `
            <div id="hr-stats" class="stats-grid"></div>
            <div class="chart-box">
                <h3>Heart Rate — Daily Min / Avg / Max</h3>
                <div class="chart-wrap tall"><canvas id="chart-hr"></canvas></div>
            </div>
        `;

        const defaultDays = addTimeFilter(panel, (days) => {
            renderHRStats(data, days);
            renderHRChart(data, days);
        });
        renderHRStats(data, defaultDays);
        renderHRChart(data, defaultDays);
    }

    function renderHRStats(allData, days) {
        const data = filterByDays(allData, days);
        const avgResting = data.length ? Math.round(data.reduce((s, d) => s + d.minBpm, 0) / data.length) : '—';
        const avgHr = data.length ? Math.round(data.reduce((s, d) => s + d.avgBpm, 0) / data.length) : '—';
        const totalPoints = data.reduce((s, d) => s + d.dataPoints, 0);

        const labelSuffix = days ? `(${days}d)` : '(All Time)';

        document.getElementById('hr-stats').innerHTML = `
            <div class="stat-card">
                <div class="label">Avg Resting HR ${labelSuffix}</div>
                <div class="value" style="color:var(--red)">${avgResting} bpm</div>
            </div>
            <div class="stat-card">
                <div class="label">Avg Heart Rate ${labelSuffix}</div>
                <div class="value">${avgHr} bpm</div>
            </div>
            <div class="stat-card">
                <div class="label">Days Tracked ${labelSuffix}</div>
                <div class="value">${data.length}</div>
                <div class="sub">${totalPoints.toLocaleString()} data points</div>
            </div>
        `;
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

    // ─── Blood Pressure ───
    async function loadBloodPressure() {
        const data = await api('/api/blood-pressure');
        const panel = document.getElementById('panel-blood-pressure');
        if (!data.length) { panel.innerHTML = '<div class="stat-card"><div class="label">No blood pressure data</div></div>'; return; }

        const last30 = filterByDays(data, 30);
        const avgSys = last30.length ? Math.round(last30.reduce((s, d) => s + d.systolic, 0) / last30.length) : '—';
        const avgDia = last30.length ? Math.round(last30.reduce((s, d) => s + d.diastolic, 0) / last30.length) : '—';
        const latest = data[data.length - 1];

        // Stats now handled by renderBPStats
        panel.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="label">Latest Reading</div>
                    <div class="value" style="color:var(--accent)">${latest.systolic} / ${latest.diastolic}</div>
                    <div class="sub">${latest.date}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Avg Systolic (30d)</div>
                    <div class="value">${avgSys} mmHg</div>
                </div>
                <div class="stat-card">
                    <div class="label">Avg Diastolic (30d)</div>
                    <div class="value">${avgDia} mmHg</div>
                </div>
                <div class="stat-card">
                    <div class="label">Total Readings</div>
                    <div class="value">${data.length}</div>
                </div>
            </div>
            <div class="chart-box">
                <h3>Blood Pressure Over Time</h3>
                <div class="chart-wrap tall"><canvas id="chart-bp"></canvas></div>
            </div>
        `;

        const defaultDays = addTimeFilter(panel, (days) => renderBPChart(data, days));
        renderBPChart(data, defaultDays);
    }

    function renderBPChart(allData, days) {
        const data = filterByDays(allData, days);
        destroyChart('bp');
        charts['bp'] = new Chart(document.getElementById('chart-bp'), {
            type: 'line',
            data: {
                labels: data.map(d => d.date),
                datasets: [
                    {
                        label: 'Systolic',
                        data: data.map(d => d.systolic),
                        borderColor: COLORS.orange,
                        backgroundColor: COLORS.orange + '20',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 3,
                    },
                    {
                        label: 'Diastolic',
                        data: data.map(d => d.diastolic),
                        borderColor: COLORS.lightBlue,
                        backgroundColor: COLORS.lightBlue + '20',
                        fill: false,
                        tension: 0.3,
                        pointRadius: 3,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: days && days <= 90 ? 'day' : 'week' } },
                    y: { title: { display: true, text: 'mmHg' } }
                }
            }
        });
    }

    // ─── Correlations ───
    const METRIC_DEFS = {
        weight: { url: '/api/weight', label: 'Weight (kg)', extract: d => d.weightKg },
        bodyFat: { url: '/api/body-fat', label: 'Body Fat (%)', extract: d => d.percentage },
        steps: { url: '/api/steps', label: 'Steps', extract: d => d.totalSteps },
        calories: { url: '/api/nutrition', label: 'Calories In (kcal)', extract: d => d.kcal, isDaily: true },
        balance: { custom: 'balance', label: 'Caloric Balance (kcal)' },
        sleep: { url: '/api/sleep', label: 'Sleep Duration (hrs)', extract: d => d.durationHrs },
        restHr: { url: '/api/heart-rate', label: 'Resting HR (bpm)', extract: d => d.minBpm },
    };

    function pearson(d1, d2) {
        let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0;
        const n = d1.length;
        if (n === 0) return 0;
        for (let i = 0; i < n; i++) {
            sum1 += d1[i]; sum2 += d2[i];
            sum1Sq += d1[i] ** 2; sum2Sq += d2[i] ** 2;
            pSum += d1[i] * d2[i];
        }
        const num = pSum - (sum1 * sum2 / n);
        const den = Math.sqrt((sum1Sq - sum1 ** 2 / n) * (sum2Sq - sum2 ** 2 / n));
        return den === 0 ? 0 : num / den;
    }

    async function loadCorrelations() {
        const panel = document.getElementById('panel-correlations');
        panel.innerHTML = `
            <div class="explorer-controls" style="margin-bottom:24px">
                <select id="corr-m1">
                    ${Object.entries(METRIC_DEFS).map(([k, v]) => `<option value="${k}" ${k === 'steps' ? 'selected' : ''}>${v.label}</option>`).join('')}
                </select>
                <span class="info">vs</span>
                <select id="corr-m2">
                    ${Object.entries(METRIC_DEFS).map(([k, v]) => `<option value="${k}" ${k === 'sleep' ? 'selected' : ''}>${v.label}</option>`).join('')}
                </select>
                <div id="corr-stat" class="pill blue" style="font-size:14px; margin-left:16px;">Pearson: —</div>
            </div>
            <div class="chart-box">
                <h3>Correlation Over Time</h3>
                <div class="chart-wrap tall"><canvas id="chart-corr"></canvas></div>
            </div>
            <div class="chart-box" style="margin-top:16px">
                <h3>Scatter Plot</h3>
                <div class="chart-wrap tall"><canvas id="chart-corr-scatter"></canvas></div>
            </div>
        `;

        async function fetchMetricData(def) {
            if (def.custom === 'balance') {
                const [nutRes, bmrRes] = await Promise.all([
                    api('/api/nutrition'),
                    api('/api/bmr').catch(() => ([]))
                ]);
                const bmrMap = new Map(bmrRes.map(d => [d.date, d.bmr]));
                const af = parseFloat(localStorage.getItem('hc_activity_factor')) || 1.2;

                return nutRes.daily.map(d => {
                    const balance = bmrMap.has(d.date) ? d.kcal - Math.round(bmrMap.get(d.date) * af) : null;
                    return { date: d.date, val: balance };
                }).filter(d => d.val !== null);
            } else {
                let res = await api(def.url);
                if (def.isDaily) res = res.daily;
                return res.map(d => ({ date: d.date, val: def.extract(d) }));
            }
        }

        async function updateCorr() {
            const m1Key = document.getElementById('corr-m1').value;
            const m2Key = document.getElementById('corr-m2').value;
            const def1 = METRIC_DEFS[m1Key];
            const def2 = METRIC_DEFS[m2Key];

            const row1 = await fetchMetricData(def1);
            const row2 = await fetchMetricData(def2);

            const map1 = new Map(row1.map(d => [d.date, d.val]));
            const map2 = new Map(row2.map(d => [d.date, d.val]));

            // Find overlapping dates
            const dates = Array.from(new Set([...map1.keys(), ...map2.keys()])).sort();
            const overlap = dates.filter(d => map1.has(d) && map2.has(d));

            const val1 = overlap.map(d => map1.get(d));
            const val2 = overlap.map(d => map2.get(d));

            const p = pearson(val1, val2);
            document.getElementById('corr-stat').textContent = `Pearson: ${p.toFixed(2)} `;

            destroyChart('corrLine');
            charts['corrLine'] = new Chart(document.getElementById('chart-corr'), {
                type: 'line',
                data: {
                    labels: overlap,
                    datasets: [
                        { label: def1.label, data: val1, borderColor: COLORS.accent, yAxisID: 'y1', tension: 0.3, pointRadius: 2 },
                        { label: def2.label, data: val2, borderColor: COLORS.orange, yAxisID: 'y2', tension: 0.3, pointRadius: 2 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { type: 'time', time: { unit: 'day' } },
                        y1: { type: 'linear', position: 'left', title: { display: true, text: def1.label } },
                        y2: { type: 'linear', position: 'right', title: { display: true, text: def2.label }, grid: { drawOnChartArea: false } }
                    }
                }
            });

            destroyChart('corrScatter');
            charts['corrScatter'] = new Chart(document.getElementById('chart-corr-scatter'), {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Days',
                        data: overlap.map((d, i) => ({ x: val1[i], y: val2[i], date: d })),
                        backgroundColor: COLORS.pink,
                        pointRadius: 4,
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { title: { display: true, text: def1.label } },
                        y: { title: { display: true, text: def2.label } }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: ctx => `${ctx.raw.date}: ${ctx.parsed.x}, ${ctx.parsed.y} `
                            }
                        }
                    }
                }
            });
        }

        document.getElementById('corr-m1').addEventListener('change', updateCorr);
        document.getElementById('corr-m2').addEventListener('change', updateCorr);
        updateCorr();
    }

    // ─── Goals ───
    async function loadGoals() {
        const panel = document.getElementById('panel-goals');
        const goals = JSON.parse(localStorage.getItem('hc_goals') || '{"steps": 10000, "sleep": 8, "calories": 2500}');

        panel.innerHTML = `
            <div class="chart-box" style="margin-bottom:24px">
                <h3>Set Daily Targets</h3>
                <div class="explorer-controls">
                    <label>Steps: <input type="number" id="goal-steps" value="${goals.steps}" style="width:80px;"></label>
                    <label>Sleep (hrs): <input type="number" id="goal-sleep" value="${goals.sleep}" style="width:60px;"></label>
                    <label>Calories: <input type="number" id="goal-calories" value="${goals.calories}" style="width:80px;"></label>
                    <button id="save-goals" class="pill blue">Save Goals</button>
                </div>
            </div>
            <div id="goals-content"><div class="loading">Calculating...</div></div>
        `;

        document.getElementById('save-goals').addEventListener('click', () => {
            goals.steps = parseInt(document.getElementById('goal-steps').value) || 10000;
            goals.sleep = parseFloat(document.getElementById('goal-sleep').value) || 8;
            goals.calories = parseInt(document.getElementById('goal-calories').value) || 2500;
            localStorage.setItem('hc_goals', JSON.stringify(goals));
            renderGoals(goals);
        });

        async function renderGoals(g) {
            const content = document.getElementById('goals-content');
            try {
                const [stepsRes, sleepRes, nutRes] = await Promise.all([
                    api('/api/steps'), api('/api/sleep'), api('/api/nutrition')
                ]);

                const stepsLast30 = filterByDays(stepsRes, 30);
                const sleepLast30 = filterByDays(sleepRes, 30);
                const nutLast30 = filterByDays(nutRes.daily, 30);

                const hitCount = (arr, extractor, target, isMax = false) => {
                    return arr.reduce((count, d) => count + ((isMax ? extractor(d) <= target : extractor(d) >= target) ? 1 : 0), 0);
                };

                const stepsHit = hitCount(stepsLast30, d => d.totalSteps, g.steps);
                const sleepHit = hitCount(sleepLast30, d => d.durationHrs, g.sleep);
                const calHit = hitCount(nutLast30, d => d.kcal, g.calories, true); // calories usually have a max limit

                content.innerHTML = `
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="label">Steps Goal (${g.steps.toLocaleString()})</div>
                            <div class="value" style="color:var(--green)">${stepsHit} / 30</div>
                            <div class="sub">Days Hit in Last Month</div>
                        </div>
                        <div class="stat-card">
                            <div class="label">Sleep Goal (${g.sleep} hrs)</div>
                            <div class="value" style="color:var(--purple)">${sleepHit} / 30</div>
                            <div class="sub">Days Hit in Last Month</div>
                        </div>
                        <div class="stat-card">
                            <div class="label">Calorie Goal (< ${g.calories})</div>
                            <div class="value" style="color:var(--orange)">${calHit} / 30</div>
                            <div class="sub">Days Under Target in Last Month</div>
                        </div>
            </div>
            `;
            } catch (err) {
                content.innerHTML = `<div class="stat-card"><div class="label">Error</div><div class="sub">${err.message}</div></div>`;
            }
        }
        renderGoals(goals);
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
        if (val === null) return `<span style="color:var(--text2)">NULL</span>`;
        if (typeof val === 'number') {
            if (val > 1e12 && val < 2e12) { // Looks like a timestamp
                return `<span class="pill blue">${escHtml(val + '')}</span> <span style="font-size:11px;color:var(--text2)">${new Date(val).toISOString()}</span>`;
            }
            return `<span style="color:var(--orange)">${val}</span>`;
        }
        return escHtml(val + '');
    }

    // ─── db Upload Logic ───
    const uploadOverlay = document.getElementById('upload-overlay');
    const fileInput = document.getElementById('dbFileInput');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const submitBtn = document.getElementById('submitBtn');
    const fileLabel = document.getElementById('fileLabel');
    const uploadError = document.getElementById('uploadError');

    function showUploadModal() {
        uploadOverlay.classList.add('active');
        fileInput.value = '';
        fileNameDisplay.textContent = '';
        submitBtn.style.display = 'none';
        uploadError.style.display = 'none';
    }

    function hideUploadModal() {
        uploadOverlay.classList.remove('active');
    }

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            submitBtn.style.display = 'inline-block';
            fileLabel.textContent = 'Change DB File';
            uploadError.style.display = 'none';
        } else {
            fileNameDisplay.textContent = '';
            submitBtn.style.display = 'none';
            fileLabel.textContent = 'Choose DB File';
        }
    });

    submitBtn.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading & Loading...';
        uploadError.style.display = 'none';

        const formData = new FormData();
        formData.append('database', file);

        try {
            const res = await fetch('/api/database', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Upload failed');
            }

            // Success loading DB, hide modal and reload data on current active panel
            hideUploadModal();
            const activePanelBtn = document.querySelector('.nav button.active');
            if (activePanelBtn) {
                // Remove the error UI and reset loading state inside panels
                document.querySelectorAll('.panel').forEach(p => {
                    p.innerHTML = `<div class="loading">Loading...</div>`;
                });
                loadPanel(activePanelBtn.dataset.panel);
            }
        } catch (err) {
            uploadError.textContent = err.message;
            uploadError.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Load Database';
        }
    });

    // ─── Boot ───
    loadPanel('overview');
})();
