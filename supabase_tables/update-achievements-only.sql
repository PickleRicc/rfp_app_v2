-- Simple UPDATE to fix achievements structure for existing records
-- This will convert string arrays to proper object arrays

-- Contract 1: DHS Cyber Shield
UPDATE past_performance
SET achievements = '[
  {"statement": "Achieved 99.8% uptime for SOC operations over 4 years", "metric_value": "99.8%", "metric_type": "Quality Improvement"},
  {"statement": "Reduced mean time to detect (MTTD) security incidents from 48 hours to 2 hours", "metric_value": "96% reduction", "metric_type": "Time Savings"},
  {"statement": "Successfully completed 20+ ATO packages with zero findings", "metric_value": "20+ ATOs", "metric_type": "Compliance"},
  {"statement": "Received CPARS rating of Exceptional for 3 consecutive years", "metric_value": "3 years", "metric_type": "Customer Satisfaction"},
  {"statement": "Identified and remediated 500+ critical vulnerabilities before exploitation", "metric_value": "500+", "metric_type": "Quality Improvement"},
  {"statement": "Saved DHS $2M annually through security automation", "metric_value": "$2M/year", "metric_type": "Cost Savings"}
]'::jsonb,
updated_at = NOW()
WHERE contract_nickname = 'DHS Cyber Shield';

-- Contract 2: VA Agile Transform
UPDATE past_performance
SET achievements = '[
  {"statement": "Increased deployment frequency from 2/year to 26/year", "metric_value": "1,200%", "metric_type": "Efficiency Gain"},
  {"statement": "Reduced lead time for changes from 6 months to 2 weeks", "metric_value": "93% reduction", "metric_type": "Time Savings"},
  {"statement": "Trained 200+ VA staff in agile methodologies", "metric_value": "200+", "metric_type": "Other"},
  {"statement": "Achieved 95% on-time delivery rate for sprints", "metric_value": "95%", "metric_type": "Quality Improvement"},
  {"statement": "Reduced production defects by 40% through automated testing", "metric_value": "40%", "metric_type": "Quality Improvement"},
  {"statement": "Received Outstanding CPARS rating for all performance periods", "metric_value": "Outstanding", "metric_type": "Customer Satisfaction"}
]'::jsonb,
updated_at = NOW()
WHERE contract_nickname = 'VA Agile Transform';

-- Contract 3: HHS Cloud Leap
UPDATE past_performance
SET achievements = '[
  {"statement": "Migrated 85 applications with 99.5% success rate and zero data loss", "metric_value": "99.5%", "metric_type": "Quality Improvement"},
  {"statement": "Achieved FedRAMP Moderate ATO in 8 months (vs. 12-18 month average)", "metric_value": "33% faster", "metric_type": "Time Savings"},
  {"statement": "Reduced infrastructure costs by $1.8M annually", "metric_value": "$1.8M/year", "metric_type": "Cost Savings"},
  {"statement": "Improved application performance by 60% average", "metric_value": "60%", "metric_type": "Quality Improvement"},
  {"statement": "Completed migration 2 months ahead of schedule", "metric_value": "2 months", "metric_type": "Time Savings"},
  {"statement": "Zero security incidents during migration", "metric_value": "0 incidents", "metric_type": "Quality Improvement"},
  {"statement": "Received CPARS rating of Exceptional", "metric_value": "Exceptional", "metric_type": "Customer Satisfaction"}
]'::jsonb,
updated_at = NOW()
WHERE contract_nickname = 'HHS Cloud Leap';

-- Contract 4: EPA ITSM Pro
UPDATE past_performance
SET achievements = '[
  {"statement": "Reduced average incident resolution time from 72 hours to 32 hours", "metric_value": "55%", "metric_type": "Time Savings"},
  {"statement": "Automated 40% of routine service requests", "metric_value": "40%", "metric_type": "Efficiency Gain"},
  {"statement": "Improved user satisfaction score from 72% to 91%", "metric_value": "19 points", "metric_type": "Customer Satisfaction"},
  {"statement": "Successfully onboarded 15,000 users with 98% adoption rate", "metric_value": "98%", "metric_type": "Quality Improvement"},
  {"statement": "Created 500+ knowledge base articles reducing support tickets by 25%", "metric_value": "25%", "metric_type": "Efficiency Gain"},
  {"statement": "Received CPARS rating of Very Good", "metric_value": "Very Good", "metric_type": "Customer Satisfaction"}
]'::jsonb,
updated_at = NOW()
WHERE contract_nickname = 'EPA ITSM Pro';

-- Contract 5: GSA Digital Hub
UPDATE past_performance
SET achievements = '[
  {"statement": "Delivered 120+ features across 5 applications over 2 years", "metric_value": "120+", "metric_type": "Other"},
  {"statement": "Maintained 99.9% application uptime", "metric_value": "99.9%", "metric_type": "Quality Improvement"},
  {"statement": "Achieved 100% 508 compliance for all deliverables", "metric_value": "100%", "metric_type": "Compliance"},
  {"statement": "Completed 50+ user research sessions influencing product direction", "metric_value": "50+", "metric_type": "Other"},
  {"statement": "Reduced page load times by 70% through performance optimization", "metric_value": "70%", "metric_type": "Efficiency Gain"},
  {"statement": "Received CPARS rating of Exceptional for Year 1", "metric_value": "Exceptional", "metric_type": "Customer Satisfaction"}
]'::jsonb,
updated_at = NOW()
WHERE contract_nickname = 'GSA Digital Hub';

-- Verify the updates
SELECT 
  contract_nickname,
  jsonb_pretty(achievements) as formatted_achievements
FROM past_performance
ORDER BY contract_nickname;
