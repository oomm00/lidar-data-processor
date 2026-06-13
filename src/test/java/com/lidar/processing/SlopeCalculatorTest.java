package com.lidar.processing;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SlopeCalculatorTest {

    @Test
    void testFlatTerrain() {
        // All cells at same elevation = 0 slope
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        GridCell cell00 = new GridCell(0, 0);
        cell00.addPoint(100.0, 1);
        GridCell cell01 = new GridCell(0, 1);
        cell01.addPoint(100.0, 1);
        GridCell cell10 = new GridCell(1, 0);
        cell10.addPoint(100.0, 1);
        
        grid.put(new GridCoordinate(0, 0), cell00);
        grid.put(new GridCoordinate(0, 1), cell01);
        grid.put(new GridCoordinate(1, 0), cell10);
        
        SlopeCalculator calculator = new SlopeCalculator();
        calculator.computeSlopes(grid, 1.0);
        
        assertEquals(0.0, cell00.getMaxSlope(), 0.001);
        assertEquals("FLAT", cell00.getSlopeDirection());
    }

    @Test
    void testSteepSlope() {
        // Center cell at 100m, north neighbor at 110m = steep slope
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        GridCell center = new GridCell(0, 0);
        center.addPoint(100.0, 1);
        
        GridCell north = new GridCell(0, 1);
        north.addPoint(110.0, 1);
        
        GridCell south = new GridCell(0, -1);
        south.addPoint(90.0, 1);
        
        grid.put(new GridCoordinate(0, 0), center);
        grid.put(new GridCoordinate(0, 1), north);
        grid.put(new GridCoordinate(0, -1), south);
        
        SlopeCalculator calculator = new SlopeCalculator();
        calculator.computeSlopes(grid, 1.0);
        
        // 10m elevation change over 1m distance = atan(10/1) ≈ 84.3°
        assertTrue(center.getMaxSlope() > 80.0);
        assertEquals("S", center.getSlopeDirection()); // Steepest descent is to the south
    }

    @Test
    void testDiagonalSlope() {
        // Test diagonal neighbor slope calculation
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        GridCell center = new GridCell(0, 0);
        center.addPoint(100.0, 1);
        
        GridCell northeast = new GridCell(1, 1);
        northeast.addPoint(110.0, 1);
        
        grid.put(new GridCoordinate(0, 0), center);
        grid.put(new GridCoordinate(1, 1), northeast);
        
        SlopeCalculator calculator = new SlopeCalculator();
        calculator.computeSlopes(grid, 1.0);
        
        // Diagonal distance = sqrt(2), so slope = atan(10/sqrt(2)) ≈ 81.87°
        assertTrue(center.getMaxSlope() > 80.0);
        assertTrue(center.getMaxSlope() < 85.0);
    }

    @Test
    void testBoundaryCell() {
        // Cell at grid boundary with only one neighbor should not crash
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        GridCell boundary = new GridCell(0, 0);
        boundary.addPoint(100.0, 1);
        
        GridCell neighbor = new GridCell(1, 0);
        neighbor.addPoint(105.0, 1);
        
        grid.put(new GridCoordinate(0, 0), boundary);
        grid.put(new GridCoordinate(1, 0), neighbor);
        
        SlopeCalculator calculator = new SlopeCalculator();
        calculator.computeSlopes(grid, 1.0);
        
        // Should compute slope from available neighbor only
        assertTrue(boundary.getMaxSlope() > 0.0);
        assertNotNull(boundary.getSlopeDirection());
    }

    @Test
    void testSlopeDirection() {
        // Test all 8 directions
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        GridCell center = new GridCell(5, 5);
        center.addPoint(100.0, 1);
        grid.put(new GridCoordinate(5, 5), center);
        
        // Add neighbors at same elevation except south (lowest)
        int[][] dirs = {{0,1},{1,1},{1,0},{1,-1},{0,-1},{-1,-1},{-1,0},{-1,1}};
        for (int[] dir : dirs) {
            GridCell neighbor = new GridCell(5 + dir[0], 5 + dir[1]);
            // South neighbor is lower
            if (dir[0] == 0 && dir[1] == -1) {
                neighbor.addPoint(50.0, 1); // Much lower
            } else {
                neighbor.addPoint(100.0, 1);
            }
            grid.put(new GridCoordinate(5 + dir[0], 5 + dir[1]), neighbor);
        }
        
        SlopeCalculator calculator = new SlopeCalculator();
        calculator.computeSlopes(grid, 1.0);
        
        // Steepest descent should be to the south
        assertEquals("S", center.getSlopeDirection());
    }

    @Test
    void testModerateSlope35Degrees() {
        // Test the landslide threshold of 35 degrees
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        GridCell center = new GridCell(0, 0);
        center.addPoint(100.0, 1); // Ground point
        
        GridCell neighbor = new GridCell(1, 0);
        // For 35 degrees: tan(35°) ≈ 0.7, so elevation diff ≈ 0.7m for 1m distance
        neighbor.addPoint(100.7, 1);
        
        grid.put(new GridCoordinate(0, 0), center);
        grid.put(new GridCoordinate(1, 0), neighbor);
        
        SlopeCalculator calculator = new SlopeCalculator();
        calculator.computeSlopes(grid, 1.0);
        
        assertTrue(center.getMaxSlope() >= 34.0 && center.getMaxSlope() <= 36.0);
    }

    @Test
    void testDifferentResolutions() {
        // Test with different grid resolutions
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        GridCell center = new GridCell(0, 0);
        center.addPoint(100.0, 1);
        
        GridCell neighbor = new GridCell(1, 0);
        neighbor.addPoint(110.0, 1);
        
        grid.put(new GridCoordinate(0, 0), center);
        grid.put(new GridCoordinate(1, 0), neighbor);
        
        SlopeCalculator calculator = new SlopeCalculator();
        
        // Resolution 1.0m: slope = atan(10/1) ≈ 84.3°
        calculator.computeSlopes(grid, 1.0);
        double slope1m = center.getMaxSlope();
        
        // Reset slope values
        center.setMaxSlope(0.0);
        center.setSlopeDirection("FLAT");
        
        // Resolution 5.0m: slope = atan(10/5) ≈ 63.4°
        calculator.computeSlopes(grid, 5.0);
        double slope5m = center.getMaxSlope();
        
        assertTrue(slope1m > slope5m); // Steeper with smaller resolution
        assertTrue(slope5m > 60.0 && slope5m < 65.0);
    }
}
