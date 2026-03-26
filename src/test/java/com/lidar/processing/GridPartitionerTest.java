package com.lidar.processing;

import com.lidar.model.GridCoordinate;
import com.lidar.model.Point;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class GridPartitionerTest {

    @Test
    void exactCellBoundaryGoesIntoCurrentCell() {
        GridPartitioner p = new GridPartitioner(1.0);
        // x=2.0 → floor(2.0/1.0)=2, y=3.0 → floor(3.0/1.0)=3
        assertEquals(new GridCoordinate(2, 3), p.partition(new Point(2.0, 3.0, 0.0)));
    }

    @Test
    void midCellPointMapsCorrectly() {
        GridPartitioner p = new GridPartitioner(1.0);
        // x=2.7 → floor(2.7)=2, y=3.9 → floor(3.9)=3
        assertEquals(new GridCoordinate(2, 3), p.partition(new Point(2.7, 3.9, 0.0)));
    }

    @Test
    void negativeCoordinatesUseFloorNotCast() {
        GridPartitioner p = new GridPartitioner(1.0);
        // (int)(-0.5) == 0, but Math.floor(-0.5) == -1 → gridX must be -1
        assertEquals(new GridCoordinate(-1, -1), p.partition(new Point(-0.5, -0.1, 0.0)));
    }

    @Test
    void largerCellSize() {
        GridPartitioner p = new GridPartitioner(5.0);
        // x=12.3 → floor(12.3/5.0)=floor(2.46)=2
        // y=7.9  → floor(7.9/5.0)=floor(1.58)=1
        assertEquals(new GridCoordinate(2, 1), p.partition(new Point(12.3, 7.9, 0.0)));
    }

    @Test
    void zeroPointAlwaysGridOrigin() {
        GridPartitioner p = new GridPartitioner(1.0);
        assertEquals(new GridCoordinate(0, 0), p.partition(new Point(0.0, 0.0, 0.0)));
    }
}
