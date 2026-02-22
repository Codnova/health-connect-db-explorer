const fs = require('fs');
const sqlJsInit = require('./node_modules/sql.js');
sqlJsInit().then(SQL => {
    const db = new SQL.Database(fs.readFileSync('C:/Users/Eduar/Dev/health_connect_export.db'));
    const result = {
        bmr: db.exec('PRAGMA table_info(basal_metabolic_rate_record_table)')[0]?.values,
        bmrSample: db.exec('SELECT * FROM basal_metabolic_rate_record_table LIMIT 1')[0]?.values,
        sleepStage: db.exec('PRAGMA table_info(sleep_stages_table)')[0]?.values,
        sleepStageSample: db.exec('SELECT * FROM sleep_stages_table LIMIT 1')[0]?.values,
        activeCalories: db.exec('PRAGMA table_info(active_calories_burned_record_table)')[0]?.values,
        activeCaloriesSample: db.exec('SELECT * FROM active_calories_burned_record_table LIMIT 1')[0]?.values
    };
    fs.writeFileSync('C:/Users/Eduar/Dev/health-connect-db-explorer/schema_info.json', JSON.stringify(result, null, 2));
});
