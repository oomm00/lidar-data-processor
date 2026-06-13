package com.lidar.processing;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;

import java.util.Map;

public class SuitabilityScorer {

    // Tunable constants for agriculture elevation preference
    private static final double AGRICULTURE_MIN_ELEVATION = 200.0;
    private static final double AGRICULTURE_MAX_ELEVATION = 500.0;
    private static final double AGRICULTURE_OPTIMAL_ELEVATION = 350.0;

    /**
     * Computes three suitability scores (construction, agriculture, solar) for each cell.
     * Each score is normalized to 0-100 where 100 = ideal suitability.
     *
     * @param grid The grid map with terrain and vegetation data
     * @return The same grid map (cells are mutated in place with scores)
     */
    public Map<GridCoordinate, GridCell> computeSuitability(Map<GridCoordinate, GridCell> grid) {
        for (GridCell cell : grid.values()) {
            double constructionScore = computeConstructionScore(cell);
            double agricultureScore = computeAgricultureScore(cell);
            double solarScore = computeSolarScore(cell);

            cell.setConstructionScore(constructionScore);
            cell.setAgricultureScore(agricultureScore);
            cell.setSolarScore(solarScore);
        }
        return grid;
    }

    /**
     * Construction suitability: flat, stable, low risk, minimal vegetation.
     */
    private double computeConstructionScore(GridCell cell) {
        double score = 100.0;

        String riskLevel = cell.getRiskLevel();
        String dominantType = cell.getDominantType();
        double maxSlope = cell.getMaxSlope();
        double canopyHeight = cell.getCanopyHeight();

        // Heavy penalty for high-risk areas
        if ("LANDSLIDE_RISK".equals(riskLevel) || "FIRE_RISK".equals(riskLevel)) {
            score = Math.min(score, 10.0); // Cap at 10 for dangerous areas
        }

        // Moderate penalty for urban zones (already developed)
        if ("URBAN_ZONE".equals(riskLevel)) {
            score -= 20.0;
        }

        // Penalty for slope (steeper = more expensive foundation work)
        score -= maxSlope * 1.5;

        // Penalty for canopy height (clearing cost)
        score -= canopyHeight * 0.8;

        // Bonus for stable ground types
        if ("Ground".equals(dominantType)) {
            score += 10.0;
        } else if ("Rock".equals(dominantType)) {
            score += 5.0; // Rock is stable but harder to excavate
        } else if ("Vegetation".equals(dominantType)) {
            score -= 10.0; // More clearing needed
        }

        return clamp(score, 0.0, 100.0);
    }

    /**
     * Agriculture suitability: moderate slope, ground-based, temperate elevation, some vegetation.
     */
    private double computeAgricultureScore(GridCell cell) {
        double score = 100.0;

        String riskLevel = cell.getRiskLevel();
        String dominantType = cell.getDominantType();
        double maxSlope = cell.getMaxSlope();
        double vegPercent = cell.getVegetationPercent();
        double avgElevation = cell.getAvgZ();
        double builtPercent = cell.getBuiltPercent();

        // Heavy penalty for fire risk areas
        if ("FIRE_RISK".equals(riskLevel)) {
            score -= 60.0;
        }

        // Moderate penalty for landslide risk
        if ("LANDSLIDE_RISK".equals(riskLevel)) {
            score -= 40.0;
        }

        // Strong penalty for urban areas (no farming in cities)
        if ("URBAN_ZONE".equals(riskLevel) || builtPercent > 30.0) {
            score -= 70.0;
        }

        // Penalty for slope > 15 degrees (difficult for machinery)
        if (maxSlope > 15.0) {
            score -= (maxSlope - 15.0) * 2.5;
        }

        // Favor ground-based terrain
        if ("Ground".equals(dominantType)) {
            score += 20.0;
        } else if ("Vegetation".equals(dominantType)) {
            score += 5.0; // Some natural vegetation is good
        } else if ("Rock".equals(dominantType)) {
            score -= 30.0; // Rocky soil is poor for crops
        } else if ("Building".equals(dominantType)) {
            score -= 50.0;
        }

        // Favor moderate vegetation (10-40%) - indicates decent soil
        if (vegPercent >= 10.0 && vegPercent <= 40.0) {
            score += 15.0;
        } else if (vegPercent > 70.0) {
            score -= 20.0; // Too dense, clearing needed
        } else if (vegPercent < 5.0) {
            score -= 10.0; // Barren might indicate poor soil
        }

        // Favor temperate elevation range
        double elevationScore = computeElevationScore(avgElevation);
        score += elevationScore;

        return clamp(score, 0.0, 100.0);
    }

    /**
     * Solar farm suitability: flat, open, unshaded, low vegetation.
     */
    private double computeSolarScore(GridCell cell) {
        double score = 100.0;

        String dominantType = cell.getDominantType();
        double maxSlope = cell.getMaxSlope();
        double canopyHeight = cell.getCanopyHeight();
        double builtPercent = cell.getBuiltPercent();
        double vegPercent = cell.getVegetationPercent();

        // Strong preference for flat terrain (easier installation, better panel angle control)
        if (maxSlope < 5.0) {
            score += 10.0; // Bonus for very flat
        } else if (maxSlope < 10.0) {
            score -= 5.0; // Minor penalty
        } else {
            score -= maxSlope * 1.2; // Increasing penalty for steeper slopes
        }

        // Heavy penalty for canopy height (shading reduces efficiency dramatically)
        score -= canopyHeight * 1.5;

        // Penalty for high built percentage (no room for panels)
        if (builtPercent > 50.0) {
            score -= 40.0;
        } else if (builtPercent > 20.0) {
            score -= builtPercent * 0.5;
        }

        // Penalty for vegetation (shading and maintenance issues)
        if (vegPercent > 50.0) {
            score -= vegPercent * 0.6;
        } else if (vegPercent > 30.0) {
            score -= vegPercent * 0.3;
        }

        // Bonus for open ground
        if ("Ground".equals(dominantType) && vegPercent < 20.0) {
            score += 15.0;
        } else if ("Rock".equals(dominantType)) {
            score += 5.0; // Rock is stable but may need more prep
        }

        return clamp(score, 0.0, 100.0);
    }

    /**
     * Compute elevation suitability for agriculture.
     * Returns a score contribution from -30 to +20.
     */
    private double computeElevationScore(double elevation) {
        if (elevation >= AGRICULTURE_MIN_ELEVATION && elevation <= AGRICULTURE_MAX_ELEVATION) {
            // Within optimal range - compute how close to optimal center
            double distanceFromOptimal = Math.abs(elevation - AGRICULTURE_OPTIMAL_ELEVATION);
            double maxDistance = AGRICULTURE_MAX_ELEVATION - AGRICULTURE_MIN_ELEVATION;
            // Scale: 0 distance = +20 bonus, max distance = +5 bonus
            return 20.0 - (distanceFromOptimal / maxDistance) * 15.0;
        } else if (elevation < AGRICULTURE_MIN_ELEVATION) {
            // Too low - might be prone to flooding or too hot
            double deviation = AGRICULTURE_MIN_ELEVATION - elevation;
            return Math.max(-30.0, -deviation * 0.15);
        } else {
            // Too high - might be too cold or have short growing season
            double deviation = elevation - AGRICULTURE_MAX_ELEVATION;
            return Math.max(-30.0, -deviation * 0.10);
        }
    }

    /**
     * Clamp a value between min and max.
     */
    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }
}
