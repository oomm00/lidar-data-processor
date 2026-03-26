package com.lidar.model;

public class GridCell {

    private final int gridX;
    private final int gridY;

    private double minZ;
    private double maxZ;
    private double sumZ;
    private int pointCount;

    public GridCell(int gridX, int gridY) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.minZ = Double.MAX_VALUE;
        this.maxZ = Double.MIN_VALUE;
        this.sumZ = 0.0;
        this.pointCount = 0;
    }

    /**
     * Incrementally adds a point's Z value to this cell.
     * On the first point, both minZ and maxZ are set to z.
     */
    public void addPoint(double z) {
        if (pointCount == 0) {
            minZ = z;
            maxZ = z;
        } else {
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
        }
        sumZ += z;
        pointCount++;
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
}
