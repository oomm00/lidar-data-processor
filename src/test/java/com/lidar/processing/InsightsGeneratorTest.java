package com.lidar.processing;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class InsightsGeneratorTest {

    private final InsightsGenerator generator = new InsightsGenerator();

    private GridCell createCell(int x, int y, double elevation) {
        GridCell cell = new GridCell(x, y);
        cell.addPoint(elevation, 1);
        return cell;
    }

    @Test
    void testEmptyGrid() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        List<String> insights = generator.generateInsights(grid, 1.0);

        assertEquals(1, insights.size());
        assertTrue(insights.get(0).contains("No terrain data available"));
    }

    @Test
    void testAllNormalRisk() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        for (int i = 0; i < 10; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            grid.put(new GridCoordinate(i, 0), cell);
        }

        List<String> insights = generator.generateInsights(grid, 1.0);

        // Should indicate normal conditions
        assertTrue(insights.stream().anyMatch(s -> s.contains("NORMAL conditions")),
                "Should report normal conditions when no risks detected");
    }

    @Test
    void testFireRiskDetection() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create fire risk cells
        for (int i = 0; i < 5; i++) {
            GridCell cell = new GridCell(i, 0);
            cell.addPoint(450.0, 2); // Vegetation at mid elevation
            cell.addPoint(460.0, 2); // More vegetation for > 50%
            cell.addPoint(470.0, 2);
            grid.put(new GridCoordinate(i, 0), cell);
        }
        
        // Add some normal cells
        for (int i = 5; i < 10; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            grid.put(new GridCoordinate(i, 0), cell);
        }

        List<String> insights = generator.generateInsights(grid, 1.0);

        // Should mention FIRE_RISK with percentage and location
        assertTrue(insights.stream().anyMatch(s -> 
                s.contains("FIRE_RISK") && s.contains("%") && s.contains("coordinates")),
                "Should report fire risk with percentage and location");
    }

    @Test
    void testLandslideRiskDetection() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create landslide risk cells (steep slope + ground dominance)
        for (int i = 0; i < 3; i++) {
            GridCell cell = createCell(i, i, 100.0 + i * 50);
            cell.setMaxSlope(40.0); // Steep slope
            grid.put(new GridCoordinate(i, i), cell);
        }
        
        // Add normal cells
        for (int i = 3; i < 10; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            grid.put(new GridCoordinate(i, 0), cell);
        }

        List<String> insights = generator.generateInsights(grid, 1.0);

        // Should mention LANDSLIDE_RISK
        assertTrue(insights.stream().anyMatch(s -> s.contains("LANDSLIDE_RISK")),
                "Should report landslide risk zones");
    }

    @Test
    void testCascadeRiskInsight() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create cells with cascade risk
        for (int i = 0; i < 5; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            cell.setCascadeRisk(true);
            cell.setFlowAccumulation(50 + i);
            grid.put(new GridCoordinate(i, 0), cell);
        }
        
        // Add normal cells
        for (int i = 5; i < 10; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            grid.put(new GridCoordinate(i, 0), cell);
        }

        List<String> insights = generator.generateInsights(grid, 1.0);

        // Should mention cascade risk with count and affected area
        assertTrue(insights.stream().anyMatch(s -> 
                s.contains("cascade risk zones") && s.contains("square meters")),
                "Should report cascade risk with affected area");
    }

    @Test
    void testNoCascadeRiskSkipped() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create cells without cascade risk
        for (int i = 0; i < 10; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            cell.setCascadeRisk(false);
            grid.put(new GridCoordinate(i, 0), cell);
        }

        List<String> insights = generator.generateInsights(grid, 1.0);

        // Should not mention cascade risk
        assertFalse(insights.stream().anyMatch(s -> s.contains("cascade risk")),
                "Should not report cascade risk when none exists");
    }

    @Test
    void testLandUseRecommendation() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create cells with different suitability scores
        for (int i = 0; i < 3; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            cell.setConstructionScore(90.0);
            cell.setAgricultureScore(50.0);
            cell.setSolarScore(40.0);
            grid.put(new GridCoordinate(i, 0), cell);
        }
        
        for (int i = 3; i < 6; i++) {
            GridCell cell = createCell(i, 0, 350.0);
            cell.setConstructionScore(50.0);
            cell.setAgricultureScore(90.0);
            cell.setSolarScore(40.0);
            grid.put(new GridCoordinate(i, 0), cell);
        }
        
        for (int i = 6; i < 9; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            cell.setConstructionScore(40.0);
            cell.setAgricultureScore(50.0);
            cell.setSolarScore(95.0);
            grid.put(new GridCoordinate(i, 0), cell);
        }

        List<String> insights = generator.generateInsights(grid, 1.0);

        // Should mention percentages for all three uses
        assertTrue(insights.stream().anyMatch(s -> 
                s.contains("construction") && s.contains("agriculture") && s.contains("solar")),
                "Should report land use percentages");
    }

    @Test
    void testSteepestTerrainWarning() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create cells with varying slopes
        for (int i = 0; i < 9; i++) {
            GridCell cell = createCell(i, 0, 100.0 + i * 10);
            cell.setMaxSlope(i * 3.0);
            grid.put(new GridCoordinate(i, 0), cell);
        }
        
        // Add one very steep cell
        GridCell steepCell = createCell(9, 0, 200.0);
        steepCell.setMaxSlope(45.0);
        grid.put(new GridCoordinate(9, 0), steepCell);

        List<String> insights = generator.generateInsights(grid, 1.0);

        // Should mention maximum slope with warning
        assertTrue(insights.stream().anyMatch(s -> 
                s.contains("45") && s.contains("degrees") && s.contains("exceeds")),
                "Should warn about steep slopes exceeding safe thresholds");
    }

    @Test
    void testFlatTerrainNote() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create very flat terrain
        for (int i = 0; i < 10; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            cell.setMaxSlope(2.0);
            grid.put(new GridCoordinate(i, 0), cell);
        }

        List<String> insights = generator.generateInsights(grid, 1.0);

        // Should mention flat terrain
        assertTrue(insights.stream().anyMatch(s -> 
                s.toLowerCase().contains("flat") && s.contains("ideal for development")),
                "Should note flat terrain is ideal for development");
    }

    @Test
    void testOverallRiskScoreLow() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create mostly normal cells
        for (int i = 0; i < 100; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            // Risk level defaults to NORMAL
            grid.put(new GridCoordinate(i, 0), cell);
        }

        List<String> insights = generator.generateInsights(grid, 1.0);

        // Should report LOW risk
        assertTrue(insights.stream().anyMatch(s -> 
                s.contains("Overall terrain risk index") && s.contains("LOW")),
                "Should report LOW risk for predominantly normal terrain");
    }

    @Test
    void testOverallRiskScoreHigh() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create many landslide risk cells (weighted heavily)
        for (int i = 0; i < 60; i++) {
            GridCell cell = createCell(i, 0, 100.0 + i);
            cell.setMaxSlope(40.0); // Trigger landslide risk
            grid.put(new GridCoordinate(i, 0), cell);
        }
        
        // Add some normal cells
        for (int i = 60; i < 100; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            grid.put(new GridCoordinate(i, 0), cell);
        }

        List<String> insights = generator.generateInsights(grid, 1.0);

        // Should report HIGH or SEVERE risk
        assertTrue(insights.stream().anyMatch(s -> 
                s.contains("Overall terrain risk index") && (s.contains("HIGH") || s.contains("SEVERE"))),
                "Should report HIGH/SEVERE risk for hazardous terrain");
    }

    @Test
    void testFloodRiskInsight() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create cells with varying flow accumulation
        for (int i = 0; i < 90; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            cell.setFlowAccumulation(i + 1);
            grid.put(new GridCoordinate(i, 0), cell);
        }
        
        // Add high flow accumulation cells (top 5%)
        for (int i = 90; i < 100; i++) {
            GridCell cell = createCell(i, 0, 90.0);
            cell.setFlowAccumulation(100 + i);
            grid.put(new GridCoordinate(i, 0), cell);
        }

        List<String> insights = generator.generateInsights(grid, 1.0);

        // Should mention major drainage channels
        assertTrue(insights.stream().anyMatch(s -> 
                s.contains("drainage channels") && s.contains("flood risk")),
                "Should report flood risk for high flow accumulation zones");
    }

    @Test
    void testInsightCount() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create diverse terrain
        GridCell fireRiskCell = new GridCell(0, 0);
        fireRiskCell.addPoint(450.0, 2);
        fireRiskCell.addPoint(460.0, 2);
        fireRiskCell.addPoint(470.0, 2);
        grid.put(new GridCoordinate(0, 0), fireRiskCell);
        
        GridCell cascadeCell = createCell(1, 0, 100.0);
        cascadeCell.setCascadeRisk(true);
        cascadeCell.setFlowAccumulation(50);
        grid.put(new GridCoordinate(1, 0), cascadeCell);
        
        for (int i = 2; i < 10; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            cell.setMaxSlope(i * 2.0);
            cell.setFlowAccumulation(i);
            cell.setConstructionScore(80.0);
            cell.setAgricultureScore(60.0);
            cell.setSolarScore(50.0);
            grid.put(new GridCoordinate(i, 0), cell);
        }

        List<String> insights = generator.generateInsights(grid, 1.0);

        // Should have at least 5 insights (risk, cascade, land use, slope, overall)
        assertTrue(insights.size() >= 5,
                "Should generate at least 5 insights, got: " + insights.size());
    }

    @Test
    void testCentroidCalculation() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create fire risk cells in a specific location
        GridCell cell1 = new GridCell(10, 20);
        cell1.addPoint(450.0, 2);
        cell1.addPoint(460.0, 2);
        cell1.addPoint(470.0, 2);
        grid.put(new GridCoordinate(10, 20), cell1);
        
        GridCell cell2 = new GridCell(20, 30);
        cell2.addPoint(450.0, 2);
        cell2.addPoint(460.0, 2);
        cell2.addPoint(470.0, 2);
        grid.put(new GridCoordinate(20, 30), cell2);

        List<String> insights = generator.generateInsights(grid, 1.0);

        // Centroid should be approximately (15, 25)
        assertTrue(insights.stream().anyMatch(s -> 
                s.contains("FIRE_RISK") && s.contains("(15, 25)")),
                "Should report correct centroid for risk zone");
    }

    @Test
    void testFireRiskRecommendation() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create 12 fire risk cells (12% of 100 total cells)
        for (int i = 0; i < 12; i++) {
            GridCell cell = new GridCell(i, 0);
            cell.addPoint(450.0, 2); // vegetation
            cell.addPoint(460.0, 2);
            cell.addPoint(470.0, 2); // makes it FIRE_RISK
            grid.put(new GridCoordinate(i, 0), cell);
        }
        
        // Add 88 normal cells
        for (int i = 12; i < 100; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            grid.put(new GridCoordinate(i, 0), cell);
        }

        List<String> recommendations = generator.generateRecommendations(grid, 1.0);

        assertTrue(recommendations.stream().anyMatch(s -> 
                s.contains("establishing firebreaks") && s.contains("buffer zone")),
                "Should recommend establishing firebreaks with buffer zone");
    }

    @Test
    void testCascadeRiskRecommendation() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create cascade risk cells
        for (int i = 0; i < 5; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            cell.setCascadeRisk(true);
            grid.put(new GridCoordinate(i, 0), cell);
        }

        List<String> recommendations = generator.generateRecommendations(grid, 1.0);

        assertTrue(recommendations.stream().anyMatch(s -> 
                s.contains("slope stabilization") && s.contains("debris flow path")),
                "Should recommend slope stabilization for cascade risk cells");
    }

    @Test
    void testSteepestSlopeRecommendation() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        GridCell cell = createCell(0, 0, 100.0);
        cell.setMaxSlope(65.0); // > 60 degrees
        grid.put(new GridCoordinate(0, 0), cell);

        List<String> recommendations = generator.generateRecommendations(grid, 1.0);

        assertTrue(recommendations.stream().anyMatch(s -> 
                s.contains("unsurveyable/unstable") && s.contains("ground-truth")),
                "Should recommend ground-truth or exclusion for extremely steep cells");
    }

    @Test
    void testLandUseClusterRecommendation() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create construction cells in a contiguous cluster of 4
        // (0,0), (0,1), (1,0), (1,1)
        int[][] coords = {{0,0}, {0,1}, {1,0}, {1,1}};
        for (int[] coord : coords) {
            GridCell cell = createCell(coord[0], coord[1], 100.0);
            cell.setConstructionScore(90.0); // makes CONSTRUCTION bestUse
            grid.put(new GridCoordinate(coord[0], coord[1]), cell);
        }

        List<String> recommendations = generator.generateRecommendations(grid, 1.0);

        assertTrue(recommendations.stream().anyMatch(s -> 
                s.contains("contiguous cluster") && s.contains("CONSTRUCTION")),
                "Should recommend contiguous cluster priority site for land uses");
    }

    @Test
    void testDrainageRecommendation() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // Create cells with high flow accumulation
        for (int i = 0; i < 90; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            cell.setFlowAccumulation(i + 1);
            grid.put(new GridCoordinate(i, 0), cell);
        }
        for (int i = 90; i < 100; i++) {
            GridCell cell = createCell(i, 0, 90.0);
            cell.setFlowAccumulation(150 + i); // major channel
            grid.put(new GridCoordinate(i, 0), cell);
        }

        List<String> recommendations = generator.generateRecommendations(grid, 1.0);

        assertTrue(recommendations.stream().anyMatch(s -> 
                s.contains("drainage channels identified") && s.contains("preserved")),
                "Should recommend preserving drainage channels to prevent flooding");
    }

    @Test
    void testOverallClosingRecommendation() {
        Map<GridCoordinate, GridCell> grid = new HashMap<>();
        
        // 1. Low risk test
        for (int i = 0; i < 10; i++) {
            grid.put(new GridCoordinate(i, 0), createCell(i, 0, 100.0));
        }
        List<String> recsLow = generator.generateRecommendations(grid, 1.0);
        assertTrue(recsLow.stream().anyMatch(s -> s.contains("generally suitable for development")),
                "Should recommend standard precautions for low risk");

        // 2. High risk test
        Map<GridCoordinate, GridCell> gridHigh = new HashMap<>();
        for (int i = 0; i < 60; i++) {
            GridCell cell = createCell(i, 0, 100.0);
            cell.setMaxSlope(40.0); // Trigger landslide risk
            gridHigh.put(new GridCoordinate(i, 0), cell);
        }
        for (int i = 60; i < 100; i++) {
            gridHigh.put(new GridCoordinate(i, 0), createCell(i, 0, 100.0));
        }
        List<String> recsHigh = generator.generateRecommendations(gridHigh, 1.0);
        assertTrue(recsHigh.stream().anyMatch(s -> s.contains("NOT recommended for development")),
                "Should advise against development for high risk");
    }
}
