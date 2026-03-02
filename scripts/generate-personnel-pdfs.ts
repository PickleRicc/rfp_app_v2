/**
 * Generate resume and LOC PDFs for Meridian IT Solutions key personnel.
 * 
 * All content matches EXACTLY what's in new-company-seed.sql (Tier 1 personnel table).
 * Upload these through the Data Call tab in the app.
 * 
 * Usage: npx tsx scripts/generate-personnel-pdfs.ts
 * Output: scripts/pdfs/ folder with 6 files
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(__dirname, 'pdfs');

interface PersonnelData {
  name: string;
  role: string;
  resumeLines: string[];
  locLines: string[];
}

const COMPANY = 'Meridian IT Solutions LLC';
const SOLICITATION = 'Army Research Laboratory IT Operations Support';
const DATE = 'February 15, 2026';

const personnel: PersonnelData[] = [
  {
    name: 'Thomas Brennan',
    role: 'Program Manager',
    resumeLines: [
      'THOMAS BRENNAN',
      'Program Manager',
      '',
      'PROFESSIONAL SUMMARY',
      'Senior IT program manager with 20 years of experience in federal IT operations,',
      'including 16 years supporting Department of Defense agencies. PMP and ITIL v4',
      'certified with active Top Secret clearance. Currently manages $38M DISA IT',
      'operations contract supporting 3,800 users across 7 sites with Exceptional CPARS.',
      '',
      'EDUCATION',
      '- Master of Information Systems Management, George Washington University, 2008',
      '- Bachelor of Science in Computer Science, Virginia Tech, 2003',
      '',
      'CERTIFICATIONS',
      '- Project Management Professional (PMP), PMI — Expires May 2028',
      '- ITIL v4 Foundation, PeopleCert — Expires March 2028',
      '- CompTIA Security+ CE — Expires January 2026',
      '- Certified Scrum Master, Scrum Alliance — Expires June 2027',
      '',
      'PROFESSIONAL EXPERIENCE',
      '',
      'Program Manager | Meridian IT Solutions | March 2018 – Present',
      '- Manages $38M DoD IT operations contract (DISA ENCORE III) supporting 3,800',
      '  users across 7 sites with team of 52 engineers and technicians',
      '- Achieved CPARS rating of Exceptional for Quality and Schedule in FY2024',
      '- Delivers service desk, infrastructure management, cybersecurity, and cloud',
      '  migration services across classified and unclassified environments',
      '- Reduced service desk ticket resolution time by 28% through automation',
      '',
      'Deputy Program Manager | Meridian IT Solutions | June 2014 – February 2018',
      '- Supported $22M Army IT modernization program across 4 installations',
      '- Managed cross-functional teams of 35 engineers',
      '',
      'IT Project Manager | SAIC | January 2008 – May 2014',
      '- Led IT service delivery projects for DIA and NGA',
      '- Managed $15M annual task order for network operations',
      '',
      'Systems Administrator | U.S. Army Signal Corps | June 2003 – December 2007',
      '- Active duty network and systems administration',
      '- Top Secret/SCI cleared operations in CONUS and OCONUS environments',
      '',
      'CLEARANCE: Top Secret (Active)',
      'AVAILABILITY: Immediately Available',
    ],
    locLines: [
      'LETTER OF COMMITMENT',
      '',
      `Date: ${DATE}`,
      '',
      `To: ${COMPANY}`,
      `Re: Commitment to Serve as Program Manager — ${SOLICITATION}`,
      '',
      `I, Thomas Brennan, hereby commit to serve as the Program Manager for the`,
      `${SOLICITATION} contract if awarded to ${COMPANY}.`,
      '',
      'I confirm the following:',
      `- I am currently employed by ${COMPANY} as a Program Manager`,
      '- I hold an active Top Secret security clearance',
      '- I am immediately available to begin performance on Day 1 of the contract',
      '- I will dedicate 100% of my professional effort to this contract',
      '- I meet or exceed all qualification requirements specified in the solicitation',
      '',
      'I understand that this letter constitutes a binding commitment and that my',
      'qualifications and availability were material factors in the proposal evaluation.',
      '',
      'Sincerely,',
      '',
      'Thomas Brennan',
      'Program Manager',
      COMPANY,
      'thomas.brennan@meridianits.com',
    ],
  },
  {
    name: 'Dr. Nina Vasquez',
    role: 'Lead Systems Engineer',
    resumeLines: [
      'DR. NINA VASQUEZ',
      'Lead Systems Engineer',
      '',
      'PROFESSIONAL SUMMARY',
      'Systems engineering leader with 14 years of experience designing and operating',
      'enterprise IT infrastructure for federal agencies. Doctorate in Computer Engineering',
      'from University of Maryland with expertise in hybrid cloud architecture,',
      'virtualization, and network engineering. Active Top Secret clearance.',
      '',
      'EDUCATION',
      '- Doctorate in Computer Engineering, University of Maryland, 2011',
      '- Master of Science in Electrical Engineering, Georgia Tech, 2008',
      '- Bachelor of Science in Computer Science, Penn State, 2006',
      '',
      'CERTIFICATIONS',
      '- AWS Solutions Architect Professional — Expires September 2026',
      '- Cisco CCNP Enterprise — Expires November 2025',
      '- CompTIA Security+ CE — Expires February 2027',
      '- VMware VCP-DCV — Expires April 2025',
      '- Microsoft Azure Administrator Associate — Expires June 2027',
      '',
      'PROFESSIONAL EXPERIENCE',
      '',
      'Lead Systems Engineer | Meridian IT Solutions | January 2019 – Present',
      '- Architects and maintains enterprise IT infrastructure supporting 3,800 DoD',
      '  users for Army CECOM',
      '- Designed hybrid cloud migration strategy reducing infrastructure costs by 22%',
      '- Manages VMware vSphere cluster (180+ VMs), NetApp SAN, Cisco network backbone',
      '- Implemented SolarWinds/Splunk monitoring achieving 99.99% infrastructure uptime',
      '- Leads team of 10 systems engineers and network administrators',
      '',
      'Senior Systems Engineer | Leidos | March 2015 – December 2018',
      '- Designed enterprise virtualization platform for Army Research Laboratory',
      '- Led Windows Server 2019 migration across 2,500 endpoints',
      '- Implemented STIG compliance automation reducing audit prep by 60%',
      '',
      'Systems Engineer | Booz Allen Hamilton | June 2011 – February 2015',
      '- Supported DISA network modernization program',
      '- Designed and deployed Cisco ACI fabric for classified enclave',
      '',
      'CLEARANCE: Top Secret (Active)',
      'AVAILABILITY: Immediately Available',
    ],
    locLines: [
      'LETTER OF COMMITMENT',
      '',
      `Date: ${DATE}`,
      '',
      `To: ${COMPANY}`,
      `Re: Commitment to Serve as Lead Systems Engineer — ${SOLICITATION}`,
      '',
      `I, Dr. Nina Vasquez, hereby commit to serve as the Lead Systems Engineer for`,
      `the ${SOLICITATION} contract if awarded to ${COMPANY}.`,
      '',
      'I confirm the following:',
      `- I am currently employed by ${COMPANY} as a Lead Systems Engineer`,
      '- I hold an active Top Secret security clearance',
      '- I am immediately available to begin performance on Day 1 of the contract',
      '- I will dedicate 100% of my professional effort to this contract',
      '- I meet or exceed all qualification requirements specified in the solicitation',
      '',
      'I understand that this letter constitutes a binding commitment and that my',
      'qualifications and availability were material factors in the proposal evaluation.',
      '',
      'Sincerely,',
      '',
      'Dr. Nina Vasquez',
      'Lead Systems Engineer',
      COMPANY,
      'nina.vasquez@meridianits.com',
    ],
  },
  {
    name: 'Marcus Williams',
    role: 'Cybersecurity Lead',
    resumeLines: [
      'MARCUS WILLIAMS',
      'Cybersecurity Lead',
      '',
      'PROFESSIONAL SUMMARY',
      'Cybersecurity professional with 15 years of total experience, including 13 years',
      'in federal cybersecurity operations. CISSP, CEH, and CISM certified with expertise',
      'in RMF, NIST 800-171, DFARS compliance, and DoD cybersecurity frameworks.',
      'Active Top Secret clearance.',
      '',
      'EDUCATION',
      '- Master of Science in Cybersecurity, Johns Hopkins University, 2014',
      '- Bachelor of Science in Information Technology, James Madison University, 2010',
      '',
      'CERTIFICATIONS',
      '- CISSP (Certified Information Systems Security Professional), (ISC)² — Expires August 2028',
      '- CEH (Certified Ethical Hacker), EC-Council — Expires March 2027',
      '- CompTIA Security+ CE — Expires January 2027',
      '- CISM (Certified Information Security Manager), ISACA — Expires May 2026',
      '',
      'PROFESSIONAL EXPERIENCE',
      '',
      'Cybersecurity Lead | Meridian IT Solutions | February 2020 – Present',
      '- Leads cybersecurity operations for Defense Health Agency protecting 4,200 users',
      '  and 12 information systems',
      '- Manages NIST 800-171 compliance program achieving SPRS score of 104',
      '- Directs 6-person SOC team operating Splunk SIEM with custom detection rules',
      '- Conducted RMF assessments for 12 information systems',
      '- Led DFARS 252.204-7012 compliance implementation',
      '- Reduced mean time to detect security incidents by 42%',
      '',
      'Senior Cybersecurity Analyst | Meridian IT Solutions | September 2016 – January 2020',
      '- Vulnerability assessment and penetration testing for Army networks',
      '- Managed Tanium endpoint security platform across 4,000 devices',
      '- Developed incident response playbooks reducing MTTR by 38%',
      '',
      'Cybersecurity Engineer | General Dynamics IT | January 2012 – August 2016',
      '- Security operations for DISA',
      '- STIG implementation and compliance validation across Windows and Linux',
      '- Led cyber incident response team handling 150+ incidents annually',
      '',
      'Information Assurance Analyst | U.S. Army Cyber Command | June 2010 – December 2011',
      '- Network defense operations for Army classified networks',
      '',
      'CLEARANCE: Top Secret (Active)',
      'AVAILABILITY: Available with 2 weeks notice from current assignment',
    ],
    locLines: [
      'LETTER OF COMMITMENT',
      '',
      `Date: ${DATE}`,
      '',
      `To: ${COMPANY}`,
      `Re: Commitment to Serve as Cybersecurity Lead — ${SOLICITATION}`,
      '',
      `I, Marcus Williams, hereby commit to serve as the Cybersecurity Lead for the`,
      `${SOLICITATION} contract if awarded to ${COMPANY}.`,
      '',
      'I confirm the following:',
      `- I am currently employed by ${COMPANY} as a Cybersecurity Lead`,
      '- I hold an active Top Secret security clearance',
      '- I am available to begin performance with 2 weeks notice from my current assignment',
      '- I will dedicate 100% of my professional effort to this contract',
      '- I meet or exceed all qualification requirements specified in the solicitation',
      '',
      'I understand that this letter constitutes a binding commitment and that my',
      'qualifications and availability were material factors in the proposal evaluation.',
      '',
      'Sincerely,',
      '',
      'Marcus Williams',
      'Cybersecurity Lead',
      COMPANY,
      'marcus.williams@meridianits.com',
    ],
  },
];

async function createPdf(lines: string[], title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontSize = 11;
  const lineHeight = 14;
  const margin = 60;

  let page = doc.addPage([612, 792]); // US Letter
  let y = 792 - margin;

  for (const line of lines) {
    if (y < margin + 20) {
      page = doc.addPage([612, 792]);
      y = 792 - margin;
    }

    const isHeader = line === lines[0] || line === lines[1] ||
      ['PROFESSIONAL SUMMARY', 'EDUCATION', 'CERTIFICATIONS', 'PROFESSIONAL EXPERIENCE',
       'LETTER OF COMMITMENT'].includes(line);

    const activeFont = isHeader ? boldFont : font;
    const activeFontSize = line === lines[0] ? 16 : isHeader ? 12 : fontSize;

    page.drawText(line, {
      x: margin,
      y,
      size: activeFontSize,
      font: activeFont,
      color: rgb(0, 0, 0),
    });

    y -= (line === '' ? lineHeight * 0.6 : lineHeight + (activeFontSize > fontSize ? 4 : 0));
  }

  return doc.save();
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const person of personnel) {
    const lastName = person.name.split(' ').pop()!;

    const resumeBytes = await createPdf(person.resumeLines, `${person.name} — Resume`);
    const resumePath = path.join(OUTPUT_DIR, `${lastName}_Resume.pdf`);
    fs.writeFileSync(resumePath, resumeBytes);
    console.log(`Created: ${resumePath}`);

    const locBytes = await createPdf(person.locLines, `${person.name} — LOC`);
    const locPath = path.join(OUTPUT_DIR, `${lastName}_LOC.pdf`);
    fs.writeFileSync(locPath, locBytes);
    console.log(`Created: ${locPath}`);
  }

  console.log(`\nDone! 6 PDFs generated in ${OUTPUT_DIR}`);
  console.log('Upload these through the Data Call tab:');
  console.log('  Personnel 1 (Program Manager): Brennan_Resume.pdf + Brennan_LOC.pdf');
  console.log('  Personnel 2 (Lead Systems Engineer): Vasquez_Resume.pdf + Vasquez_LOC.pdf');
  console.log('  Personnel 3 (Cybersecurity Lead): Williams_Resume.pdf + Williams_LOC.pdf');
}

main().catch(console.error);
