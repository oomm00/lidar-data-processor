package com.lidar.processing;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class StatisticsSummarizerTest {

    private final StatisticsSummarizer summarizer = new StatisticsSummarizer();

    private GridCell cellWith(int gx, int gy, double... zValues) {
        GridCell cell = new GridCell(gx, gy);
        for (double z : zValues) cell.addPoint(z);
        return cell;
    }

    @Test
    void emptyGridReturnsZeroStats() {
        SummaryStats stats = summarizer.summarize(Map.of());
        assertEquals(0, stats.totalCells());
        assertEquals(0.0, stats.avgCanopyHeight());
        assertEquals(0.0, stats.maxCanopyHeight());
        assertEquals(0, stats.totalPoints());
        assertEquals(0L, stats.highRiskZoneCount());
    }

    @Test
    void singleCellStats() {
        // min=2, max=12 → canopy=10, avg=7, density=2
        GridCell cell = cellWith(0, 0, 2.0, 12.0);
        SummaryStats stats = summarizer.summarize(
                Map.of(new GridCoordinate(0, 0), cell)
        );
        assertEquals(1, stats.totalCells());
        assertEquals(10.0, stats.avgCanopyHeight(), 1e-9);
        assertEquals(10.0, stats.maxCanopyHeight(), 1e-9);
        assertEquals(2, stats.totalPoints());
        assertEquals(0L, stats.highRiskZoneCount()); // canopy == 10.0, NOT > 10.0
    }

    @Test
    void highRiskZoneCountOnlyAboveThreshold() {
        // canopy = 10.0 → NOT high risk (must be strictly > 10.0)
        GridCell notRisk  = cellWith(0, 0, 0.0, 10.0);   // canopy = 10.0
        // canopy = 10.1 → IS high risk
        GridCell isRisk   = cellWith(1, 0, 0.0, 10.1);   // canopy = 10.1

        Map<GridCoordinate, GridCell> grid = Map.of(
                new GridCoordinate(0, 0), notRisk,
                new GridCoordinate(1, 0), isRisk
        );
        SummaryStats stats = summarizer.summarize(grid);
        assertEquals(1L, stats.highRiskZoneCount());
    }

    @Test
    void totalPointsIsSumOfAllDensities() {
        GridCell a = cellWith(0, 0, 1.0, 2.0, 3.0);   // 3 points
        GridCell b = cellWith(1, 0, 4.0, 5.0);         // 2 points
        Map<GridCoordinate, GridCell> grid = Map.of(
                new GridCoordinate(0, 0), a,
                new GridCoordinate(1, 0), b
        );
        assertEquals(5, summarizer.summarize(grid).totalPoints());
    }

    @Test
    void avgCanopyHeightIsAverageAcrossCells() {
        // cell A: canopy = 10 (min=0, max=10)
        GridCell a = cellWith(0, 0, 0.0, 10.0);
        // cell B: canopy = 20 (min=0, max=20)
        GridCell b = cellWith(1, 0, 0.0, 20.0);
        Map<GridCoordinate, GridCell> grid = Map.of(
                new GridCoordinate(0, 0), a,
                new GridCoordinate(1, 0), b
        );
        SummaryStats stats = summarizer.summarize(grid);
        assertEquals(15.0, stats.avgCanopyHeight(), 1e-9);
        assertEquals(20.0, stats.maxCanopyHeight(), 1e-9);
    }
}
