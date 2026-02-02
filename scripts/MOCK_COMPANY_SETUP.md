# Mock Company Setup Guide

This guide explains how to create a fully populated test company in your RFP application.

**⚡ Quick Start**: Just run the SQL script in Supabase - no UI setup required!

## Overview

The mock company "TechVision Federal Solutions" is a realistic Service-Disabled Veteran-Owned Small Business (SDVOSB) with:
- Complete company profile with all details
- 3 certifications (SDVOSB, SDB, 8(a))
- 5 NAICS codes
- 3 contract vehicles (GSA MAS, CIO-SP3, DHS EAGLE II)
- Facility Secret clearance
- 5 service areas
- 10 tools & technologies
- 6 methodologies
- 5 past performance contracts
- 3 key personnel
- 5 value propositions
- 3 innovations
- 5 competitive advantages
- 6 boilerplate text blocks

## Setup Steps

### Step 1: Run the Seed Script

That's it! Just one step:

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql)

2. Copy the entire contents of `scripts/seed-mock-company.sql`

3. Paste into the SQL Editor

4. Click **Run** (or press Ctrl/Cmd + Enter)

5. You should see: `NOTICE: Created company profile with ID: [UUID]`

That's it! The script creates everything automatically.

### Step 2: Verify the Data

1. Refresh your application
2. Select "TechVision Federal Solutions" from the company dropdown
3. Navigate to `/company` dashboard
4. You should see:
   - Profile completeness around 85-90%
   - All sections populated with data
   - Action cards for each section

### Step 3: Explore the Data

Navigate through each section to see realistic government contracting data:

- **Company Profile** (`/company/profile`): Full company details
- **Certifications** (`/company/certifications`): SDVOSB, 8(a), SDB certifications
- **Capabilities** (`/company/capabilities`): 5 service areas, 10 tools, 6 methodologies
- **Past Performance** (`/company/past-performance`): 5 realistic federal contracts
- **Personnel** (`/company/personnel`): 3 key personnel with full details
- **Differentiators** (`/company/differentiators`): 5 value props, 3 innovations, 5 advantages
- **Boilerplate** (`/company/boilerplate`): 6 reusable text blocks

## Sample Data Highlights

### Past Performance Contracts
1. **DHS Cyber Shield** - $12.5M cybersecurity operations (2020-2025)
2. **VA Agile Transform** - $8.75M agile transformation (2019-2024)
3. **HHS Cloud Leap** - $15M cloud migration (2021-2024)
4. **EPA ITSM Pro** - $6.5M ServiceNow implementation (2022-2027)
5. **GSA Digital Hub** - $4.2M agile software development (2023-2025)

### Key Personnel
1. **Michael Anderson** - Senior Program Manager, PMP, SAFe SPC
2. **Dr. Priya Patel** - Chief Solutions Architect, AWS Certified
3. **James Rodriguez** - Cybersecurity Director, CISSP, CEH

### Contract Vehicles
- GSA MAS (Multiple Award Schedule)
- CIO-SP3 GWAC
- DHS EAGLE II IDIQ

## Testing Use Cases

This mock company is perfect for testing:

1. **RFP Processing**: Upload test RFPs and see how the AI pulls relevant company data
2. **Proposal Generation**: Test automated proposal generation with rich company context
3. **Completeness Scoring**: Verify the scoring algorithm with comprehensive data
4. **Data Management**: Test CRUD operations across all sections
5. **Multi-Company**: Create multiple test companies to verify multi-tenancy
6. **Search/Filter**: Test search and filtering with realistic data volume

## Customization

Feel free to modify the seed script to:
- Add more contracts (copy/paste the INSERT pattern)
- Add more personnel (duplicate the personnel INSERT)
- Adjust company details to match specific test scenarios
- Change certifications or contract vehicles
- Add more boilerplate text for different scenarios

## Cleanup

To delete the entire mock company (and all its data will cascade delete):

```sql
-- Find the company ID first
SELECT id, company_name FROM company_profiles WHERE company_name = 'TechVision Federal Solutions';

-- Then delete (replace with the actual UUID)
DELETE FROM company_profiles WHERE id = 'YOUR_COMPANY_ID_HERE';
-- All related data (certifications, past performance, personnel, etc.) will cascade delete automatically
```

Or delete by name:

```sql
DELETE FROM company_profiles WHERE company_name = 'TechVision Federal Solutions';
```

## Troubleshooting

**Issue**: Script fails with constraint violations
- **Solution**: Check that you've run all three migration scripts first (in order):
  1. `supabase-migration.sql`
  2. `supabase-multicompany-migration.sql`  
  3. `supabase-company-intake-migration.sql`

**Issue**: Company created but can't see it in dropdown
- **Solution**: Refresh your browser. The company selector should show "TechVision Federal Solutions"

**Issue**: Some data is missing
- **Solution**: Check Supabase logs for any errors during INSERT operations

**Issue**: Duplicate key error when running script again
- **Solution**: The company already exists. Delete it first (see Cleanup section) or just use the existing data

## Notes

- The mock data uses realistic federal government contracting terminology
- All contract values, dates, and details are fictitious but realistic
- Email addresses and phone numbers are fake (example.com domain)
- CAGE codes, UEI numbers, and contract numbers are made up
- The data follows all the patterns from the Company Intake Framework

Happy testing! 🎉
