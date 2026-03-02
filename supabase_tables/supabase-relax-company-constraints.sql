-- Relax company_profiles constraints for remote intake flow
-- The original schema assumed all data was collected upfront via a legacy wizard.
-- The new intake system creates a skeleton row first, then the client fills fields over time.

-----------------------------------------------------------
-- DROP LENGTH-CHECK CONSTRAINTS
-----------------------------------------------------------

-- cage_code: was NOT NULL CHECK (LENGTH(cage_code) = 5)
ALTER TABLE company_profiles DROP CONSTRAINT IF EXISTS company_profiles_cage_code_check;
ALTER TABLE company_profiles ALTER COLUMN cage_code DROP NOT NULL;

-- uei_number: was NOT NULL CHECK (LENGTH(uei_number) = 12)
ALTER TABLE company_profiles DROP CONSTRAINT IF EXISTS company_profiles_uei_number_check;
ALTER TABLE company_profiles ALTER COLUMN uei_number DROP NOT NULL;

-- elevator_pitch: was NOT NULL CHECK (LENGTH(elevator_pitch) <= 500)
ALTER TABLE company_profiles DROP CONSTRAINT IF EXISTS company_profiles_elevator_pitch_check;
ALTER TABLE company_profiles ALTER COLUMN elevator_pitch DROP NOT NULL;

-----------------------------------------------------------
-- RELAX NOT-NULL ON FIELDS THAT START EMPTY DURING INTAKE
-----------------------------------------------------------

ALTER TABLE company_profiles ALTER COLUMN legal_name DROP NOT NULL;
ALTER TABLE company_profiles ALTER COLUMN headquarters_address DROP NOT NULL;
ALTER TABLE company_profiles ALTER COLUMN proposal_poc DROP NOT NULL;
ALTER TABLE company_profiles ALTER COLUMN authorized_signer DROP NOT NULL;

-----------------------------------------------------------
-- RE-ADD LENGTH CHECKS (without NOT NULL, so NULL is still allowed)
-----------------------------------------------------------

ALTER TABLE company_profiles ADD CONSTRAINT company_profiles_cage_code_check
  CHECK (cage_code IS NULL OR LENGTH(cage_code) = 5);

ALTER TABLE company_profiles ADD CONSTRAINT company_profiles_uei_number_check
  CHECK (uei_number IS NULL OR LENGTH(uei_number) = 12);

ALTER TABLE company_profiles ADD CONSTRAINT company_profiles_elevator_pitch_check
  CHECK (elevator_pitch IS NULL OR LENGTH(elevator_pitch) <= 500);
