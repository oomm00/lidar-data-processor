package com.lidar.processing;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SuitabilityScorerTest {

    private final SuitabilityScorer scorer = new SuitabilityScorer();

    private GridCell createCell(int x, int y) {
        GridCell cell = new GridCell(x, y);
        // Add at least one point so cell is valid
        cell.addPoint(100.0, 1);
        return cell;
    }

    @Test
    void testConstructionScoreIdealConditions() {
        // Ideal: flat, ground-based, low risk, no vegetation
        GridCell cell = createCell(0, 0);
        cell.setMaxSlope(0.0);
        // Cell is already Ground type with 1 point added
        
        Map<GridCoordinate, GridCell> grid = Map.of(new GridCoordinate(0, 0), cell);
        scorer.computeSuitability(grid);
        
        // Should be high score (100 base + 10 ground bonus - minimal penalties)
        assertTrue(cell.getConstructionScore() > 90.0, 
            "Ideal construction site should score > 90, got: " + cell.getConstructionScore());
        assertEquals("CONSTRUCTION", cell.getBestUse());
    }

    @Test
    void testConstructionScoreLandslideRisk() {
        // Landslide risk area should have very low construction score
        GridCell cell = new GridCell(0, 0);
        cell.addPoint(100.0, 1); // Ground
        cell.addPoint(150.0, 1); // Ground - creates high canopy
        cell.setMaxSlope(45.0); // Steep slope
        
        Map<GridCoordinate, GridCell> grid = Map.of(new GridCoordinate(0, 0), cell);
        scorer.computeSuitability(grid);
        
        // Landslide risk should cap at 10
        assertTrue(cell.getConstructionScore() <= 15.0,
            "Landslide risk should severely penalize construction");
    }

    @Test
    void testConstructionScoreSlopeImpact() {
        // Test that slope reduces construction score
        GridCell flatCell = createCell(0, 0);
        flatCell.setMaxSlope(0.0);
        
        GridCell steepCell = createCell(1, 0);
        steepCell.setMaxSlope(30.0);
        
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        grid.put(new GridCoordinate(0, 0), flatCell);
        grid.put(new GridCoordinate(1, 0), steepCell);
        scorer.computeSuitability(grid);
        
        assertTrue(flatCell.getConstructionScore() > steepCell.getConstructionScore(),
            "Flat terrain should score higher for construction than steep");
    }

    @Test
    void testAgricultureScoreIdealConditions() {
        // Ideal: ground type, moderate vegetation, gentle slope, temperate elevation
        GridCell cell = new GridCell(0, 0);
        cell.addPoint(350.0, 1); // Ground at temperate elevation
        cell.addPoint(351.0, 2); // Some vegetation
        cell.addPoint(352.0, 2); // More vegetation
        cell.addPoint(353.0, 1); // Ground
        // Now we have 50% ground, 50% vegetation
        cell.setMaxSlope(5.0); // Gentle slope
        
        Map<GridCoordinate, GridCell> grid = Map.of(new GridCoordinate(0, 0), cell);
        scorer.computeSuitability(grid);
        
        assertTrue(cell.getAgricultureScore() > 70.0,
            "Ideal agriculture site should score > 70, got: " + cell.getAgricultureScore());
    }

    @Test
    void testAgricultureScoreFireRisk() {
        // Fire risk should heavily penalize agriculture
        GridCell cell = new GridCell(0, 0);
        // Create fire risk conditions: vegPercent > 50%, canopy > 5, elevation 400-700
        cell.addPoint(450.0, 2); // Vegetation
        cell.addPoint(460.0, 2); // Vegetation
        cell.addPoint(470.0, 2); // Vegetation
        cell.setMaxSlope(3.0);
        
        Map<GridCoordinate, GridCell> grid = Map.of(new GridCoordinate(0, 0), cell);
        scorer.computeSuitability(grid);
        
        // Fire risk should significantly reduce agriculture score
        assertTrue(cell.getAgricultureScore() < 50.0,
            "Fire risk should penalize agriculture");
    }

    @Test
    void testAgricultureScoreSteepSlope() {
        // Slope > 15 degrees should penalize agriculture
        GridCell gentleCell = createCell(0, 0);
        gentleCell.setMaxSlope(5.0);
        
        GridCell steepCell = createCell(1, 0);
        steepCell.setMaxSlope(25.0);
        
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        grid.put(new GridCoordinate(0, 0), gentleCell);
        grid.put(new GridCoordinate(1, 0), steepCell);
        scorer.computeSuitability(grid);
        
        assertTrue(gentleCell.getAgricultureScore() > steepCell.getAgricultureScore(),
            "Gentle slope should score higher for agriculture");
    }

    @Test
    void testSolarScoreIdealConditions() {
        // Ideal: very flat, no canopy, low vegetation, minimal buildings
        GridCell cell = createCell(0, 0);
        cell.setMaxSlope(2.0); // Very flat
        // Default has no buildings, low veg
        
        Map<GridCoordinate, GridCell> grid = Map.of(new GridCoordinate(0, 0), cell);
        scorer.computeSuitability(grid);
        
        assertTrue(cell.getSolarScore() > 90.0,
            "Ideal solar site should score > 90, got: " + cell.getSolarScore());
        // Note: Construction may also score high for flat ground, so we check score value
        // rather than checking if it's the absolute best use
    }

    @Test
    void testSolarScoreCanopyPenalty() {
        // High canopy should heavily penalize solar
        GridCell flatOpen = createCell(0, 0);
        flatOpen.setMaxSlope(1.0);
        
        GridCell flatShaded = new GridCell(1, 0);
        flatShaded.addPoint(100.0, 1);
        flatShaded.addPoint(130.0, 2); // 30m canopy
        flatShaded.setMaxSlope(1.0);
        
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        grid.put(new GridCoordinate(0, 0), flatOpen);
        grid.put(new GridCoordinate(1, 0), flatShaded);
        scorer.computeSuitability(grid);
        
        assertTrue(flatOpen.getSolarScore() > flatShaded.getSolarScore(),
            "Open areas should score higher for solar than shaded");
    }

    @Test
    void testSolarScoreSlopePenalty() {
        // Steep slopes should reduce solar score
        GridCell flatCell = createCell(0, 0);
        flatCell.setMaxSlope(3.0);
        
        GridCell steepCell = createCell(1, 0);
        steepCell.setMaxSlope(20.0);
        
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        grid.put(new GridCoordinate(0, 0), flatCell);
        grid.put(new GridCoordinate(1, 0), steepCell);
        scorer.computeSuitability(grid);
        
        assertTrue(flatCell.getSolarScore() > steepCell.getSolarScore(),
            "Flat terrain should score higher for solar");
    }

    @Test
    void testScoresClampedTo100() {
        // Ensure scores never exceed 100
        GridCell cell = createCell(0, 0);
        cell.setMaxSlope(0.0);
        
        Map<GridCoordinate, GridCell> grid = Map.of(new GridCoordinate(0, 0), cell);
        scorer.computeSuitability(grid);
        
        assertTrue(cell.getConstructionScore() <= 100.0);
        assertTrue(cell.getAgricultureScore() <= 100.0);
        assertTrue(cell.getSolarScore() <= 100.0);
    }

    @Test
    void testScoresClampedToZero() {
        // Ensure scores never go below 0
        GridCell cell = new GridCell(0, 0);
        // Create terrible conditions
        cell.addPoint(100.0, 1);
        cell.addPoint(200.0, 2); // 100m canopy
        cell.setMaxSlope(80.0); // Nearly vertical
        
        Map<GridCoordinate, GridCell> grid = Map.of(new GridCoordinate(0, 0), cell);
        scorer.computeSuitability(grid);
        
        assertTrue(cell.getConstructionScore() >= 0.0);
        assertTrue(cell.getAgricultureScore() >= 0.0);
        assertTrue(cell.getSolarScore() >= 0.0);
    }

    @Test
    void testGetBestUseConstruction() {
        GridCell cell = createCell(0, 0);
        cell.setConstructionScore(80.0);
        cell.setAgricultureScore(40.0);
        cell.setSolarScore(30.0);
        
        assertEquals("CONSTRUCTION", cell.getBestUse());
    }

    @Test
    void testGetBestUseAgriculture() {
        GridCell cell = createCell(0, 0);
        cell.setConstructionScore(40.0);
        cell.setAgricultureScore(85.0);
        cell.setSolarScore(35.0);
        
        assertEquals("AGRICULTURE", cell.getBestUse());
    }

    @Test
    void testGetBestUseSolar() {
        GridCell cell = createCell(0, 0);
        cell.setConstructionScore(35.0);
        cell.setAgricultureScore(40.0);
        cell.setSolarScore(90.0);
        
        assertEquals("SOLAR", cell.getBestUse());
    }

    @Test
    void testGetBestUseUnsuitable() {
        GridCell cell = createCell(0, 0);
        cell.setConstructionScore(15.0);
        cell.setAgricultureScore(20.0);
        cell.setSolarScore(25.0);
        
        assertEquals("UNSUITABLE", cell.getBestUse());
    }

    @Test
    void testMultipleCellsSuitability() {
        // Test processing multiple cells at once
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        GridCell cell1 = createCell(0, 0);
        cell1.setMaxSlope(2.0);
        
        GridCell cell2 = createCell(1, 0);
        cell2.setMaxSlope(20.0);
        
        GridCell cell3 = createCell(0, 1);
        cell3.setMaxSlope(5.0);
        
        grid.put(new GridCoordinate(0, 0), cell1);
        grid.put(new GridCoordinate(1, 0), cell2);
        grid.put(new GridCoordinate(0, 1), cell3);
        
        scorer.computeSuitability(grid);
        
        // All cells should have scores computed
        assertTrue(cell1.getConstructionScore() > 0);
        assertTrue(cell2.getConstructionScore() > 0);
        assertTrue(cell3.getConstructionScore() > 0);
        
        // Flatter cells should generally score better
        assertTrue(cell1.getSolarScore() > cell2.getSolarScore());
    }
}
