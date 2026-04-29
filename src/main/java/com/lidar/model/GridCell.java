package com.lidar.model;

public class GridCell {

    private final int gridX;
    private final int gridY;

    private double minZ;
    private double maxZ;
    private double sumZ;
    private int pointCount;

    private int groundPoints;
    private int vegetationPoints;
    private int buildingPoints;
    private int rockPoints;

    public GridCell(int gridX, int gridY) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.minZ = Double.MAX_VALUE;
        this.maxZ = Double.MIN_VALUE;
        this.sumZ = 0.0;
        this.pointCount = 0;
        this.groundPoints = 0;
        this.vegetationPoints = 0;
        this.buildingPoints = 0;
        this.rockPoints = 0;
    }

    /**
     * Incrementally adds a point's Z value and type to this cell.
     * On the first point, both minZ and maxZ are set to z.
     */
    public void addPoint(double z, int type) {
        if (pointCount == 0) {
            minZ = z;
            maxZ = z;
        } else {
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
        }
        sumZ += z;
        pointCount++;

        if (type == 1) groundPoints++;
        else if (type == 2) vegetationPoints++;
        else if (type == 3) buildingPoints++;
        else if (type == 4) rockPoints++;
    }

    // --- Derived getters ---

    public double getCanopyHeight() {
        return maxZ - minZ;
    }

    public double getAvgZ() {
        return sumZ / pointCount;
    }

    public int getPointDensity() {
        return pointCount;
    }

    public String getDominantType() {
        if (pointCount == 0) return "Unknown";
        
        int max = Math.max(Math.max(groundPoints, vegetationPoints), 
                           Math.max(buildingPoints, rockPoints));
                           
        if (max == 0) return "Unknown";
        
        if (max == groundPoints) return "Ground";
        if (max == vegetationPoints) return "Vegetation";
        if (max == buildingPoints) return "Building";
        return "Rock";
    }

    public double getVegetationPercent() {
        if (pointCount == 0) return 0.0;
        return (vegetationPoints * 100.0) / pointCount;
    }

    public double getBuiltPercent() {
        if (pointCount == 0) return 0.0;
        return (buildingPoints * 100.0) / pointCount;
    }

    public String getRiskLevel() {
        if (pointCount == 0) return "NORMAL";
        
        double vegPercent = getVegetationPercent();
        double builtPercent = getBuiltPercent();
        double groundPercent = (groundPoints * 100.0) / pointCount;
        double canopy = getCanopyHeight();
        double avgElevation = getAvgZ();
        
        // URBAN: significant building presence
        if (builtPercent > 30.0) return "URBAN_ZONE";
        
        // FIRE RISK: dense vegetation in mid-elevation dry zone
        // Mid elevation forest (not too high = snow, not too low = wet)
        if (vegPercent > 50.0 
            && canopy > 5.0 
            && avgElevation > 400 
            && avgElevation < 700) return "FIRE_RISK";
        
        // LANDSLIDE: steep terrain with dominant ground/rock
        // High canopy variance on steep slope
        if (canopy > 25.0 
            && groundPercent + getRockPercent() > 50.0) 
            return "LANDSLIDE_RISK";
        
        // LANDSLIDE: very high elevation rocky terrain
        if (avgElevation > 650 
            && getRockPercent() > 30.0) 
            return "LANDSLIDE_RISK";
        
        return "NORMAL";
    }

    private double getRockPercent() {
        if (pointCount == 0) return 0.0;
        return (rockPoints * 100.0) / pointCount;
    }

    // --- Field getters ---

    public int getGridX() {
        return gridX;
    }

    public int getGridY() {
        return gridY;
    }

    public double getMinZ() {
        return minZ;
    }

    public double getMaxZ() {
        return maxZ;
    }

    public double getSumZ() {
        return sumZ;
    }

    public int getPointCount() {
        return pointCount;
    }

    public int getGroundPoints() {
        return groundPoints;
    }

    public int getVegetationPoints() {
        return vegetationPoints;
    }

    public int getBuildingPoints() {
        return buildingPoints;
    }

    public int getRockPoints() {
        return rockPoints;
    }
}
