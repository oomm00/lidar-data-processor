package com.lidar.reader;

import com.lidar.model.Point;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;

public class PointCloudReader {

    /**
     * Reads a CSV file line by line and returns a lazy Stream<Point>.
     * The first line is skipped if its first token is non-numeric (i.e. a header).
     * Lines that cannot be parsed are logged to System.err and skipped.
     *
     * @param filePath path to the CSV file
     * @return a Stream<Point> — caller is responsible for closing it (try-with-resources)
     * @throws IOException if the file cannot be opened
     */
    public Stream<Point> read(Path filePath) throws IOException {
        BufferedReader reader = Files.newBufferedReader(filePath);

        Stream<String> lines = reader.lines().onClose(() -> {
            try {
                reader.close();
            } catch (IOException e) {
                System.err.println("[PointCloudReader] Warning: failed to close reader: " + e.getMessage());
            }
        });

        // Peek at the first line to decide whether to skip the header.
        // We do this by wrapping the stream; use a one-element boolean flag.
        boolean[] firstLine = {true};
        boolean[] skipHeader = {false};

        return lines.filter(line -> {
            if (firstLine[0]) {
                firstLine[0] = false;
                String trimmed = line.trim();
                if (trimmed.isEmpty()) return false;
                // If the first token is not parseable as a double, treat it as a header.
                String firstToken = trimmed.split(",")[0].trim();
                try {
                    Double.parseDouble(firstToken);
                    // First token is numeric — not a header, parse this line normally.
                } catch (NumberFormatException e) {
                    skipHeader[0] = true;
                    return false; // drop the header line
                }
            }
            return true;
        }).flatMap(line -> {
            Point point = parseLine(line);
            return point != null ? Stream.of(point) : Stream.empty();
        });
    }

    private Point parseLine(String line) {
        String trimmed = line.trim();
        if (trimmed.isEmpty()) return null;

        String[] tokens = trimmed.split(",");
        if (tokens.length < 4) {
            System.err.println("[PointCloudReader] Warning: skipping malformed line (expected 4 fields): " + line);
            return null;
        }

        try {
            double x = Double.parseDouble(tokens[0].trim());
            double y = Double.parseDouble(tokens[1].trim());
            double z = Double.parseDouble(tokens[2].trim());
            int type = Integer.parseInt(tokens[3].trim());
            return new Point(x, y, z, type);
        } catch (NumberFormatException e) {
            System.err.println("[PointCloudReader] Warning: skipping unparseable line: " + line);
            return null;
        }
    }
}
