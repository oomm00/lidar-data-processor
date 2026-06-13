package com.lidar.processing;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;

import java.util.Map;

public class SlopeCalculator {

    private static final int[][] DIRECTIONS_8 = {
            {0, 1},   // N
            {1, 1},   // NE
            {1, 0},   // E
            {1, -1},  // SE
            {0, -1},  // S
            {-1, -1}, // SW
            {-1, 0},  // W
            {-1, 1}   // NW
    };

    private static final String[] DIRECTION_NAMES = {
            "N", "NE", "E", "SE", "S", "SW", "W", "NW"
    };

    /**
     * Computes slope angles and directions for all cells in the grid.
     * Updates each GridCell with maxSlope and slopeDirection.
     *
     * @param grid       The grid map with elevation data
     * @param resolution The grid cell size in meters
     * @return The same grid map (cells are mutated in place)
     */
    public Map<GridCoordinate, GridCell> computeSlopes(
            Map<GridCoordinate, GridCell> grid,
            double resolution) {

        for (Map.Entry<GridCoordinate, GridCell> entry : grid.entrySet()) {
            GridCoordinate coord = entry.getKey();
            GridCell cell = entry.getValue();

            double currentElevation = cell.getAvgZ();
            double maxSlope = 0.0;
            String slopeDirection = "FLAT";
            double lowestElevation = currentElevation;

            // Check all 8 neighbors
            for (int i = 0; i < DIRECTIONS_8.length; i++) {
                int[] dir = DIRECTIONS_8[i];
                GridCoordinate neighborCoord = new GridCoordinate(
                        coord.x() + dir[0],
                        coord.y() + dir[1]
                );

                GridCell neighbor = grid.get(neighborCoord);
                if (neighbor == null) {
                    continue; // Skip missing neighbors at boundaries
                }

                double neighborElevation = neighbor.getAvgZ();
                double elevationDiff = Math.abs(currentElevation - neighborElevation);

                // Adjust distance for diagonal neighbors (√2 * resolution)
                double distance = (dir[0] != 0 && dir[1] != 0)
                        ? resolution * Math.sqrt(2)
                        : resolution;

                // Compute slope angle in degrees
                double slopeRadians = Math.atan(elevationDiff / distance);
                double slopeDegrees = Math.toDegrees(slopeRadians);

                // Track maximum slope
                if (slopeDegrees > maxSlope) {
                    maxSlope = slopeDegrees;
                }

                // Track direction of steepest descent (lowest neighbor)
                if (neighborElevation < lowestElevation) {
                    lowestElevation = neighborElevation;
                    slopeDirection = DIRECTION_NAMES[i];
                }
            }

            // Update cell with computed slope data
            cell.setMaxSlope(maxSlope);
            cell.setSlopeDirection(slopeDirection);
        }

        return grid;
    }
}
