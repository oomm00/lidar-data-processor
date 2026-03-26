package com.lidar.validator;

import com.lidar.model.Point;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DataValidatorTest {

    private final DataValidator validator = new DataValidator();

    @Test
    void acceptsNormalPoint() {
        assertTrue(validator.isValid(new Point(1.0, 2.0, 100.0)));
    }

    @Test
    void acceptsMinBoundaryZ() {
        assertTrue(validator.isValid(new Point(0.0, 0.0, -500.0)));
    }

    @Test
    void acceptsMaxBoundaryZ() {
        assertTrue(validator.isValid(new Point(0.0, 0.0, 9000.0)));
    }

    @Test
    void rejectsZBelowMin() {
        assertFalse(validator.isValid(new Point(0.0, 0.0, -500.1)));
    }

    @Test
    void rejectsZAboveMax() {
        assertFalse(validator.isValid(new Point(0.0, 0.0, 9000.1)));
    }

    @Test
    void rejectsNaNX() {
        assertFalse(validator.isValid(new Point(Double.NaN, 0.0, 0.0)));
    }

    @Test
    void rejectsNaNY() {
        assertFalse(validator.isValid(new Point(0.0, Double.NaN, 0.0)));
    }

    @Test
    void rejectsNaNZ() {
        assertFalse(validator.isValid(new Point(0.0, 0.0, Double.NaN)));
    }

    @Test
    void rejectsPositiveInfinityX() {
        assertFalse(validator.isValid(new Point(Double.POSITIVE_INFINITY, 0.0, 0.0)));
    }

    @Test
    void rejectsNegativeInfinityY() {
        assertFalse(validator.isValid(new Point(0.0, Double.NEGATIVE_INFINITY, 0.0)));
    }

    @Test
    void rejectsPositiveInfinityZ() {
        assertFalse(validator.isValid(new Point(0.0, 0.0, Double.POSITIVE_INFINITY)));
    }

    @Test
    void rejectsNegativeInfinityZ() {
        assertFalse(validator.isValid(new Point(0.0, 0.0, Double.NEGATIVE_INFINITY)));
    }
}
