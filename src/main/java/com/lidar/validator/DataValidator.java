package com.lidar.validator;

import com.lidar.model.Point;

public class DataValidator {

    private static final double MIN_Z = -500.0;
    private static final double MAX_Z = 9000.0;

    /**
     * Validates a single Point.
     *
     * Rejects if:
     * - Any field is NaN
     * - Any field is infinite (positive or negative)
     * - z is outside the range [-500, 9000] (reasonable Earth elevation bounds)
     * - type is not 1, 2, 3, or 4
     *
     * @param point the point to validate
     * @return true if the point is valid, false otherwise
     */
    public boolean isValid(Point point) {
        double x = point.x();
        double y = point.y();
        double z = point.z();
        int type = point.type();

        // Reject NaN in any field
        if (Double.isNaN(x) || Double.isNaN(y) || Double.isNaN(z)) {
            return false;
        }

        // Reject infinite values in any field
        if (Double.isInfinite(x) || Double.isInfinite(y) || Double.isInfinite(z)) {
            return false;
        }

        // Reject z outside Earth elevation bounds
        if (z < MIN_Z || z > MAX_Z) {
            return false;
        }

        // Reject type outside valid categories
        if (type < 1 || type > 4) {
            return false;
        }

        return true;
    }
}
