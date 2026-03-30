package com.lidar.model;

public record Point(double x, double y, double z, int type) {
    public Point(double x, double y, double z) {
        this(x, y, z, 1);
    }
}
