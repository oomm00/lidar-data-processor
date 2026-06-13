package com.lidar.processing;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;

import java.util.*;
import java.util.stream.Collectors;

public class InsightsGenerator {

    /**
     * Generates human-readable insights from processed terrain data.
     *
     * @param grid       The processed grid with all computed metrics
     * @param resolution The grid cell size in meters
     * @return List of insight strings for user consumption
     */
    public List<String> generateInsights(Map<GridCoordinate, GridCell> grid, double resolution) {
        List<String> insights = new ArrayList<>();

        if (grid.isEmpty()) {
            insights.add("No terrain data available for analysis.");
            return insights;
        }

        int totalCells = grid.size();

        // 1. Risk zone summary
        insights.addAll(generateRiskZoneSummary(grid, totalCells));

        // 2. Cascade hazard analysis
        String cascadeInsight = generateCascadeHazardInsight(grid, resolution);
        if (cascadeInsight != null) {
            insights.add(cascadeInsight);
        }

        // 3. Land use recommendations
        insights.add(generateLandUseRecommendation(grid, totalCells));

        // 4. Steepest terrain analysis
        insights.add(generateSteepestTerrainInsight(grid));

        // 5. Overall risk score
        insights.add(generateOverallRiskScore(grid, totalCells));

        // 6. Bonus: High flow accumulation zones (flood risk)
        String floodInsight = generateFloodRiskInsight(grid, totalCells);
        if (floodInsight != null) {
            insights.add(floodInsight);
        }

        return insights;
    }

    /**
     * Generate risk zone summary with centroid locations.
     */
    private List<String> generateRiskZoneSummary(Map<GridCoordinate, GridCell> grid, int totalCells) {
        List<String> insights = new ArrayList<>();

        // Group cells by risk level
        Map<String, List<Map.Entry<GridCoordinate, GridCell>>> riskGroups = grid.entrySet().stream()
                .collect(Collectors.groupingBy(e -> e.getValue().getRiskLevel()));

        // Analyze each risk type (except NORMAL)
        for (String riskLevel : Arrays.asList("FIRE_RISK", "LANDSLIDE_RISK", "URBAN_ZONE")) {
            List<Map.Entry<GridCoordinate, GridCell>> cells = riskGroups.get(riskLevel);
            if (cells != null && !cells.isEmpty()) {
                double percentage = (cells.size() * 100.0) / totalCells;
                Centroid centroid = computeCentroid(cells);

                String insight = String.format("%.1f%% of cells are %s, concentrated around coordinates (%.0f, %.0f)",
                        percentage, riskLevel, centroid.x, centroid.y);
                insights.add(insight);
            }
        }

        // If all cells are normal
        if (insights.isEmpty()) {
            insights.add("Terrain analysis indicates NORMAL conditions throughout the surveyed area with no significant risk zones detected");
        }

        return insights;
    }

    /**
     * Generate cascade hazard insight.
     */
    private String generateCascadeHazardInsight(Map<GridCoordinate, GridCell> grid, double resolution) {
        List<Map.Entry<GridCoordinate, GridCell>> cascadeRiskCells = grid.entrySet().stream()
                .filter(e -> e.getValue().isCascadeRisk())
                .collect(Collectors.toList());

        if (cascadeRiskCells.isEmpty()) {
            return null; // No cascade risk, skip this insight
        }

        int cascadeCount = cascadeRiskCells.size();
        Centroid centroid = computeCentroid(cascadeRiskCells);
        double affectedArea = cascadeCount * resolution * resolution;

        return String.format("%d cells identified as cascade risk zones — landslide-prone terrain drains toward (%.0f, %.0f), affecting an estimated area of %.0f square meters",
                cascadeCount, centroid.x, centroid.y, affectedArea);
    }

    /**
     * Generate land use recommendations based on suitability scores.
     */
    private String generateLandUseRecommendation(Map<GridCoordinate, GridCell> grid, int totalCells) {
        Map<String, Long> useCounts = grid.values().stream()
                .collect(Collectors.groupingBy(GridCell::getBestUse, Collectors.counting()));

        double constructionPercent = (useCounts.getOrDefault("CONSTRUCTION", 0L) * 100.0) / totalCells;
        double agriculturePercent = (useCounts.getOrDefault("AGRICULTURE", 0L) * 100.0) / totalCells;
        double solarPercent = (useCounts.getOrDefault("SOLAR", 0L) * 100.0) / totalCells;
        double unsuitablePercent = (useCounts.getOrDefault("UNSUITABLE", 0L) * 100.0) / totalCells;

        StringBuilder insight = new StringBuilder();
        insight.append(String.format("Land use analysis: %.1f%% suitable for construction, %.1f%% for agriculture, %.1f%% for solar installation",
                constructionPercent, agriculturePercent, solarPercent));

        if (unsuitablePercent > 25.0) {
            insight.append(String.format(" (%.1f%% unsuitable for development)", unsuitablePercent));
        }

        return insight.toString();
    }

    /**
     * Generate steepest terrain insight.
     */
    private String generateSteepestTerrainInsight(Map<GridCoordinate, GridCell> grid) {
        Optional<Map.Entry<GridCoordinate, GridCell>> steepest = grid.entrySet().stream()
                .max(Comparator.comparingDouble(e -> e.getValue().getMaxSlope()));

        if (steepest.isEmpty()) {
            return "Slope analysis: No significant slope detected in surveyed area";
        }

        GridCoordinate coord = steepest.get().getKey();
        double maxSlope = steepest.get().getValue().getMaxSlope();

        String warning = "";
        if (maxSlope > 25.0) {
            warning = " — exceeds safe construction threshold of 25 degrees";
        } else if (maxSlope < 5.0) {
            return String.format("Terrain is predominantly flat with maximum slope of %.1f degrees — ideal for development", maxSlope);
        }

        return String.format("Maximum slope detected: %.1f degrees at grid cell (%d, %d)%s",
                maxSlope, coord.x(), coord.y(), warning);
    }

    /**
     * Generate overall risk score.
     */
    private String generateOverallRiskScore(Map<GridCoordinate, GridCell> grid, int totalCells) {
        long fireRiskCount = grid.values().stream()
                .filter(c -> "FIRE_RISK".equals(c.getRiskLevel()))
                .count();

        long landslideRiskCount = grid.values().stream()
                .filter(c -> "LANDSLIDE_RISK".equals(c.getRiskLevel()))
                .count();

        long urbanZoneCount = grid.values().stream()
                .filter(c -> "URBAN_ZONE".equals(c.getRiskLevel()))
                .count();

        // Weighted risk score (landslides are most severe)
        double overallRiskScore = ((fireRiskCount * 0.6 + landslideRiskCount * 1.0 + urbanZoneCount * 0.4)
                / totalCells) * 100;

        String riskLevel;
        if (overallRiskScore < 25.0) {
            riskLevel = "LOW";
        } else if (overallRiskScore < 50.0) {
            riskLevel = "MODERATE";
        } else if (overallRiskScore < 75.0) {
            riskLevel = "HIGH";
        } else {
            riskLevel = "SEVERE";
        }

        String recommendation = "";
        if (overallRiskScore >= 50.0) {
            recommendation = " — comprehensive hazard mitigation recommended";
        } else if (overallRiskScore >= 25.0) {
            recommendation = " — risk awareness and monitoring advised";
        }

        return String.format("Overall terrain risk index: %.1f/100 — %s%s",
                overallRiskScore, riskLevel, recommendation);
    }

    /**
     * Generate flood risk insight based on flow accumulation.
     */
    private String generateFloodRiskInsight(Map<GridCoordinate, GridCell> grid, int totalCells) {
        // Find cells with very high flow accumulation (top 5%)
        List<Integer> accumulationValues = grid.values().stream()
                .map(GridCell::getFlowAccumulation)
                .sorted(Comparator.reverseOrder())
                .collect(Collectors.toList());

        if (accumulationValues.isEmpty()) {
            return null;
        }

        int threshold95Index = (int) (accumulationValues.size() * 0.05);
        int highFlowThreshold = accumulationValues.get(Math.min(threshold95Index, accumulationValues.size() - 1));

        List<Map.Entry<GridCoordinate, GridCell>> highFlowCells = grid.entrySet().stream()
                .filter(e -> e.getValue().getFlowAccumulation() >= highFlowThreshold)
                .collect(Collectors.toList());

        if (highFlowCells.isEmpty() || highFlowThreshold < 5) {
            return null; // Not significant enough to report
        }

        int maxAccumulation = accumulationValues.get(0);
        Centroid centroid = computeCentroid(highFlowCells);

        return String.format("Major drainage channels detected: %d cells with high water accumulation (max: %d contributing cells) centered at (%.0f, %.0f) — potential flood risk during heavy precipitation",
                highFlowCells.size(), maxAccumulation, centroid.x, centroid.y);
    }

    /**
     * Compute the centroid (average x, y) of a collection of cells.
     */
    private Centroid computeCentroid(List<Map.Entry<GridCoordinate, GridCell>> cells) {
        if (cells.isEmpty()) {
            return new Centroid(0, 0);
        }

        double sumX = cells.stream().mapToDouble(e -> e.getKey().x()).sum();
        double sumY = cells.stream().mapToDouble(e -> e.getKey().y()).sum();

        return new Centroid(sumX / cells.size(), sumY / cells.size());
    }

    /**
     * Simple record to hold centroid coordinates.
     */
    private record Centroid(double x, double y) {
    }
}
