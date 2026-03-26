package com.lidar.processing;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;

import java.util.Collection;
import java.util.Map;

public class StatisticsSummarizer {

    private static final double HIGH_RISK_THRESHOLD = 10.0;

    public SummaryStats summarize(Map<GridCoordinate, GridCell> grid) {
        if (grid.isEmpty()) {
            return new SummaryStats(0, 0.0, 0.0, 0, 0L);
        }

        Collection<GridCell> cells = grid.values();

        int totalCells = grid.size();
        double totalCanopy = 0.0;
        double maxCanopyHeight = Double.MIN_VALUE;
        int totalPoints = 0;
        long highRiskZoneCount = 0L;

        for (GridCell cell : cells) {
            double canopy = cell.getCanopyHeight();
            totalCanopy += canopy;
            if (canopy > maxCanopyHeight) maxCanopyHeight = canopy;
            totalPoints += cell.getPointDensity();
            if (canopy > HIGH_RISK_THRESHOLD) highRiskZoneCount++;
        }

        double avgCanopyHeight = totalCanopy / totalCells;

        return new SummaryStats(totalCells, avgCanopyHeight, maxCanopyHeight, totalPoints, highRiskZoneCount);
    }
}
