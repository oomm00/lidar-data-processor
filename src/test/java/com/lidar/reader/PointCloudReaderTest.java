package com.lidar.reader;

import com.lidar.model.Point;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

class PointCloudReaderTest {

    private final PointCloudReader reader = new PointCloudReader();

    @Test
    void readsValidLinesWithHeader(@TempDir Path tmp) throws IOException {
        Path csv = tmp.resolve("data.csv");
        Files.writeString(csv, "x,y,z,type\n1.0,2.0,3.0,1\n4.0,5.0,6.0,2\n");

        try (Stream<Point> stream = reader.read(csv)) {
            List<Point> points = stream.toList();
            assertEquals(2, points.size());
            assertEquals(new Point(1.0, 2.0, 3.0, 1), points.get(0));
            assertEquals(new Point(4.0, 5.0, 6.0, 2), points.get(1));
        }
    }

    @Test
    void readsValidLinesWithoutHeader(@TempDir Path tmp) throws IOException {
        Path csv = tmp.resolve("data.csv");
        Files.writeString(csv, "1.0,2.0,3.0,1\n4.0,5.0,6.0,2\n");

        try (Stream<Point> stream = reader.read(csv)) {
            List<Point> points = stream.toList();
            assertEquals(2, points.size());
        }
    }

    @Test
    void skipsUnparseableLine(@TempDir Path tmp) throws IOException {
        Path csv = tmp.resolve("data.csv");
        Files.writeString(csv, "x,y,z,type\n1.0,2.0,3.0,1\nbad,line,here\n7.0,8.0,9.0,3\n");

        try (Stream<Point> stream = reader.read(csv)) {
            List<Point> points = stream.toList();
            assertEquals(2, points.size());
            assertEquals(new Point(1.0, 2.0, 3.0, 1), points.get(0));
            assertEquals(new Point(7.0, 8.0, 9.0, 3), points.get(1));
        }
    }

    @Test
    void skipsLineWithTooFewTokens(@TempDir Path tmp) throws IOException {
        Path csv = tmp.resolve("data.csv");
        Files.writeString(csv, "x,y,z,type\n1.0,2.0,3.0\n4.0,5.0,6.0,2\n");

        try (Stream<Point> stream = reader.read(csv)) {
            List<Point> points = stream.toList();
            assertEquals(1, points.size());
            assertEquals(new Point(4.0, 5.0, 6.0, 2), points.get(0));
        }
    }

    @Test
    void emptyFileReturnsEmptyStream(@TempDir Path tmp) throws IOException {
        Path csv = tmp.resolve("empty.csv");
        Files.writeString(csv, "");

        try (Stream<Point> stream = reader.read(csv)) {
            assertEquals(0, stream.toList().size());
        }
    }

    @Test
    void headerOnlyFileReturnsEmptyStream(@TempDir Path tmp) throws IOException {
        Path csv = tmp.resolve("header.csv");
        Files.writeString(csv, "x,y,z,type\n");

        try (Stream<Point> stream = reader.read(csv)) {
            assertEquals(0, stream.toList().size());
        }
    }
}
