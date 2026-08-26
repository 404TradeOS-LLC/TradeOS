# TradeOS Costbook Validation Rules

This document outlines the schema and requirements that all Costbook Items must satisfy to pass validation.

## Required Keys
Every costbook item JSON object must contain the following keys:
- `id` (UUID string)
- `name` (String, must not be empty)
- `category` (String, representing the trade category)
- `unit` (String, representing the unit of measurement)
- `laborCost` (Double/Decimal, >= 0)
- `materialCost` (Double/Decimal, >= 0)
- `equipmentCost` (Double/Decimal, >= 0)

## Unit of Measurement Whitelist
Only the following unit abbreviations are allowed (case-insensitive during validation, but normalized to uppercase):
- `SF` (Square Feet)
- `LF` (Linear Feet)
- `EA` (Each)
- `HR` (Hour)
- `CY` (Cubic Yard)
- `SQ` (Square, 100 SF)
- `CF` (Cubic Foot)

## Logical Constraints
1. **Positive Pricing Sum**: The sum of `laborCost`, `materialCost`, and `equipmentCost` must be strictly greater than zero:
   \[\text{laborCost} + \text{materialCost} + \text{equipmentCost} > 0\]
2. **Name Constraint**: The `name` must be a non-empty, non-whitespace string.
