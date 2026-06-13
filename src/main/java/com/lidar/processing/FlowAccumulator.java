package com.lidar.processing;

import com.lidar.model.GridCell;
import com.lidar.model.GridCoordinate;

import java.util.*;
import java.util.stream.Collectors;

public class FlowAccumulator {

    private static final int[][] DIRECTIONS_8 = {
            {0, 1},   // N
            {1, 1},   // NE
            {1, 0},   // E
            {1, -1},  // SE
            {0, -1},  // S
            {-1, -1}, // SW
            {-1, 0},  // W
            {-1, 1}   // NW
    };

    /**
     * Computes flow accumulation using D8 flow algorithm.
     * Each cell flows to its lowest neighbor.
     *
     * @param grid The grid map with elevation data
     * @return Map of GridCoordinate to flow accumulation value
     */
    public Map<GridCoordinate, Integer> computeFlowAccumulation(Map<GridCoordinate, GridCell> grid) {
        // Step 1: Build flow direction graph (each cell -> downstream cell)
        Map<GridCoordinate, GridCoordinate> flowDirection = new HashMap<>();
        
        for (Map.Entry<GridCoordinate, GridCell> entry : grid.entrySet()) {
            GridCoordinate coord = entry.getKey();
            GridCell cell = entry.getValue();
            
            GridCoordinate downstream = findDownstreamCell(coord, cell, grid);
            if (downstream != null) {
                flowDirection.put(coord, downstream);
            }
            // If downstream is null, this is a sink (local minimum)
        }

        // Step 2: Sort cells by DESCENDING elevation (highest first)
        List<Map.Entry<GridCoordinate, GridCell>> sortedCells = grid.entrySet()
                .stream()
                .sorted((e1, e2) -> Double.compare(e2.getValue().getAvgZ(), e1.getValue().getAvgZ()))
                .collect(Collectors.toList());

        // Step 3: Compute flow accumulation
        Map<GridCoordinate, Integer> accumulation = new HashMap<>();
        
        // Initialize all cells with accumulation = 1 (the cell itself)
        for (GridCoordinate coord : grid.keySet()) {
            accumulation.put(coord, 1);
        }

        // Process cells from highest to lowest elevation
        for (Map.Entry<GridCoordinate, GridCell> entry : sortedCells) {
            GridCoordinate coord = entry.getKey();
            GridCoordinate downstream = flowDirection.get(coord);
            
            if (downstream != null) {
                // Add this cell's accumulation to its downstream cell
                int currentAccumulation = accumulation.get(coord);
                accumulation.merge(downstream, currentAccumulation, Integer::sum);
            }
        }

        return accumulation;
    }

    /**
     * Detects cascade risk: cells in major drainage channels with upstream landslide risk.
     * Sets cascadeRisk flag on GridCell for high-risk drainage areas.
     *
     * @param grid The grid map
     * @param flowAccumulation The flow accumulation map from computeFlowAccumulation
     * @return The grid map (cells are mutated in place)
     */
    public Map<GridCoordinate, GridCell> detectCascadeRisk(
            Map<GridCoordinate, GridCell> grid,
            Map<GridCoordinate, Integer> flowAccumulation) {

        // Compute threshold: top 10% of accumulation values
        List<Integer> accumulationValues = new ArrayList<>(flowAccumulation.values());
        accumulationValues.sort(Collections.reverseOrder());
        
        int thresholdIndex = Math.max(0, (int) (accumulationValues.size() * 0.1));
        int threshold = accumulationValues.isEmpty() ? Integer.MAX_VALUE 
                : accumulationValues.get(Math.min(thresholdIndex, accumulationValues.size() - 1));

        // Build reverse flow graph (downstream -> upstream cells)
        Map<GridCoordinate, Set<GridCoordinate>> upstreamGraph = buildUpstreamGraph(grid);

        // For each cell with high accumulation, check if it has upstream landslide risk
        for (Map.Entry<GridCoordinate, Integer> entry : flowAccumulation.entrySet()) {
            GridCoordinate coord = entry.getKey();
            int accumValue = entry.getValue();
            GridCell cell = grid.get(coord);
            
            if (cell == null) continue;

            // Set flow accumulation on the cell
            cell.setFlowAccumulation(accumValue);

            // Check if this is a major drainage channel (high accumulation)
            if (accumValue >= threshold) {
                // Check if this cell or any upstream cell has landslide risk
                if (hasUpstreamLandslideRisk(coord, grid, upstreamGraph)) {
                    cell.setCascadeRisk(true);
                }
            }
        }

        return grid;
    }

    /**
     * Finds the downstream cell (lowest neighbor) for the given cell.
     * Returns null if the cell is a local minimum (sink).
     */
    private GridCoordinate findDownstreamCell(
            GridCoordinate coord, 
            GridCell cell, 
            Map<GridCoordinate, GridCell> grid) {

        double currentElevation = cell.getAvgZ();
        GridCoordinate lowestNeighbor = null;
        double lowestElevation = currentElevation;

        for (int[] dir : DIRECTIONS_8) {
            GridCoordinate neighbor = new GridCoordinate(
                    coord.x() + dir[0],
                    coord.y() + dir[1]
            );

            GridCell neighborCell = grid.get(neighbor);
            if (neighborCell == null) {
                continue; // Skip missing neighbors at boundaries
            }

            double neighborElevation = neighborCell.getAvgZ();
            if (neighborElevation < lowestElevation) {
                lowestElevation = neighborElevation;
                lowestNeighbor = neighbor;
            }
        }

        return lowestNeighbor; // null if this cell is the lowest (sink)
    }

    /**
     * Builds a reverse flow graph: maps each cell to all cells that flow into it.
     */
    private Map<GridCoordinate, Set<GridCoordinate>> buildUpstreamGraph(
            Map<GridCoordinate, GridCell> grid) {

        Map<GridCoordinate, Set<GridCoordinate>> upstreamGraph = new HashMap<>();

        for (Map.Entry<GridCoordinate, GridCell> entry : grid.entrySet()) {
            GridCoordinate coord = entry.getKey();
            GridCell cell = entry.getValue();

            // Find downstream cell for this cell
            GridCoordinate downstream = findDownstreamCell(coord, cell, grid);
            if (downstream != null) {
                // Add this cell to the upstream set of the downstream cell
                upstreamGraph.computeIfAbsent(downstream, k -> new HashSet<>()).add(coord);
            }
        }

        return upstreamGraph;
    }

    /**
     * Checks if the given cell or any of its upstream contributors has landslide risk.
     * Uses BFS to traverse all upstream cells.
     */
    private boolean hasUpstreamLandslideRisk(
            GridCoordinate start,
            Map<GridCoordinate, GridCell> grid,
            Map<GridCoordinate, Set<GridCoordinate>> upstreamGraph) {

        Queue<GridCoordinate> queue = new ArrayDeque<>();
        Set<GridCoordinate> visited = new HashSet<>();

        queue.add(start);
        visited.add(start);

        while (!queue.isEmpty()) {
            GridCoordinate current = queue.poll();
            GridCell cell = grid.get(current);

            if (cell != null && "LANDSLIDE_RISK".equals(cell.getRiskLevel())) {
                return true; // Found upstream landslide risk
            }

            // Add all upstream cells to the queue
            Set<GridCoordinate> upstream = upstreamGraph.get(current);
            if (upstream != null) {
                for (GridCoordinate upstreamCell : upstream) {
                    if (!visited.contains(upstreamCell)) {
                        visited.add(upstreamCell);
                        queue.add(upstreamCell);
                    }
                }
            }
        }

        return false; // No landslide risk found in upstream cells
    }
}
