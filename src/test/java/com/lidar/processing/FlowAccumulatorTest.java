package com.lidar.processing;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class FlowAccumulatorTest {

    private final FlowAccumulator accumulator = new FlowAccumulator();

    private GridCell createCell(int x, int y, double elevation, int pointType) {
        GridCell cell = new GridCell(x, y);
        cell.addPoint(elevation, pointType);
        return cell;
    }

    @Test
    void testFlatTerrain() {
        // All cells at same elevation - each is its own sink
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        grid.put(new GridCoordinate(0, 0), createCell(0, 0, 100.0, 1));
        grid.put(new GridCoordinate(1, 0), createCell(1, 0, 100.0, 1));
        grid.put(new GridCoordinate(0, 1), createCell(0, 1, 100.0, 1));

        Map<GridCoordinate, Integer> accumulation = accumulator.computeFlowAccumulation(grid);

        // Each cell has accumulation = 1 (no flow anywhere on flat terrain)
        assertEquals(1, accumulation.get(new GridCoordinate(0, 0)));
        assertEquals(1, accumulation.get(new GridCoordinate(1, 0)));
        assertEquals(1, accumulation.get(new GridCoordinate(0, 1)));
    }

    @Test
    void testSimpleSlope() {
        // Linear slope: high -> medium -> low
        // All flow accumulates at the lowest point
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        grid.put(new GridCoordinate(0, 0), createCell(0, 0, 120.0, 1)); // Highest
        grid.put(new GridCoordinate(1, 0), createCell(1, 0, 110.0, 1)); // Medium
        grid.put(new GridCoordinate(2, 0), createCell(2, 0, 100.0, 1)); // Lowest

        Map<GridCoordinate, Integer> accumulation = accumulator.computeFlowAccumulation(grid);

        assertEquals(1, accumulation.get(new GridCoordinate(0, 0))); // Source
        assertEquals(2, accumulation.get(new GridCoordinate(1, 0))); // Has 1 upstream
        assertEquals(3, accumulation.get(new GridCoordinate(2, 0))); // Sink, all flow here
    }

    @Test
    void testDrainageBasin() {
        /*
         * Create a simple basin:
         *   120  110  120
         *   110  100  110   -> All flow to center (100)
         *   120  110  120
         */
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Center cell (lowest - sink)
        grid.put(new GridCoordinate(1, 1), createCell(1, 1, 100.0, 1));
        
        // Mid-elevation ring
        grid.put(new GridCoordinate(1, 0), createCell(1, 0, 110.0, 1)); // N
        grid.put(new GridCoordinate(2, 1), createCell(2, 1, 110.0, 1)); // E
        grid.put(new GridCoordinate(1, 2), createCell(1, 2, 110.0, 1)); // S
        grid.put(new GridCoordinate(0, 1), createCell(0, 1, 110.0, 1)); // W
        
        // Outer high-elevation corners
        grid.put(new GridCoordinate(0, 0), createCell(0, 0, 120.0, 1)); // NW
        grid.put(new GridCoordinate(2, 0), createCell(2, 0, 120.0, 1)); // NE
        grid.put(new GridCoordinate(2, 2), createCell(2, 2, 120.0, 1)); // SE
        grid.put(new GridCoordinate(0, 2), createCell(0, 2, 120.0, 1)); // SW

        Map<GridCoordinate, Integer> accumulation = accumulator.computeFlowAccumulation(grid);

        // Center should have accumulation of 9 (all cells drain into it)
        assertEquals(9, accumulation.get(new GridCoordinate(1, 1)));
        
        // Corners should have accumulation of 1 (no upstream)
        assertEquals(1, accumulation.get(new GridCoordinate(0, 0)));
        assertEquals(1, accumulation.get(new GridCoordinate(2, 0)));
    }

    @Test
    void testMultipleSinks() {
        // Two separate basins, no connection
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Basin 1: flows to (0,0)
        grid.put(new GridCoordinate(0, 0), createCell(0, 0, 100.0, 1)); // Sink 1
        grid.put(new GridCoordinate(0, 1), createCell(0, 1, 110.0, 1));
        grid.put(new GridCoordinate(1, 0), createCell(1, 0, 110.0, 1));
        
        // Basin 2: flows to (3,3)
        grid.put(new GridCoordinate(3, 3), createCell(3, 3, 100.0, 1)); // Sink 2
        grid.put(new GridCoordinate(3, 2), createCell(3, 2, 110.0, 1));
        grid.put(new GridCoordinate(2, 3), createCell(2, 3, 110.0, 1));

        Map<GridCoordinate, Integer> accumulation = accumulator.computeFlowAccumulation(grid);

        // Each sink should have accumulation = 3 (itself + 2 upstream)
        assertEquals(3, accumulation.get(new GridCoordinate(0, 0)));
        assertEquals(3, accumulation.get(new GridCoordinate(3, 3)));
    }

    @Test
    void testCascadeRiskDetection() {
        // Create drainage channel with upstream landslide risk
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create a slope with landslide risk at top
        GridCell highCell = createCell(0, 0, 150.0, 1);
        highCell.addPoint(200.0, 1); // High canopy for landslide risk
        highCell.setMaxSlope(40.0); // Steep slope triggers landslide
        
        GridCell midCell = createCell(1, 0, 120.0, 1);
        GridCell lowCell = createCell(2, 0, 100.0, 1); // Drainage channel
        
        grid.put(new GridCoordinate(0, 0), highCell);
        grid.put(new GridCoordinate(1, 0), midCell);
        grid.put(new GridCoordinate(2, 0), lowCell);

        // Compute flow accumulation
        Map<GridCoordinate, Integer> accumulation = accumulator.computeFlowAccumulation(grid);
        
        // Low cell has high accumulation (3)
        assertEquals(3, accumulation.get(new GridCoordinate(2, 0)));

        // Detect cascade risk
        accumulator.detectCascadeRisk(grid, accumulation);

        // Low cell should be marked as cascade risk (has upstream landslide)
        assertTrue(lowCell.isCascadeRisk(), 
            "Drainage channel with upstream landslide should have cascade risk");
        assertEquals(3, lowCell.getFlowAccumulation());
    }

    @Test
    void testCascadeRiskThreshold() {
        // Create many small streams and one major drainage
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create 10 small isolated cells at different elevations (no connections)
        for (int i = 0; i < 10; i++) {
            grid.put(new GridCoordinate(i, 5), createCell(i, 5, 100.0 + i * 10, 1));
        }
        
        // Create major drainage channel (accumulation = 5)
        grid.put(new GridCoordinate(0, 0), createCell(0, 0, 140.0, 1));
        grid.put(new GridCoordinate(1, 0), createCell(1, 0, 130.0, 1));
        grid.put(new GridCoordinate(2, 0), createCell(2, 0, 120.0, 1));
        grid.put(new GridCoordinate(3, 0), createCell(3, 0, 110.0, 1));
        grid.put(new GridCoordinate(4, 0), createCell(4, 0, 100.0, 1)); // Main channel

        Map<GridCoordinate, Integer> accumulation = accumulator.computeFlowAccumulation(grid);
        accumulator.detectCascadeRisk(grid, accumulation);

        // Main channel should be in top 10% (5 out of 15 cells)
        GridCell mainChannel = grid.get(new GridCoordinate(4, 0));
        assertEquals(5, mainChannel.getFlowAccumulation());
        
        // Small isolated cells should have low accumulation (1 each)
        // But since they're spread far apart, they won't flow into each other
        GridCell isolatedCell = grid.get(new GridCoordinate(0, 5));
        assertTrue(isolatedCell.getFlowAccumulation() >= 1,
                "Isolated cells should have at least accumulation of 1");
    }

    @Test
    void testNoCascadeRiskWithoutLandslide() {
        // High accumulation but no upstream landslide risk
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        GridCell high = createCell(0, 0, 130.0, 1);
        GridCell mid = createCell(1, 0, 120.0, 1);
        GridCell low = createCell(2, 0, 100.0, 1);
        
        grid.put(new GridCoordinate(0, 0), high);
        grid.put(new GridCoordinate(1, 0), mid);
        grid.put(new GridCoordinate(2, 0), low);

        Map<GridCoordinate, Integer> accumulation = accumulator.computeFlowAccumulation(grid);
        accumulator.detectCascadeRisk(grid, accumulation);

        // No cascade risk because no landslide risk upstream
        assertFalse(low.isCascadeRisk());
        assertEquals(3, low.getFlowAccumulation());
    }

    @Test
    void testDiagonalFlow() {
        // Flow should follow lowest neighbor, including diagonals
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        grid.put(new GridCoordinate(0, 0), createCell(0, 0, 120.0, 1)); // NW
        grid.put(new GridCoordinate(1, 0), createCell(1, 0, 125.0, 1)); // N
        grid.put(new GridCoordinate(1, 1), createCell(1, 1, 100.0, 1)); // SE (lowest)

        Map<GridCoordinate, Integer> accumulation = accumulator.computeFlowAccumulation(grid);

        // SE cell should receive flow from both neighbors
        assertTrue(accumulation.get(new GridCoordinate(1, 1)) > 1,
            "Lowest cell should accumulate flow from diagonal neighbors");
    }

    @Test
    void testBoundaryHandling() {
        // Cell at edge with no downstream neighbor
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        grid.put(new GridCoordinate(0, 0), createCell(0, 0, 100.0, 1)); // Isolated cell

        Map<GridCoordinate, Integer> accumulation = accumulator.computeFlowAccumulation(grid);

        // Should have accumulation = 1 (itself only)
        assertEquals(1, accumulation.get(new GridCoordinate(0, 0)));
    }

    @Test
    void testComplexDrainageNetwork() {
        /*
         * Create branching drainage:
         *   130  120    120  130
         *       \  /    \  /
         *        110     110
         *          \    /
         *           100  (main channel)
         */
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Sources (4 cells)
        grid.put(new GridCoordinate(0, 0), createCell(0, 0, 130.0, 1));
        grid.put(new GridCoordinate(3, 0), createCell(3, 0, 130.0, 1));
        grid.put(new GridCoordinate(1, 0), createCell(1, 0, 120.0, 1));
        grid.put(new GridCoordinate(2, 0), createCell(2, 0, 120.0, 1));
        
        // Tributaries (2 cells)
        grid.put(new GridCoordinate(1, 1), createCell(1, 1, 110.0, 1));
        grid.put(new GridCoordinate(2, 1), createCell(2, 1, 110.0, 1));
        
        // Main channel (sink)
        grid.put(new GridCoordinate(2, 2), createCell(2, 2, 100.0, 1));

        Map<GridCoordinate, Integer> accumulation = accumulator.computeFlowAccumulation(grid);

        // Main channel should have highest accumulation
        int mainChannelAccum = accumulation.get(new GridCoordinate(2, 2));
        assertTrue(mainChannelAccum >= 5, 
            "Main drainage channel should have high accumulation, got: " + mainChannelAccum);
    }

    @Test
    void testFlowAccumulationSetOnCell() {
        // Verify that flow accumulation is set on GridCell objects
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        GridCell cell1 = createCell(0, 0, 110.0, 1);
        GridCell cell2 = createCell(1, 0, 100.0, 1);
        
        grid.put(new GridCoordinate(0, 0), cell1);
        grid.put(new GridCoordinate(1, 0), cell2);

        Map<GridCoordinate, Integer> accumulation = accumulator.computeFlowAccumulation(grid);
        accumulator.detectCascadeRisk(grid, accumulation);

        // Verify values are set on cell objects
        assertEquals(1, cell1.getFlowAccumulation());
        assertEquals(2, cell2.getFlowAccumulation());
        assertFalse(cell1.isCascadeRisk());
        assertFalse(cell2.isCascadeRisk());
    }
}
