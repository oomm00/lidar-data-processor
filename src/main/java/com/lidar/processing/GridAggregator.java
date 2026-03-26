package com.lidar.processing;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;
import com.lidar.model.Point;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Stream;

public class GridAggregator {

    private final GridPartitioner partitioner;

    public GridAggregator(GridPartitioner partitioner) {
        this.partitioner = partitioner;
    }

    public Map<GridCoordinate, GridCell> aggregate(Stream<Point> points) {
        HashMap<GridCoordinate, GridCell> map = new HashMap<>();

        try (points) {
            points.forEach(point -> {
                GridCoordinate coord = partitioner.partition(point);
                GridCell cell = map.computeIfAbsent(
                        coord,
                        c -> new GridCell(c.x(), c.y())
                );
                cell.addPoint(point.z());
            });
        }

        return Collections.unmodifiableMap(map);
    }
}
