package com.lidar.processing;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;
import com.lidar.model.Point;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

class GridAggregatorTest {

    private final GridPartitioner partitioner = new GridPartitioner(1.0);
    private final GridAggregator aggregator = new GridAggregator(partitioner);

    @Test
    void singlePointCreatesOneCell() {
        Map<GridCoordinate, GridCell> result = aggregator.aggregate(
                Stream.of(new Point(0.5, 0.5, 10.0))
        );
        assertEquals(1, result.size());
        GridCell cell = result.get(new GridCoordinate(0, 0));
        assertNotNull(cell);
        assertEquals(1, cell.getPointCount());
        assertEquals(10.0, cell.getAvgZ());
    }

    @Test
    void twoPointsSameCellAccumulatesCorrectly() {
        Map<GridCoordinate, GridCell> result = aggregator.aggregate(
                Stream.of(
                        new Point(0.1, 0.1, 4.0),
                        new Point(0.9, 0.9, 8.0)
                )
        );
        assertEquals(1, result.size());
        GridCell cell = result.get(new GridCoordinate(0, 0));
        assertEquals(2, cell.getPointCount());
        assertEquals(4.0, cell.getMinZ());
        assertEquals(8.0, cell.getMaxZ());
        assertEquals(6.0, cell.getAvgZ());
        assertEquals(4.0, cell.getCanopyHeight()); // 8 - 4
    }

    @Test
    void pointsInDifferentCellsCreateMultipleCells() {
        Map<GridCoordinate, GridCell> result = aggregator.aggregate(
                Stream.of(
                        new Point(0.5, 0.5, 1.0),
                        new Point(1.5, 0.5, 2.0),
                        new Point(0.5, 1.5, 3.0)
                )
        );
        assertEquals(3, result.size());
        assertTrue(result.containsKey(new GridCoordinate(0, 0)));
        assertTrue(result.containsKey(new GridCoordinate(1, 0)));
        assertTrue(result.containsKey(new GridCoordinate(0, 1)));
    }

    @Test
    void emptyStreamReturnsEmptyMap() {
        Map<GridCoordinate, GridCell> result = aggregator.aggregate(Stream.empty());
        assertTrue(result.isEmpty());
    }

    @Test
    void returnedMapIsUnmodifiable() {
        Map<GridCoordinate, GridCell> result = aggregator.aggregate(
                Stream.of(new Point(0.5, 0.5, 5.0))
        );
        assertThrows(UnsupportedOperationException.class,
                () -> result.put(new GridCoordinate(99, 99), new GridCell(99, 99)));
    }
}
