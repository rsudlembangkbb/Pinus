-- Additional configurable parameters needed to run the calculation engine
-- end-to-end: which "minimum requirement" category (if any) an employee
-- falls under, the period's administration incentive allocation, and the
-- tenaga-kesehatan tim-unit pool split (porsi tetap vs porsi subsidi
-- antar-unit, PRD 9.2).

ALTER TABLE employees ADD COLUMN minimum_category TEXT;

ALTER TABLE calculation_periods ADD COLUMN administration_allocation INTEGER;
ALTER TABLE calculation_periods ADD COLUMN team_unit_proportion_bps INTEGER NOT NULL DEFAULT 3000;
ALTER TABLE calculation_periods ADD COLUMN team_unit_fixed_portion_bps INTEGER NOT NULL DEFAULT 2000;
ALTER TABLE calculation_periods ADD COLUMN hybrid_discount_bps INTEGER NOT NULL DEFAULT 8000;
