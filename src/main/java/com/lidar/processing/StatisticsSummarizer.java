package com.lidar.processing;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;

import java.util.*;

public class StatisticsSummarizer {

    private static final int[][] DIRECTIONS = {{0, 1}, {0, -1}, {1, 0}, {-1, 0}};

    public SummaryStats summarize(Map<GridCoordinate, GridCell> grid) {
        if (grid.isEmpty()) {
            return new SummaryStats(0, 0.0, 0.0, 0, 0L, 0, 0, 0);
        }

        // Basic aggregate stats
        int totalCells = grid.size();
        double totalCanopy = 0.0;
        double maxCanopyHeight = Double.MIN_VALUE;
        int totalPoints = 0;

        // Build a map from coordinate to risk level for non-NORMAL cells
        Map<GridCoordinate, String> riskMap = new HashMap<>();

        for (Map.Entry<GridCoordinate, GridCell> entry : grid.entrySet()) {
            GridCell cell = entry.getValue();
            double canopy = cell.getCanopyHeight();
            totalCanopy += canopy;
            if (canopy > maxCanopyHeight) maxCanopyHeight = canopy;
            totalPoints += cell.getPointDensity();

            String risk = cell.getRiskLevel();
            if (!"NORMAL".equals(risk)) {
                riskMap.put(entry.getKey(), risk);
            }
        }

        double avgCanopyHeight = totalCanopy / totalCells;

        // BFS to find connected risk zones
        Set<GridCoordinate> visited = new HashSet<>();
        long totalRiskZones = 0;
        int fireRiskZones = 0;
        int landslideZones = 0;
        int urbanZones = 0;

        for (Map.Entry<GridCoordinate, String> entry : riskMap.entrySet()) {
            GridCoordinate start = entry.getKey();
            if (visited.contains(start)) continue;

            // BFS — flood fill from this cell to all connected cells
            // sharing the same risk level
            String zoneRisk = entry.getValue();
            Queue<GridCoordinate> queue = new ArrayDeque<>();
            queue.add(start);
            visited.add(start);

            while (!queue.isEmpty()) {
                GridCoordinate current = queue.poll();
                for (int[] dir : DIRECTIONS) {
                    GridCoordinate neighbor = new GridCoordinate(
                            current.x() + dir[0],
                            current.y() + dir[1]
                    );
                    if (!visited.contains(neighbor)
                            && zoneRisk.equals(riskMap.get(neighbor))) {
                        visited.add(neighbor);
                        queue.add(neighbor);
                    }
                }
            }

            totalRiskZones++;
            switch (zoneRisk) {
                case "FIRE_RISK" -> fireRiskZones++;
                case "LANDSLIDE_RISK" -> landslideZones++;
                case "URBAN_ZONE" -> urbanZones++;
            }
        }

        return new SummaryStats(
                totalCells, avgCanopyHeight, maxCanopyHeight,
                totalPoints, totalRiskZones,
                fireRiskZones, landslideZones, urbanZones
        );
    }
}
