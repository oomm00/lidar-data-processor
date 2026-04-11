# LiDAR Frontend (React + Vite)

This frontend is the visualization and interaction layer for your LiDAR terrain analysis pipeline.
It lets users upload a CSV point cloud, trigger backend processing, then inspect summary metrics and a zoomable terrain heatmap.

## 1. What This Frontend Does

The UI follows a simple 3-step workflow:

1. Upload point cloud CSV and choose grid resolution.
2. Send data to backend for processing.
3. Display result statistics and a spatial map (risk/type view).

The frontend talks to the Spring Boot backend at:

- `POST http://localhost:8080/api/process`
- `GET  http://localhost:8080/api/result`

## 2. Tech Stack

- React 19 for UI components and state management.
- Vite 8 for fast dev server and production build.
- Tailwind CSS v4 for utility-first styling.
- Axios for HTTP requests.
- ESLint for linting.

## 3. Runtime Data Flow

### Upload and process

1. User selects or drags a `.csv` file in `UploadForm`.
2. User selects a grid resolution (0.5 / 1.0 / 2.0 / 5.0 meters).
3. `processFile(file, resolution)` creates a `FormData` payload and sends it to `/api/process`.
4. Backend returns summary JSON (totals, canopy stats, risk count).
5. App state stores result and renders summary + map panels.

### Map rendering

1. `HeatmapGrid` listens for a new `result`.
2. It fetches raw CSV from `/api/result`.
3. CSV rows are parsed into grid-cell objects.
4. The component computes map bounds and builds a fast cell lookup map.
5. A `<canvas>` is drawn with:
	 - Grid lines and coordinate labels
	 - Color-coded cells by selected mode (`risk` or `type`)
	 - Hover tooltip with per-cell details
6. Zoom controls adjust cell size and re-render the canvas.

## 4. Component-Level Architecture

### `App.jsx`

- Holds global UI state: `result`, `loading`, `error`.
- Renders section layout:
	- Upload
	- Controls
	- Results (summary + heatmap)
- Displays loading indicator and dismissible error banner.

### `UploadForm.jsx`

- Handles file input, drag-and-drop, resolution selection.
- Validates `.csv` extension on dropped file.
- Calls backend processing and updates parent state callbacks.

### `SummaryPanel.jsx`

- Shows top-level statistics from processing result:
	- Total Grid Cells
	- Total Points
	- Average Canopy Height
	- Max Canopy Height
	- High Risk Zones

### `HeatmapGrid.jsx`

- Fetches exported CSV output from backend.
- Parses rows into per-cell metrics (height, density, type, risk).
- Draws dynamic canvas heatmap and legend.
- Supports mode switch (`Risk View` / `Type View`) and zoom controls.

### `FilterControls.jsx`

- Placeholder component right now (`[FilterControls Stub]`).
- Good place to add filtering by risk level, canopy range, density range, or type.

### `api/lidarApi.js`

- Encapsulates API requests (`processFile`, `downloadResult`).
- Keeps HTTP logic separate from UI components.

## 5. Project Structure (Frontend)

```text
lidar-frontend/
	src/
		api/
			lidarApi.js
		components/
			UploadForm.jsx
			SummaryPanel.jsx
			HeatmapGrid.jsx
			FilterControls.jsx
		App.jsx
		index.css
		main.jsx
```

## 6. How to Run in Development

Prerequisites:

- Node.js 18+ (recommended latest LTS)
- npm
- Backend running on `http://localhost:8080`

Install dependencies:

```bash
cd lidar-frontend
npm install
```

Start dev server:

```bash
npm run dev
```

Then open the URL printed by Vite (usually `http://localhost:5173`).

## 7. How to Build for Production

Create production bundle:

```bash
cd lidar-frontend
npm run build
```

Output is generated in:

- `lidar-frontend/dist`

Preview production build locally:

```bash
npm run preview
```

## 8. Scripts

- `npm run dev` - start Vite development server.
- `npm run build` - create optimized production build.
- `npm run preview` - serve built app from `dist`.
- `npm run lint` - run ESLint checks.

## 9. API Contract Used by Frontend

### `POST /api/process`

Request:

- `multipart/form-data`
- `file`: CSV file
- `resolution`: number (e.g., `1.0`)

Response (JSON):

```json
{
	"totalCells": 123,
	"avgCanopyHeight": 4.56,
	"maxCanopyHeight": 14.2,
	"totalPoints": 8000,
	"highRiskZoneCount": 9,
	"outputFile": "..."
}
```

### `GET /api/result`

Response:

- CSV (`text/csv`) containing per-grid-cell derived attributes.

## 10. Notes and Improvements

- `App.css` currently contains template/demo styles and is not used by `App.jsx`.
- API base URL is hardcoded in `api/lidarApi.js` and `HeatmapGrid.jsx`.
	- For deployment, move this into a Vite env variable (for example `VITE_API_BASE_URL`).
- `FilterControls.jsx` is currently a stub and can be extended with real map filters.

## 11. Common Issues

- Backend not running:
	- Upload or map fetch fails. Start Spring Boot app first.
- Wrong API URL/port:
	- Ensure backend is reachable at `http://localhost:8080`.
- CORS problems in production:
	- Configure backend allowed origins appropriately.
- Empty map after processing:
	- Verify `/api/result` returns CSV rows beyond header.

## 12. End-to-End Quick Test

1. Start backend (`mvn spring-boot:run` from project root).
2. Start frontend (`npm run dev` in `lidar-frontend`).
3. Upload `test_lidar.csv`.
4. Click **Process File**.
5. Confirm summary cards populate and heatmap displays data.
