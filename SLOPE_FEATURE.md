# Slope Analysis Feature

## Overview
Added slope angle calculation and steepest descent direction analysis to the LiDAR terrain processing pipeline. This enhances landslide risk detection by incorporating terrain gradient analysis.

## Changes Made

### 1. New Class: `SlopeCalculator.java`
**Location:** `src/main/java/com/lidar/processing/SlopeCalculator.java`

**Purpose:** Computes slope angles and direction for each grid cell based on neighboring cells.

**Algorithm:**
- For each cell, examines all 8 neighbors (N, NE, E, SE, S, SW, W, NW)
- Computes slope angle using: `slope = atan(elevationDiff / distance)` converted to degrees
- Adjusts distance for diagonal neighbors (√2 × resolution)
- Tracks maximum slope among all directions
- Identifies steepest descent direction (neighbor with lowest elevation)
- Handles boundary cells gracefully (skips missing neighbors)

**Key Method:**
```java
Map<GridCoordinate, GridCell> computeSlopes(Map<GridCoordinate, GridCell> grid, double resolution)
```

### 2. Updated: `GridCell.java`
**New Fields:**
- `maxSlope` (double): Maximum slope angle in degrees across all neighbor directions
- `slopeDirection` (String): Direction of steepest descent (N/S/E/W/NE/SE/SW/NW or "FLAT")

**New Getters/Setters:**
- `getMaxSlope()` / `setMaxSlope(double)`
- `getSlopeDirection()` / `setSlopeDirection(String)`

**Enhanced Risk Classification:**
Added new landslide risk condition in `getRiskLevel()`:
```java
// LANDSLIDE: steep slope with ground/rock dominance
if (maxSlope > 35.0 && groundPercent + getRockPercent() > 50.0) 
    return "LANDSLIDE_RISK";
```

This complements existing landslide rules:
- High canopy variance (>25m) with ground/rock dominance
- Very high elevation (>650m) with significant rock content

### 3. Updated: `CsvExporter.java`
**New CSV Columns (now 17 total):**
- Column 16: `max_slope` (2 decimal places)
- Column 17: `slope_direction` (string: N/S/E/W/NE/SE/SW/NW/FLAT)

**New Header:**
```
grid_x,grid_y,min_height,max_height,canopy_height,avg_height,point_density,
ground_points,vegetation_points,building_points,rock_points,dominant_type,
vegetation_percent,built_percent,risk_level,max_slope,slope_direction
```

### 4. Updated: `LidarController.java`
**Pipeline Integration:**
```java
// Step 4: Partition and aggregate
Map<GridCoordinate, GridCell> grid = aggregator.aggregate(points);

// Step 4.5: Compute slopes (NEW)
grid = slopeCalculator.computeSlopes(grid, resolution);

// Step 5: Summarize (now includes slope-based risk assessment)
SummaryStats stats = summarizer.summarize(grid);
```

### 5. Updated: Frontend `App.jsx`
**Enhanced CSV Parsing:**
- Now expects 17 columns (was 15)
- Parses `maxSlope` (float) and `slopeDirection` (string)
- Frontend can now display slope information in tooltips/visualizations

### 6. New Test: `SlopeCalculatorTest.java`
**Location:** `src/test/java/com/lidar/processing/SlopeCalculatorTest.java`

**Test Coverage:**
- ✅ Flat terrain (0° slope)
- ✅ Steep slopes (>80°)
- ✅ Diagonal neighbor calculations
- ✅ Boundary cells (missing neighbors)
- ✅ All 8 direction detection
- ✅ 35° threshold (landslide trigger)
- ✅ Different grid resolutions

**Test Results:** 7/7 passing

### 7. Updated Tests
- `CsvExporterTest.java`: Updated expectations for 17-column format
- `StatisticsSummarizerTest.java`: Fixed risk zone test to use valid landslide conditions

## Usage Example

### Input CSV
```csv
x,y,z,type
100.0,200.0,450.0,1
100.5,200.0,455.0,1
100.0,200.5,452.0,1
```

### Processing
```java
Map<GridCoordinate, GridCell> grid = aggregator.aggregate(points);
grid = slopeCalculator.computeSlopes(grid, 0.5); // 0.5m resolution
```

### Output CSV (excerpt)
```csv
grid_x,grid_y,...,max_slope,slope_direction
200,400,...,45.00,SE
201,400,...,12.34,N
202,401,...,3.50,FLAT
```

## Performance Impact

- **Time Complexity:** O(8 × N) where N = number of grid cells
- **Space Complexity:** O(N) additional storage for slope data
- **Memory Impact:** +16 bytes per GridCell (double + String reference)

## Risk Classification Impact

### Before
Landslide risk required:
- Canopy height > 25m AND ground/rock > 50%, OR
- Elevation > 650m AND rock > 30%

### After
Landslide risk now also includes:
- **Slope > 35° AND ground/rock > 50%**

This catches steep rocky/earthen slopes that might not have high canopy variance (e.g., talus slopes, cliffs, eroded hillsides).

## Validation

All tests passing:
```
Tests run: 45, Failures: 0, Errors: 0, Skipped: 0
✓ SlopeCalculatorTest: 7/7
✓ CsvExporterTest: 5/5
✓ StatisticsSummarizerTest: 5/5
✓ GridAggregatorTest: 5/5
✓ Other tests: 23/23
```

## Future Enhancements

Potential improvements:
1. **Aspect analysis**: Track which compass direction the slope faces (important for solar exposure, snow accumulation)
2. **Curvature metrics**: Convex/concave terrain classification
3. **Slope variability**: Standard deviation of slope across neighbors
4. **Flow accumulation**: Predict water runoff paths
5. **Viewshed analysis**: Compute visible area from each cell
