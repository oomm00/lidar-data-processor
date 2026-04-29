package com.lidar.export;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

public class CsvExporter {

    private static final String HEADER =
            "grid_x,grid_y,min_height,max_height,canopy_height,avg_height,point_density,ground_points,vegetation_points,building_points,rock_points,dominant_type,vegetation_percent,built_percent,risk_level";

    public void export(Map<GridCoordinate, GridCell> grid, Path outputPath) throws IOException {
        try (BufferedWriter writer = Files.newBufferedWriter(outputPath)) {
            writer.write(HEADER);
            writer.newLine();

            for (Map.Entry<GridCoordinate, GridCell> entry : grid.entrySet()) {
                GridCell cell = entry.getValue();
                String line = String.format("%d,%d,%.4f,%.4f,%.4f,%.4f,%d,%d,%d,%d,%d,%s,%.2f,%.2f,%s",
                        cell.getGridX(),
                        cell.getGridY(),
                        cell.getMinZ(),
                        cell.getMaxZ(),
                        cell.getCanopyHeight(),
                        cell.getAvgZ(),
                        cell.getPointDensity(),
                        cell.getGroundPoints(),
                        cell.getVegetationPoints(),
                        cell.getBuildingPoints(),
                        cell.getRockPoints(),
                        cell.getDominantType(),
                        cell.getVegetationPercent(),
                        cell.getBuiltPercent(),
                        cell.getRiskLevel()
                );
                writer.write(line);
                writer.newLine();
            }
        }
    }
}
