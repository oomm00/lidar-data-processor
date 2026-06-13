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
     * Generates a list of action recommendations based on analyzed terrain data.
     */
    public List<String> generateRecommendations(Map<GridCoordinate, GridCell> grid, double resolution) {
        List<String> recommendations = new ArrayList<>();
        if (grid.isEmpty()) {
            return recommendations;
        }

        int totalCells = grid.size();

        // 1. Fire Risk Recommendation
        long fireCellsCount = grid.values().stream()
                .filter(c -> "FIRE_RISK".equals(c.getRiskLevel()))
                .count();
        double firePercent = (fireCellsCount * 100.0) / totalCells;
        if (firePercent > 10.0) {
            List<Map.Entry<GridCoordinate, GridCell>> fireCells = grid.entrySet().stream()
                    .filter(e -> "FIRE_RISK".equals(e.getValue().getRiskLevel()))
                    .collect(Collectors.toList());
            Centroid centroid = computeCentroid(fireCells);
            recommendations.add(String.format("Recommend establishing firebreaks at (%.0f, %.0f) — clear vegetation in a 15m buffer zone around high-density fire risk cells to reduce spread potential.",
                    centroid.x, centroid.y));
        }

        // 2. Cascade Risk Recommendation
        List<Map.Entry<GridCoordinate, GridCell>> cascadeCells = grid.entrySet().stream()
                .filter(e -> e.getValue().isCascadeRisk())
                .collect(Collectors.toList());
        if (!cascadeCells.isEmpty()) {
            Centroid centroid = computeCentroid(cascadeCells);
            recommendations.add(String.format("Recommend slope stabilization (retaining walls / terracing / reforestation) at (%.0f, %.0f) — %d cells in the debris flow path. Prioritize if any infrastructure exists downstream.",
                    centroid.x, centroid.y, cascadeCells.size()));
        }

        // 3. Steepest Terrain Recommendation
        Optional<Map.Entry<GridCoordinate, GridCell>> steepest = grid.entrySet().stream()
                .max(Comparator.comparingDouble(e -> e.getValue().getMaxSlope()));
        if (steepest.isPresent() && steepest.get().getValue().getMaxSlope() > 60.0) {
            GridCell cell = steepest.get().getValue();
            recommendations.add(String.format("Cell (%d,%d) at %.1f degrees slope is likely unsurveyable/unstable — recommend ground-truth verification or exclude from development planning entirely.",
                    cell.getGridX(), cell.getGridY(), cell.getMaxSlope()));
        }

        // 4. Land Use Recommendations
        for (String bestUse : Arrays.asList("CONSTRUCTION", "AGRICULTURE", "SOLAR")) {
            long count = grid.values().stream()
                    .filter(c -> bestUse.equals(c.getBestUse()))
                    .count();
            double percentage = (count * 100.0) / totalCells;
            List<GridCoordinate> cluster = findLargestCluster(grid, bestUse);
            if (!cluster.isEmpty()) {
                Centroid centroid = computeCentroidOfCoords(cluster);
                double area = cluster.size() * resolution * resolution;
                recommendations.add(String.format("Of the %.1f%% suitable for %s, the highest-scoring contiguous cluster is at (%.0f, %.0f), spanning %d cells (~%.0f sq meters) — recommended as priority site for %s.",
                        percentage, bestUse, centroid.x, centroid.y, cluster.size(), area, bestUse));
            }
        }

        // 5. Drainage Recommendation
        List<Integer> accumulationValues = grid.values().stream()
                .map(GridCell::getFlowAccumulation)
                .sorted(Comparator.reverseOrder())
                .collect(Collectors.toList());
        int thresholdIndex = (int) (accumulationValues.size() * 0.1);
        int threshold = accumulationValues.isEmpty() ? Integer.MAX_VALUE 
                : accumulationValues.get(Math.min(thresholdIndex, accumulationValues.size() - 1));

        long channelCount = grid.values().stream()
                .filter(c -> c.getFlowAccumulation() >= threshold && c.getFlowAccumulation() >= 5)
                .count();
        if (channelCount > 0) {
            recommendations.add(String.format("%d drainage channels identified — recommend these be preserved/ unobstructed in any development plan; building across these paths risks flooding.",
                    channelCount));
        }

        // 6. Overall Recommendation
        long fireRiskCount = grid.values().stream()
                .filter(c -> "FIRE_RISK".equals(c.getRiskLevel()))
                .count();
        long landslideRiskCount = grid.values().stream()
                .filter(c -> "LANDSLIDE_RISK".equals(c.getRiskLevel()))
                .count();
        long urbanZoneCount = grid.values().stream()
                .filter(c -> "URBAN_ZONE".equals(c.getRiskLevel()))
                .count();

        double overallRiskScore = ((fireRiskCount * 0.6 + landslideRiskCount * 1.0 + urbanZoneCount * 0.4)
                / totalCells) * 100;

        String closingReco;
        if (overallRiskScore < 25.0) {
            closingReco = "Site is generally suitable for development with standard precautions.";
        } else if (overallRiskScore < 50.0) {
            closingReco = "Site requires risk mitigation in flagged zones before development; remainder is viable.";
        } else {
            closingReco = "Site is NOT recommended for development without major engineering intervention. Recommend designating as protected/monitoring zone.";
        }
        recommendations.add(closingReco);

        return recommendations;
    }

    /**
     * BFS logic to group adjacent cells with the same bestUse and return the largest cluster.
     */
    private List<GridCoordinate> findLargestCluster(Map<GridCoordinate, GridCell> grid, String targetUse) {
        Set<GridCoordinate> visited = new HashSet<>();
        List<GridCoordinate> largestCluster = new ArrayList<>();
        int[][] directions = {{0, 1}, {0, -1}, {1, 0}, {-1, 0}};

        for (Map.Entry<GridCoordinate, GridCell> entry : grid.entrySet()) {
            GridCoordinate start = entry.getKey();
            if (visited.contains(start) || !targetUse.equals(entry.getValue().getBestUse())) {
                continue;
            }

            List<GridCoordinate> currentCluster = new ArrayList<>();
            Queue<GridCoordinate> queue = new ArrayDeque<>();
            queue.add(start);
            visited.add(start);

            while (!queue.isEmpty()) {
                GridCoordinate current = queue.poll();
                currentCluster.add(current);

                for (int[] dir : directions) {
                    GridCoordinate neighbor = new GridCoordinate(
                            current.x() + dir[0],
                            current.y() + dir[1]
                    );
                    if (!visited.contains(neighbor) && grid.containsKey(neighbor)) {
                        GridCell neighborCell = grid.get(neighbor);
                        if (targetUse.equals(neighborCell.getBestUse())) {
                            visited.add(neighbor);
                            queue.add(neighbor);
                        }
                    }
                }
            }

            if (currentCluster.size() > largestCluster.size()) {
                largestCluster = currentCluster;
            }
        }
        return largestCluster;
    }

    private Centroid computeCentroidOfCoords(List<GridCoordinate> coords) {
        if (coords.isEmpty()) {
            return new Centroid(0, 0);
        }
        double sumX = 0;
        double sumY = 0;
        for (GridCoordinate coord : coords) {
            sumX += coord.x();
            sumY += coord.y();
        }
        return new Centroid(sumX / coords.size(), sumY / coords.size());
    }

    /**
     * Simple record to hold centroid coordinates.
     */
    private record Centroid(double x, double y) {
    }
}
