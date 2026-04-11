package com.lidar.export;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CsvExporterTest {

    private final CsvExporter exporter = new CsvExporter();

    private GridCell cellWith(int gx, int gy, double... zValues) {
        GridCell cell = new GridCell(gx, gy);
        for (double z : zValues) cell.addPoint(z, 1);
        return cell;
    }

    @Test
    void headerIsWrittenOnFirstLine(@TempDir Path tmp) throws IOException {
        Path out = tmp.resolve("out.csv");
        exporter.export(Map.of(), out);
        List<String> lines = Files.readAllLines(out);
        assertEquals("grid_x,grid_y,min_height,max_height,canopy_height,avg_height,point_density,ground_points,vegetation_points,building_points,rock_points,dominant_type,vegetation_percent,built_percent,risk_level",
                lines.get(0));
    }

    @Test
    void emptyGridWritesOnlyHeader(@TempDir Path tmp) throws IOException {
        Path out = tmp.resolve("out.csv");
        exporter.export(Map.of(), out);
        assertEquals(1, Files.readAllLines(out).size());
    }

    @Test
    void singleCellFormattedCorrectly(@TempDir Path tmp) throws IOException {
        Path out = tmp.resolve("out.csv");
        GridCell cell = cellWith(2, 3, 4.0, 8.0);  // min=4, max=8, canopy=4, avg=6, count=2
        Map<GridCoordinate, GridCell> grid = Map.of(new GridCoordinate(2, 3), cell);

        exporter.export(grid, out);

        List<String> lines = Files.readAllLines(out);
        assertEquals(2, lines.size());
        assertEquals("2,3,4.0000,8.0000,4.0000,6.0000,2,2,0,0,0,Ground,0.0000,0.0000,NORMAL", lines.get(1));
    }

    @Test
    void doublesFormattedToFourDecimalPlaces(@TempDir Path tmp) throws IOException {
        Path out = tmp.resolve("out.csv");
        GridCell cell = cellWith(0, 0, 1.0, 2.0, 3.0);  // avg = 2.0, canopy = 2.0
        exporter.export(Map.of(new GridCoordinate(0, 0), cell), out);

        String dataLine = Files.readAllLines(out).get(1);
        // All double fields must have exactly 4 decimal places
        String[] parts = dataLine.split(",");
        for (int i : new int[]{2, 3, 4, 5, 12, 13}) {
            assertTrue(parts[i].matches("-?\\d+\\.\\d{4}"),
                    "Field " + i + " should have 4 decimal places: " + parts[i]);
        }
    }

    @Test
    void multipleCellsAllWritten(@TempDir Path tmp) throws IOException {
        Path out = tmp.resolve("out.csv");
        // Use LinkedHashMap to guarantee insertion order in test assertions
        Map<GridCoordinate, GridCell> grid = new LinkedHashMap<>();
        grid.put(new GridCoordinate(0, 0), cellWith(0, 0, 5.0));
        grid.put(new GridCoordinate(1, 0), cellWith(1, 0, 10.0));
        grid.put(new GridCoordinate(0, 1), cellWith(0, 1, 15.0));

        exporter.export(grid, out);

        List<String> lines = Files.readAllLines(out);
        assertEquals(4, lines.size()); // 1 header + 3 data rows
    }
}
