# Slope Calculation Example

## 8-Direction Neighbor Analysis

```
         N (0,1)      NE (1,1)
           ↑         ↗
           |       /
           |     /
  W ←------●------→ E
 (-1,0)    |     \    (1,0)
           |       \
           ↓         ↘
         S (0,-1)   SE (1,-1)
        
    SW (-1,-1)     (Also NW not shown)
```

## Example Grid

```
Elevations (meters):
┌─────┬─────┬─────┐
│ 110 │ 105 │ 102 │  Grid Y = 1
├─────┼─────┼─────┤
│ 108 │ 100 │  98 │  Grid Y = 0  ← CENTER CELL at (0,0)
├─────┼─────┼─────┤
│ 106 │  97 │  95 │  Grid Y = -1
└─────┴─────┴─────┘
  X=-1   X=0   X=1
```

## Slope Calculations for Center Cell (0,0) at elevation 100m

**Grid Resolution: 1.0 meter**

### Cardinal Directions (Distance = 1.0m)

| Direction | Neighbor | Elev Diff | Distance | Slope Angle |
|-----------|----------|-----------|----------|-------------|
| N (0,1)   | 105m     | 5m        | 1.0m     | atan(5/1) = **78.7°** |
| E (1,0)   | 98m      | 2m        | 1.0m     | atan(2/1) = 63.4° |
| S (0,-1)  | 97m      | 3m        | 1.0m     | atan(3/1) = 71.6° |
| W (-1,0)  | 108m     | 8m        | 1.0m     | atan(8/1) = 82.9° |

### Diagonal Directions (Distance = √2 ≈ 1.414m)

| Direction | Neighbor | Elev Diff | Distance | Slope Angle |
|-----------|----------|-----------|----------|-------------|
| NE (1,1)  | 102m     | 2m        | 1.414m   | atan(2/1.414) = 54.7° |
| SE (1,-1) | 95m      | 5m        | 1.414m   | atan(5/1.414) = 74.2° |
| SW (-1,-1)| 106m     | 6m        | 1.414m   | atan(6/1.414) = 76.7° |
| NW (-1,1) | 110m     | 10m       | 1.414m   | atan(10/1.414) = **81.8°** |

## Results

**maxSlope**: **82.9°** (from West neighbor)  
**slopeDirection**: **"W"** (steepest descent is EAST, but we report direction to lowest neighbor)

Wait, let me recalculate the direction logic:

- Center elevation: 100m
- Lowest neighbor: 95m (Southeast)
- Therefore **slopeDirection = "SE"** (direction of steepest descent)

## Risk Assessment

```java
maxSlope = 82.9° (> 35° threshold ✓)
groundPercent + rockPercent = 100% (if all type 1 or 4 points ✓)

→ LANDSLIDE_RISK triggered!
```

## Code Trace

```java
// In SlopeCalculator.computeSlopes():
for each neighbor in 8 directions {
    elevationDiff = |100 - neighbor.elevation|
    distance = (diagonal ? resolution * √2 : resolution)
    slopeDegrees = toDegrees(atan(elevationDiff / distance))
    
    if (slopeDegrees > maxSlope) {
        maxSlope = slopeDegrees  // Track maximum
    }
    
    if (neighbor.elevation < lowestElevation) {
        lowestElevation = neighbor.elevation
        slopeDirection = directionName  // "SE" in this case
    }
}

cell.setMaxSlope(82.9)
cell.setSlopeDirection("SE")
```

## Boundary Cell Example

```
Edge cell at (0, 0) - only 3 neighbors exist:

    ? = missing
┌─────┬─────┐
│  ?  │  ?  │
├─────┼─────┤
│  ?  │ 100 │ ← CENTER
├─────┼─────┤
│  ?  │  95 │
└─────┴─────┘
     │ 102 │
     └─────┘

Only compute slopes for available neighbors:
- South: atan(3/1) = 71.6°
- Southeast: atan(5/1.414) = 74.2°
- East: atan(2/1) = 63.4°

maxSlope = 74.2°
slopeDirection = "S" (lowest available neighbor)
```

## Real-World Interpretation

| Slope (°) | Classification | Example Terrain |
|-----------|----------------|-----------------|
| 0-5°      | Flat           | Plains, valley floors |
| 5-15°     | Gentle         | Rolling hills |
| 15-25°    | Moderate       | Hillsides, ski slopes (green) |
| 25-35°    | Steep          | Mountain slopes, ski slopes (black) |
| 35-45°    | Very Steep     | **Landslide risk**, cliff faces |
| 45-60°    | Extreme        | Rock faces, scree slopes |
| 60°+      | Near-vertical  | Cliffs, waterfalls |

**35° threshold chosen because:**
- Loose soil typically slides at ~35° (angle of repose)
- Common geotechnical engineering threshold
- USGS uses 30-35° for landslide susceptibility mapping
