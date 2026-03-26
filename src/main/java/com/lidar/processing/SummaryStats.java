package com.lidar.processing;

public record SummaryStats(
        int totalCells,
        double avgCanopyHeight,
        double maxCanopyHeight,
        int totalPoints,
        long highRiskZoneCount
) {
}
