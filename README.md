# 🛰️ LiDAR Data Processor

A full-stack application for processing, analyzing, and visualizing LiDAR (Light Detection and Ranging) point cloud data. Upload raw CSV point clouds, and the system partitions them into a spatial grid, computes per-cell statistics including elevation, canopy height, land classification, and environmental risk assessment — then visualizes everything on an interactive canvas heatmap.

---

## ✨ Features

- **CSV Point Cloud Ingestion** — Upload `.csv` files with `x, y, z, type` columns; automatic header detection and malformed-line skipping.
- **Configurable Spatial Grid Partitioning** — Points are bucketed into grid cells at a user-defined resolution (default 1 m).
- **Per-Cell Statistical Aggregation** — Min/max/avg elevation, canopy height, point density, and classification breakdown (Ground, Vegetation, Building, Rock).
- **Environmental Risk Assessment** — Each cell is tagged as `NORMAL`, `FIRE_RISK`, `LANDSLIDE_RISK`, or `URBAN_ZONE` based on vegetation density, canopy height, and built-area percentage.
- **Connected-Component Risk Zone Detection** — BFS flood-fill groups adjacent cells with the same risk level into distinct risk zones, reporting zone counts per category.
- **CSV Export** — Processed grid is exported as a 15-column CSV for downstream analysis.
- **Interactive React Frontend** — Canvas-rendered heatmap with Risk / Type view toggle, zoom controls, coordinate labels, hover tooltips, and a color-coded legend.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React Frontend (Vite)                 │
│  UploadForm → SummaryPanel + HeatmapGrid (Canvas)       │
└────────────────────────┬────────────────────────────────┘
                         │  REST API (axios)
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Spring Boot Backend (Java 21)               │
│                                                         │
│  LidarController                                        │
│    ├── PointCloudReader   — CSV → Stream<Point>         │
│    ├── DataValidator      — NaN / ∞ / bounds filtering  │
│    ├── GridPartitioner    — (x,y) → GridCoordinate      │
│    ├── GridAggregator     — Stream → Map<Coord, Cell>   │
│    ├── StatisticsSummarizer — aggregate stats + BFS     │
│    └── CsvExporter        — grid → output.csv           │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
lidar-data-processor/
├── src/main/java/com/lidar/
│   ├── LidarApplication.java          # Spring Boot entry point
│   ├── controller/
│   │   └── LidarController.java       # REST endpoints (/api/process, /api/result)
│   ├── model/
│   │   ├── Point.java                 # Record: x, y, z, type
│   │   ├── GridCoordinate.java        # Record: x, y (grid indices)
│   │   └── GridCell.java              # Mutable cell with incremental stats
│   ├── reader/
│   │   └── PointCloudReader.java      # Lazy CSV reader with header detection
│   ├── validator/
│   │   └── DataValidator.java         # Point validation (NaN, ∞, elevation, type)
│   ├── processing/
│   │   ├── GridPartitioner.java       # Resolution-based spatial partitioning
│   │   ├── GridAggregator.java        # Stream → aggregated grid map
│   │   ├── StatisticsSummarizer.java  # Summary stats + BFS risk zone detection
│   │   └── SummaryStats.java          # Record: aggregate metrics
│   └── export/
│       └── CsvExporter.java           # Grid → 15-column CSV output
├── src/test/java/com/lidar/           # Unit tests (JUnit 5)
├── lidar-frontend/                    # React + Vite + TailwindCSS frontend
│   ├── src/
│   │   ├── App.jsx                    # Main layout & state management
│   │   ├── api/lidarApi.js            # Axios API client
│   │   └── components/
│   │       ├── UploadForm.jsx         # File upload + resolution config
│   │       ├── SummaryPanel.jsx       # Statistics cards
│   │       ├── HeatmapGrid.jsx        # Canvas heatmap with zoom & tooltips
│   │       └── FilterControls.jsx     # Map control filters
│   └── package.json
├── pom.xml                            # Maven build configuration
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

| Tool       | Version  |
|------------|----------|
| Java       | 21+      |
| Maven      | 3.9+     |
| Node.js    | 18+      |
| npm        | 9+       |

### 1. Clone the Repository

```bash
git clone https://github.com/oomm00/lidar-data-processor.git
cd lidar-data-processor
```

### 2. Start the Backend

```bash
./mvnw spring-boot:run
```

The API server starts on **http://localhost:8080**.

### 3. Start the Frontend

```bash
cd lidar-frontend
npm install
npm run dev
```

The dev server starts on **http://localhost:5173**.

---

## 🔌 API Reference

### `POST /api/process`

Upload a CSV file for processing.

| Parameter    | Type          | Default | Description                        |
|--------------|---------------|---------|------------------------------------|
| `file`       | `multipart`   | —       | CSV file with `x,y,z,type` columns |
| `resolution` | `double`      | `1.0`   | Grid cell size in meters           |

**Response** (JSON):

```json
{
  "totalCells": 156,
  "avgCanopyHeight": 12.34,
  "maxCanopyHeight": 38.58,
  "totalPoints": 150,
  "highRiskZoneCount": 3,
  "outputFile": "/tmp/output.csv"
}
```

### `GET /api/result`

Download the last processed output as a CSV file.

**Response**: `text/csv` with 15 columns:

```
grid_x, grid_y, min_height, max_height, canopy_height, avg_height,
point_density, ground_points, vegetation_points, building_points,
rock_points, dominant_type, vegetation_percent, built_percent, risk_level
```

---

## 🧠 Processing Pipeline

1. **Read** — `PointCloudReader` lazily streams CSV rows, auto-detects headers, skips malformed lines.
2. **Validate** — `DataValidator` rejects points with `NaN`, `±∞`, out-of-range elevation (`-500` to `9000` m), or invalid type codes (must be `1–4`).
3. **Partition** — `GridPartitioner` maps each `(x, y)` to a discrete `GridCoordinate` using `floor(coord / resolution)`.
4. **Aggregate** — `GridAggregator` groups points by grid cell and incrementally computes min/max/sum/count per cell plus per-type counters.
5. **Summarize** — `StatisticsSummarizer` computes global metrics and uses **BFS flood-fill** to detect connected risk zones.
6. **Export** — `CsvExporter` writes the enriched grid to a 15-column CSV.

### Risk Classification Rules

| Risk Level       | Condition                                          |
|------------------|----------------------------------------------------|
| `FIRE_RISK`      | Vegetation > 60% **and** canopy height > 10 m      |
| `URBAN_ZONE`     | Built area > 40%                                   |
| `LANDSLIDE_RISK` | Canopy height > 15 m                               |
| `NORMAL`         | None of the above                                  |

### Point Type Codes

| Code | Classification |
|------|----------------|
| `1`  | Ground         |
| `2`  | Vegetation     |
| `3`  | Building       |
| `4`  | Rock           |

---

## 🖥️ Frontend

The React frontend provides:

- **Upload Form** — Drag-and-drop or click-to-select CSV upload with configurable grid resolution.
- **Summary Panel** — Key statistics displayed in styled cards (total cells, max canopy height, total points, risk zone count).
- **Canvas Heatmap** — GPU-friendly `<canvas>` rendering of the spatial grid with:
  - **Risk View** — Color-coded by risk level (green = normal, red = fire, orange = landslide, blue = urban).
  - **Type View** — Color-coded by dominant land classification.
  - **Zoom controls** — Adjustable cell size (8–60 px).
  - **Hover tooltips** — Detailed per-cell info on mouse hover.
  - **Coordinate labels** — Grid axis labels every 5 cells.

---

## 🧪 Testing

Run all backend tests:

```bash
./mvnw test
```

Test suites cover:

- `PointCloudReaderTest` — header detection, malformed lines, lazy streaming
- `DataValidatorTest` — NaN, infinity, bounds, type validation
- `GridPartitionerTest` — coordinate mapping at different resolutions
- `GridAggregatorTest` — multi-point cell aggregation
- `StatisticsSummarizerTest` — aggregate stats and BFS zone detection
- `CsvExporterTest` — output format and column correctness

---

## 🛠️ Tech Stack

| Layer     | Technology                                         |
|-----------|----------------------------------------------------|
| Backend   | Java 21, Spring Boot 3.4, Maven                   |
| Frontend  | React 19, Vite 8, TailwindCSS 4, Axios, Recharts  |
| Testing   | JUnit 5, Spring Boot Test                          |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
