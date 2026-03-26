package com.lidar.controller;

import com.lidar.export.CsvExporter;
import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;
import com.lidar.processing.GridAggregator;
import com.lidar.processing.GridPartitioner;
import com.lidar.processing.StatisticsSummarizer;
import com.lidar.processing.SummaryStats;
import com.lidar.reader.PointCloudReader;
import com.lidar.validator.DataValidator;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class LidarController {

    public record ProcessResult(
            int totalCells,
            double avgCanopyHeight,
            double maxCanopyHeight,
            int totalPoints,
            long highRiskZoneCount,
            String outputFile
    ) {}

    private final PointCloudReader reader = new PointCloudReader();
    private final DataValidator validator = new DataValidator();
    private final StatisticsSummarizer summarizer = new StatisticsSummarizer();
    private final CsvExporter exporter = new CsvExporter();

    // Holds the path of the last successfully generated output CSV
    private volatile Path lastOutputPath = null;

    @PostMapping("/process")
    public ResponseEntity<?> process(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "resolution", defaultValue = "1.0") double resolution
    ) {
        Path tempInput = null;
        try {
            // 1. Save uploaded file to a temp path
            tempInput = Files.createTempFile("lidar_input_", ".csv");
            file.transferTo(tempInput);

            // 2-3. Read and validate
            Stream<com.lidar.model.Point> points = reader.read(tempInput)
                    .filter(validator::isValid);

            // 4. Partition and aggregate
            GridPartitioner partitioner = new GridPartitioner(resolution);
            GridAggregator aggregator = new GridAggregator(partitioner);
            Map<GridCoordinate, GridCell> grid = aggregator.aggregate(points);

            // 5. Summarize
            SummaryStats stats = summarizer.summarize(grid);

            // 6. Export output CSV alongside the temp input
            Path outputPath = tempInput.resolveSibling("output.csv");
            exporter.export(grid, outputPath);
            lastOutputPath = outputPath;

            // 7. Return result
            ProcessResult result = new ProcessResult(
                    stats.totalCells(),
                    stats.avgCanopyHeight(),
                    stats.maxCanopyHeight(),
                    stats.totalPoints(),
                    stats.highRiskZoneCount(),
                    outputPath.toString()
            );
            return ResponseEntity.ok(result);

        } catch (IOException e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Processing failed: " + e.getMessage());
        } finally {
            // Delete temp input file
            if (tempInput != null) {
                try {
                    Files.deleteIfExists(tempInput);
                } catch (IOException ignored) {}
            }
        }
    }

    @GetMapping("/result")
    public ResponseEntity<?> getResult() {
        if (lastOutputPath == null || !Files.exists(lastOutputPath)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body("No result available yet. Run POST /api/process first.");
        }

        try {
            byte[] csvBytes = Files.readAllBytes(lastOutputPath);
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType("text/csv"))
                    .header("Content-Disposition",
                            "attachment; filename=\"output.csv\"")
                    .body(csvBytes);
        } catch (IOException e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to read output file: " + e.getMessage());
        }
    }
}
