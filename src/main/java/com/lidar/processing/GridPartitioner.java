package com.lidar.processing;

import com.lidar.model.GridCoordinate;
import com.lidar.model.Point;

public class GridPartitioner {

    private final double resolution;

    public GridPartitioner(double resolution) {
        this.resolution = resolution;
    }

    public GridCoordinate partition(Point point) {
        int gridX = (int) Math.floor(point.x() / resolution);
        int gridY = (int) Math.floor(point.y() / resolution);
        return new GridCoordinate(gridX, gridY);
    }
}
