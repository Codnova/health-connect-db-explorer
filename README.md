# Health Connect Explorer

A local web dashboard for visualizing and exploring data exported from [Google Health Connect](https://health.google/health-connect/). Reads the SQLite backup file directly — no data leaves your machine.

## Features

- **Overview** — summary cards with record counts, date ranges, and connected apps
- **Weight** — trend line with total change and min/max range
- **Nutrition** — Energy Balance Gantt chart (Calories In vs. TDEE Out) with adjustable Activity Factor, macronutrient breakdown (protein/carbs/fat), macro split donut, and a searchable meals table
- **Steps** — daily bar chart color-coded by activity level (green 10k+, orange 5k+, red below)
- **Sleep** — duration bars, chronological floating bar chart for sleep-stage architecture (deep, REM, light, awake), and average stats
- **Exercise** — sessions-by-type donut, weekly exercise minutes, and session history table with synced Sets and Reps (from `exercise_segments_table`)
- **Heart Rate** — daily min/avg/max band chart from Samsung Health series data
- **Data Explorer** — raw table browser with pagination for all 71 tables in the database

Every chart panel includes a time-range filter (30 days, 90 days, 6 months, 1 year, all time) that dynamically updates both the charts and the summary statistics.

## Prerequisites

- **Node.js** 18+
- A Health Connect SQLite export file (`.db`)

### Exporting from Health Connect

1. Open **Health Connect** on your Android device (Settings > Health Connect, or the standalone app)
2. Tap **Export all data**
3. Transfer the `.db` file to your computer

## Quick Start

```bash
# Clone or copy the project
cd hc-explorer

# Install dependencies
npm install

# Run the server
npm start
```

Open [http://localhost:3500](http://localhost:3500) in your browser. The app will prompt you to upload your `.db` file directly through the UI.

## Configuration

| Variable         | Default                            | Description                                                        |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `PORT`           | `3500`                             | Server port                                                        |
| `HOST`           | `127.0.0.1`                        | Bind address. Defaults to localhost-only for privacy/safety.       |
| `HC_ADMIN_TOKEN` | _(empty)_                          | Optional token for upload/data-explorer endpoints (`x-admin-token`) |

Example with a custom port:

```bash
PORT=4000 npm start
```

## Project Structure

```
hc-explorer/
├── server.js          # Express server + SQLite API endpoints
├── public/
│   ├── index.html     # Dashboard shell (dark theme)
│   └── app.js         # Frontend: Chart.js charts, navigation, data explorer
├── package.json
└── README.md
```

## API Endpoints

All endpoints return JSON.

| Endpoint              | Description                                      |
| --------------------- | ------------------------------------------------ |
| `POST /api/database`  | Upload and load a `.db` file (local/admin protected) |
| `GET /api/overview`   | Summary stats for all data types                 |
| `GET /api/weight`     | Weight records (date, kg)                        |
| `GET /api/nutrition`  | Daily calorie/macro aggregates + individual meals|
| `GET /api/bmr`        | Basal Metabolic Rate records converted to kcal/day |
| `GET /api/steps`      | Daily step totals                                |
| `GET /api/sleep`      | Sleep sessions with precise stage breakdown      |
| `GET /api/exercise`   | Exercise sessions with type, duration, title     |
| `GET /api/heart-rate` | Daily heart rate min/avg/max                     |
| `GET /api/spo2`       | Blood oxygen saturation records                  |
| `GET /api/body-fat`   | Body fat percentage records                      |
| `GET /api/tables`     | List all non-empty tables in the database        |
| `GET /api/table/:name`| Paginated raw table data (`?limit=100&offset=0`) |

## Database Schema

The Health Connect export is a standard SQLite 3 database. All record tables share a set of common metadata columns, plus record-specific data columns. Every table is browsable in the Data Explorer tab.

### Common Columns

Most record tables include these columns:

| Column                 | Type    | Description                                              |
| ---------------------- | ------- | -------------------------------------------------------- |
| `row_id`               | INTEGER | Primary key (auto-increment)                             |
| `uuid`                 | BLOB    | Unique record identifier                                 |
| `last_modified_time`   | INTEGER | Last modification timestamp (epoch ms)                   |
| `client_record_id`     | TEXT    | ID assigned by the source app                            |
| `client_record_version`| TEXT    | Version string from the source app                       |
| `device_info_id`       | INTEGER | FK to `device_info_table`                                |
| `app_info_id`          | INTEGER | FK to `application_info_table`                           |
| `recording_method`     | INTEGER | How the data was recorded (manual, automatic, etc.)      |
| `dedupe_hash`          | BLOB    | Deduplication hash                                       |

**Interval records** (nutrition, steps, sleep, exercise, etc.) add:

| Column              | Type    | Description                                    |
| -------------------- | ------- | ---------------------------------------------- |
| `start_time`         | INTEGER | Start timestamp (epoch ms)                     |
| `start_zone_offset`  | INTEGER | UTC offset at start time (seconds, e.g. -10800 = UTC-3) |
| `end_time`           | INTEGER | End timestamp (epoch ms)                       |
| `end_zone_offset`    | INTEGER | UTC offset at end time (seconds)               |
| `local_date`         | INTEGER | Local date as epoch days                       |

**Instant records** (weight, body fat, SpO2, blood pressure, etc.) add:

| Column        | Type    | Description                                          |
| ------------- | ------- | ---------------------------------------------------- |
| `time`        | INTEGER | Measurement timestamp (epoch ms)                     |
| `zone_offset` | INTEGER | UTC offset (seconds)                                 |
| `local_date`  | INTEGER | Local date as epoch days                             |

### Health Record Tables

#### `nutrition_record_table`

Meals logged from MacroFactor or other nutrition apps.

| Column               | Type | Unit / Notes                                     |
| -------------------- | ---- | ------------------------------------------------ |
| `meal_type`          | INT  | 0=Unknown, 1=Breakfast, 2=Lunch, 3=Dinner, 4=Snack |
| `meal_name`          | TEXT | e.g. "Chicken Breast", "Pisco Sour"              |
| `energy`             | REAL | Calories (divide by 1000 for kcal)               |
| `protein`            | REAL | Grams                                            |
| `total_carbohydrate` | REAL | Grams                                            |
| `total_fat`          | REAL | Grams                                            |
| `saturated_fat`      | REAL | Grams                                            |
| `unsaturated_fat`    | REAL | Grams                                            |
| `monounsaturated_fat`| REAL | Grams                                            |
| `polyunsaturated_fat`| REAL | Grams                                            |
| `trans_fat`          | REAL | Grams                                            |
| `sugar`              | REAL | Grams                                            |
| `dietary_fiber`      | REAL | Grams                                            |
| `cholesterol`        | REAL | Grams                                            |
| `sodium`             | REAL | Grams                                            |
| `energy_from_fat`    | REAL | Calories (divide by 1000 for kcal)               |
| `caffeine`           | REAL | Grams                                            |
| `calcium`            | REAL | Grams                                            |
| `iron`               | REAL | Grams                                            |
| `potassium`          | REAL | Grams                                            |
| `magnesium`          | REAL | Grams                                            |
| `phosphorus`         | REAL | Grams                                            |
| `zinc`               | REAL | Grams                                            |
| `copper`             | REAL | Grams                                            |
| `manganese`          | REAL | Grams                                            |
| `selenium`           | REAL | Grams                                            |
| `chromium`           | REAL | Grams                                            |
| `molybdenum`         | REAL | Grams                                            |
| `iodine`             | REAL | Grams                                            |
| `chloride`           | REAL | Grams                                            |
| `vitamin_a`          | REAL | Grams                                            |
| `vitamin_c`          | REAL | Grams                                            |
| `vitamin_d`          | REAL | Grams                                            |
| `vitamin_e`          | REAL | Grams                                            |
| `vitamin_k`          | REAL | Grams                                            |
| `vitamin_b6`         | REAL | Grams                                            |
| `vitamin_b12`        | REAL | Grams                                            |
| `thiamin`            | REAL | Grams (Vitamin B1)                               |
| `riboflavin`         | REAL | Grams (Vitamin B2)                               |
| `niacin`             | REAL | Grams (Vitamin B3)                               |
| `pantothenic_acid`   | REAL | Grams (Vitamin B5)                               |
| `biotin`             | REAL | Grams (Vitamin B7)                               |
| `folate`             | REAL | Grams (Vitamin B9)                               |
| `folic_acid`         | REAL | Grams                                            |

> `5e-324` is used as a sentinel for "not recorded" — the dashboard treats these as zero.

#### `weight_record_table`

| Column   | Type | Unit / Notes      |
| -------- | ---- | ----------------- |
| `weight` | REAL | Grams (divide by 1000 for kg) |

#### `steps_record_table`

| Column  | Type | Unit / Notes              |
| ------- | ---- | ------------------------- |
| `count` | INT  | Total steps in the interval |

#### `sleep_session_record_table`

| Column  | Type | Notes                   |
| ------- | ---- | ----------------------- |
| `title` | TEXT | Optional session label  |
| `notes` | TEXT | Optional user notes     |

#### `sleep_stages_table`

Child rows linked to sleep sessions via `parent_key` → `sleep_session_record_table.row_id`.

| Column             | Type | Notes                                                      |
| ------------------ | ---- | ---------------------------------------------------------- |
| `parent_key`       | INT  | FK to `sleep_session_record_table.row_id`                  |
| `stage_start_time` | INT  | Epoch ms                                                   |
| `stage_end_time`   | INT  | Epoch ms                                                   |
| `stage_type`       | INT  | 0=Unknown, 1=Awake, 2=Sleeping, 3=Out of Bed, 4=Light, 5=Deep, 6=REM |

#### `exercise_session_record_table`

| Column                        | Type | Notes                                         |
| ----------------------------- | ---- | --------------------------------------------- |
| `exercise_type`               | INT  | See exercise type mapping below                |
| `title`                       | TEXT | User-assigned workout name (e.g. "Workout B") |
| `notes`                       | TEXT | Optional notes                                |
| `has_route`                   | INT  | 1 if GPS route is attached                    |
| `planned_exercise_session_id` | BLOB | Link to a planned session, if any             |

#### `exercise_segments_table`

Child rows linked via `parent_key` → `exercise_session_record_table.row_id`.

| Column              | Type | Notes                                |
| ------------------- | ---- | ------------------------------------ |
| `parent_key`        | INT  | FK to exercise session               |
| `segment_start_time`| INT  | Epoch ms                             |
| `segment_end_time`  | INT  | Epoch ms                             |
| `segment_type`      | INT  | Segment/exercise type ID             |
| `repetitions_count` | INT  | Number of reps (0 if not applicable) |

#### `heart_rate_record_table`

Session-level metadata. Each session has many child rows in the series table.

_(Uses common interval columns only — no additional data columns.)_

#### `heart_rate_record_series_table`

Individual BPM readings linked via `parent_key` → `heart_rate_record_table.row_id`.

| Column             | Type | Notes               |
| ------------------ | ---- | ------------------- |
| `parent_key`       | INT  | FK to heart rate record |
| `beats_per_minute` | INT  | BPM value           |
| `epoch_millis`     | INT  | Measurement timestamp (epoch ms) |

#### `oxygen_saturation_record_table`

| Column       | Type | Notes                          |
| ------------ | ---- | ------------------------------ |
| `percentage` | REAL | SpO2 percentage (e.g. 97.0)   |

#### `body_fat_record_table`

| Column       | Type | Notes                         |
| ------------ | ---- | ----------------------------- |
| `percentage` | REAL | Body fat percentage           |

#### `blood_pressure_record_table`

| Column                 | Type | Notes                       |
| ---------------------- | ---- | --------------------------- |
| `systolic`             | REAL | mmHg                        |
| `diastolic`            | REAL | mmHg                        |
| `measurement_location` | TEXT | e.g. "left_wrist"           |
| `body_position`        | TEXT | e.g. "sitting"              |

#### `total_calories_burned_record_table`

| Column   | Type | Notes                              |
| -------- | ---- | ---------------------------------- |
| `energy` | REAL | Calories (divide by 1000 for kcal) |

#### `distance_record_table`

| Column     | Type | Notes                              |
| ---------- | ---- | ---------------------------------- |
| `distance` | REAL | Meters                             |

#### `SpeedRecordTable` / `speed_record_table`

`SpeedRecordTable` holds session metadata (common interval columns). `speed_record_table` holds child series data:

| Column        | Type | Notes                    |
| ------------- | ---- | ------------------------ |
| `parent_key`  | INT  | FK to SpeedRecordTable   |
| `speed`       | REAL | Meters per second        |
| `epoch_millis`| INT  | Measurement timestamp    |

#### `height_record_table`

| Column   | Type | Notes                              |
| -------- | ---- | ---------------------------------- |
| `height` | REAL | Meters                             |

#### `basal_metabolic_rate_record_table`

| Column               | Type | Notes                         |
| -------------------- | ---- | ----------------------------- |
| `basal_metabolic_rate` | REAL | Watts (1 W ≈ 20.64 kcal/day) |

#### `vo2_max_record_table`

| Column                                  | Type | Notes                     |
| --------------------------------------- | ---- | ------------------------- |
| `measurement_method`                    | INT  | How VO2max was estimated  |
| `vo2_milliliters_per_minute_kilogram`   | REAL | mL/min/kg                 |

### Metadata Tables

#### `application_info_table`

| Column              | Type | Notes                                   |
| ------------------- | ---- | --------------------------------------- |
| `package_name`      | TEXT | Android package (e.g. `com.sbs.diet`)   |
| `app_name`          | TEXT | Display name (e.g. "MacroFactor")       |
| `app_icon`          | BLOB | App icon image                          |
| `record_types_used` | TEXT | Comma-separated list of record types    |

#### `device_info_table`

| Column        | Type | Notes                         |
| ------------- | ---- | ----------------------------- |
| `manufacturer`| TEXT | e.g. "samsung"                |
| `model`       | TEXT | e.g. "SM-S928B"               |
| `device_type` | INT  | Device type identifier        |

#### `activity_date_table`

Tracks which dates have data for which record types.

| Column          | Type | Notes                        |
| --------------- | ---- | ---------------------------- |
| `epoch_days`    | INT  | Days since Unix epoch        |
| `record_type_id`| INT  | Record type identifier       |

#### `read_access_logs_table`

Audit log of which apps read which data.

| Column          | Type | Notes                              |
| --------------- | ---- | ---------------------------------- |
| `reader_app_id` | INT  | FK to application_info_table       |
| `writer_app_id` | INT  | FK to application_info_table       |
| `record_type`   | TEXT | e.g. "StepsRecord"                 |
| `read_time`     | INT  | When the read occurred (epoch ms)  |
| `write_time`    | INT  | When the record was written (epoch ms) |

### Exercise Type IDs

Note: The SQLite database export uses an internal integer mapping system that differs from the public Android 14 Health Connect SDK constants.

| ID | Type                    | ID | Type                 | ID | Type              |
| -- | ----------------------- | -- | -------------------- | -- | ----------------- |
| 0  | Unknown                 | 24 | HIIT                 | 44 | Skiing            |
| 2  | Badminton               | 25 | Hiking               | 45 | Snowboarding      |
| 4  | Baseball                | 26 | Ice Hockey           | 46 | Snowshoeing       |
| 5  | Basketball              | 27 | Ice Skating          | 47 | Soccer            |
| 8  | Biking                  | 29 | Martial Arts         | 48 | Softball          |
| 10 | Boxing                  | 31 | Paddling             | 49 | Squash            |
| 11 | Calisthenics            | 32 | Paragliding          | 50 | Stair Climbing    |
| 13 | Cricket                 | 33 | Pilates              | 51 | Strength Training |
| 14 | Dancing                 | 34 | Racquetball          | 52 | Stretching        |
| 16 | Fencing                 | 35 | Rock Climbing        | 53 | Walking           |
| 17 | Football (American)     | 36 | Roller Hockey        | 54 | Surfing           |
| 18 | Football (Australian)   | 37 | Rowing               | 55 | Swimming (Open Water)|
| 20 | Golf                    | 38 | Rugby                | 56 | Swimming (Pool)   |
| 22 | Gymnastics              | 39 | Running              | 57 | Table Tennis      |
| 23 | Handball                | 40 | Sailing              | 58 | Weight Training   |
| 42 | Scuba Diving            | 43 | Skating              | 59 | Volleyball        |
| 60 | Wakeboarding            | 61 | Water Polo           | 62 | Wheelchair        |
| 63 | Yoga                    |    |                      |    |                   |

### Sleep Stage Type IDs

| ID | Stage       |
| -- | ----------- |
| 0  | Unknown     |
| 1  | Awake       |
| 2  | Sleeping    |
| 3  | Out of Bed  |
| 4  | Light Sleep |
| 5  | Deep Sleep  |
| 6  | REM         |

### Meal Type IDs

| ID | Type      |
| -- | --------- |
| 0  | Unknown   |
| 1  | Breakfast |
| 2  | Lunch     |
| 3  | Dinner    |
| 4  | Snack     |

## Tech Stack

- **Backend** — [Express](https://expressjs.com/) + [sql.js](https://sql.js.org/) (SQLite compiled to WASM, no native dependencies)
- **Frontend** — Vanilla JS + [Chart.js](https://www.chartjs.org/) (loaded from CDN)
- **Theme** — Dark mode

## Notes

- The database is loaded into memory at startup via sql.js. This works well for typical Health Connect exports (tens of MB). For very large files, startup may take a few seconds.
- All timestamps in the database are epoch milliseconds. The dashboard converts them to local dates using the zone offset stored alongside each record.
- Sleep session/stage clock times are rendered in the browser timezone.
- Energy values in the database are in Calories; the dashboard divides by 1000 to convert to kilocalories (kcal).
- Weight values in the database are in grams; the dashboard converts to kilograms (kg).
- The `5e-324` values found in some nutrition fields are Health Connect's sentinel for "not recorded" and are treated as zero.
- Sensitive endpoints (`/api/database`, `/api/tables`, `/api/table/:name`) are restricted to loopback clients; if `HC_ADMIN_TOKEN` is set, they also require `x-admin-token`.
