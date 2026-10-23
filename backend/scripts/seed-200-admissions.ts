import { PrismaClient } from '../prisma/generated';

const prisma = new PrismaClient();

const BOY_FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Sai', 'Arnav', 'Aayush', 'Shaurya',
  'Atharva', 'Advik', 'Pranav', 'Kabir', 'Ansh', 'Ishaan', 'Dhruv', 'Siddharth', 'Shivam', 'Om',
  'Yash', 'Parth', 'Dev', 'Rohan', 'Harsh', 'Tanmay', 'Manas', 'Sahil', 'Rishabh', 'Tejas',
  'Chinmay', 'Neil', 'Vedant', 'Samarth', 'Nikhil', 'Kunal', 'Sameer', 'Rohit', 'Tushar', 'Gaurav',
  'Mayur', 'Chetan', 'Sagar', 'Akshay', 'Swapnil', 'Vishal', 'Ketan', 'Bhavesh', 'Karan', 'Varun',
  'Deepak', 'Alok', 'Mihir', 'Harshit', 'Naitik', 'Daksh', 'Aniket', 'Ayush', 'Utkarsh', 'Soham',
  'Mohammad', 'Farhan', 'Rehan', 'Zaid', 'Aman', 'Faizan', 'Rayan', 'Arman', 'Sameer', 'Bilal'
];

const GIRL_FIRST_NAMES = [
  'Aanya', 'Saanvi', 'Ananya', 'Diya', 'Pari', 'Riya', 'Anika', 'Myra', 'Avani', 'Sneha',
  'Tanvi', 'Pooja', 'Swara', 'Ira', 'Meera', 'Priya', 'Shreya', 'Neha', 'Krisha', 'Natasha',
  'Kavya', 'Ishita', 'Arya', 'Aditi', 'Khushi', 'Prisha', 'Navya', 'Shruti', 'Mansi', 'Sakshi',
  'Divya', 'Payal', 'Komal', 'Ritu', 'Nikita', 'Vidhi', 'Bhavna', 'Rashmi', 'Deepa', 'Poonam',
  'Archana', 'Priyanka', 'Sonali', 'Rupali', 'Kajal', 'Shilpa', 'Sanjana', 'Anushka', 'Simran', 'Tanushree',
  'Fatima', 'Aisha', 'Zainab', 'Sana', 'Maryam', 'Alia', 'Sara', 'Zoya', 'Nida', 'Iqra'
];

const MIDDLE_NAMES = [
  'Rajesh', 'Ramesh', 'Suresh', 'Dinesh', 'Ganesh', 'Mahesh', 'Vijay', 'Sanjay', 'Sunil', 'Anil',
  'Deepak', 'Prakash', 'Sachin', 'Manoj', 'Santosh', 'Nitin', 'Ashok', 'Dilip', 'Hemant', 'Pramod',
  'Rajendra', 'Subhash', 'Arvind', 'Kishor', 'Ravindra', 'Pradeep', 'Mohan', 'Sudhir', 'Ajay', 'Jagdish'
];

const LAST_NAMES = [
  'Sharma', 'Patil', 'Kulkarni', 'Shinde', 'Deshmukh', 'Pawar', 'Chavan', 'Joshi', 'Gaikwad', 'Jadhav',
  'Khan', 'Shaikh', 'Ansari', 'Qureshi', 'Fernandes', 'Dsouza', 'Nair', 'Iyer', 'Gupta', 'Verma',
  'Mehta', 'Shah', 'Singh', 'Yadav', 'Dubey', 'Pandey', 'Tiwari', 'Mishra', 'Chauhan', 'Rathore',
  'More', 'Sawant', 'Kamble', 'Bhosale', 'Ghuge', 'Mane', 'Salunkhe', 'Tambe', 'Gore', 'Kadam'
];

const MUMBAI_ADDRESSES = [
  { line1: 'Flat 101, Shanti Niwas, Andheri East', pincode: '400069' },
  { line1: 'Room 12, Ganesh Chawl, Kurla West', pincode: '400070' },
  { line1: 'Flat 304, Green Heights, Powai', pincode: '400076' },
  { line1: 'B-12, Sai Krupa CHS, Goregaon East', pincode: '400063' },
  { line1: 'Flat 502, Sagar Darshan, Bandra West', pincode: '400050' },
  { line1: 'Room 5, Shivaji Nagar, Chembur', pincode: '400071' },
  { line1: 'Flat 201, Royal Palms, Malad West', pincode: '400064' },
  { line1: 'Flat 403, Neelkanth Valley, Ghatkopar East', pincode: '400077' },
  { line1: 'Room 18, Azad Nagar, Dadar West', pincode: '400028' },
  { line1: 'Flat 601, Shree Ram Complex, Borivali West', pincode: '400092' },
  { line1: 'A-205, Dream Park, Kandivali East', pincode: '400101' },
  { line1: '14, Tilak Road, Mulund West', pincode: '400080' },
  { line1: 'Flat 302, Sunrise CHS, Vikhroli West', pincode: '400079' },
  { line1: 'Room 22, Jai Hind Colony, Bhandup West', pincode: '400078' },
  { line1: 'Flat 104, Gokul Dham, Santacruz East', pincode: '400055' },
];

interface PlacementTarget {
  name: string;
  className: string;
  unitId: string;
  birthYear: number;
  count: number;
}

async function main() {
  console.log('=== Starting Seeding of 200 Admissions ===');

  // 1. Authenticate with backend API
  const loginRes = await fetch('http://localhost:3001/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'admin@example.com',
      password: 'admin1234',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const { data: { accessToken } } = await loginRes.json();
  console.log('Logged in successfully as Super Admin');

  const organizationId = '01a159ee-5fe8-7f12-bf26-774d90241d11';
  const branchId = '01a159f1-02e2-7371-8c7c-5b312283f862';
  const academicYearId = '01a159f2-0ebd-7291-9175-b300476bb006';
  const programId = '01a159f8-3884-7400-bf9e-49e3d1295eb1';

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'x-organization-id': organizationId,
    'x-branch-id': branchId,
    'x-academic-year-id': academicYearId,
  };

  // 2. Fetch masters from DB
  const maleGender = '01a15aad-8923-7a01-9e7d-25090fcc798b';
  const femaleGender = '01a15aae-3a96-7d91-836b-a84296d148a8';

  const religions = await prisma.religion.findMany({ where: { branchId, deletedAt: null } });
  const castes = await prisma.caste.findMany({ where: { branchId, deletedAt: null } });
  const categories = await prisma.category.findMany({ where: { branchId, deletedAt: null } });
  const languages = await prisma.language.findMany({ where: { branchId, deletedAt: null } });
  const bloodGroups = await prisma.bloodGroup.findMany({ where: { branchId, deletedAt: null } });
  const sources = await prisma.admissionSource.findMany({ where: { branchId, deletedAt: null } });

  console.log(`Loaded ${religions.length} religions, ${castes.length} castes, ${categories.length} categories, ${sources.length} sources`);

  // Target divisions and quota distribution
  const placements: PlacementTarget[] = [
    { className: 'Junior KG', name: 'Div A', unitId: '01a15a99-c1ae-7032-b3d1-f310db9275e1', birthYear: 2021, count: 23 },
    { className: 'Junior KG', name: 'Div B', unitId: '01a15a9a-2c18-7150-813a-95004764dadf', birthYear: 2021, count: 23 },
    { className: 'Senior KG', name: 'Div A', unitId: '01a15a9a-c541-7f53-868d-e3713591b1f0', birthYear: 2020, count: 23 },
    { className: 'Senior KG', name: 'Div B', unitId: '01a15a9d-e95d-7451-aeb8-993e3c596bc8', birthYear: 2020, count: 23 },
    { className: 'First', name: 'Div A', unitId: '01a15aa6-61ae-7e63-bf0a-72e973b2bbc0', birthYear: 2019, count: 22 },
    { className: 'First', name: 'Div B', unitId: '01a15aa6-d8e6-76f1-b553-7be4bbd3acd7', birthYear: 2019, count: 22 },
    { className: 'Second', name: 'Div A', unitId: '01a15aa7-cb00-7340-b2fd-8fe3d0c5936f', birthYear: 2018, count: 22 },
    { className: 'Second', name: 'Div B', unitId: '01a15aa8-2285-7a30-bec0-60cc87c4d378', birthYear: 2018, count: 22 },
    { className: 'Third', name: 'Div A', unitId: '01a15aa5-ed37-7401-abcd-49555010ecec', birthYear: 2017, count: 20 },
  ];

  const totalToSeed = placements.reduce((acc, p) => acc + p.count, 0);
  console.log(`Planned distribution across 9 divisions: Total = ${totalToSeed}`);

  let studentIdx = 10;
  let successfulAdmissions = 0;
  let failedAdmissions = 0;

  for (const placement of placements) {
    console.log(`\n--> Admitting ${placement.count} students into ${placement.className} ${placement.name}...`);

    for (let i = 0; i < placement.count; i++) {
      studentIdx++;
      const isBoy = Math.random() > 0.48;
      const firstNameList = isBoy ? BOY_FIRST_NAMES : GIRL_FIRST_NAMES;
      const firstName = firstNameList[studentIdx % firstNameList.length];
      const middleName = MIDDLE_NAMES[(studentIdx * 3) % MIDDLE_NAMES.length];
      const lastName = LAST_NAMES[(studentIdx * 7) % LAST_NAMES.length];
      const genderId = isBoy ? maleGender : femaleGender;

      // Random month & day
      const month = String(1 + (studentIdx % 12)).padStart(2, '0');
      const day = String(1 + ((studentIdx * 5) % 28)).padStart(2, '0');
      const dob = `${placement.birthYear}-${month}-${day}`;

      const addr = MUMBAI_ADDRESSES[studentIdx % MUMBAI_ADDRESSES.length];
      const religion = religions[studentIdx % religions.length]?.id;
      const caste = castes[studentIdx % castes.length]?.id;
      const category = categories[studentIdx % categories.length]?.id;
      const motherTongue = languages[studentIdx % languages.length]?.id;
      const bloodGroup = bloodGroups[0]?.id;
      const source = sources[studentIdx % sources.length]?.id;

      // Unique 10-digit mobile number
      const primaryMobile = `982${String(1000000 + studentIdx).padStart(7, '0')}`;

      const applicantPayload = {
        firstName,
        middleName,
        lastName,
        dob,
        genderId,
        birthPlace: 'Mumbai',
        religionId: religion,
        casteId: caste,
        categoryId: category,
        motherTongueId: motherTongue,
        bloodGroupId: bloodGroup,
        disabilityStatus: false,
        primaryMobile,
        currentAddressLine1: addr.line1,
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        pincode: addr.pincode,
        programId,
        admissionSourceId: source,
      };

      try {
        // Step A: Create Applicant
        const createRes = await fetch('http://localhost:3001/v1/admissions/applicants', {
          method: 'POST',
          headers,
          body: JSON.stringify(applicantPayload),
        });

        if (!createRes.ok) {
          const errText = await createRes.text();
          console.error(`[FAIL] Create applicant ${firstName} ${lastName}: ${createRes.status} ${errText}`);
          failedAdmissions++;
          continue;
        }

        const createData = await createRes.json();
        const applicantId = createData.data.id;

        // Step B: Direct Admit into division
        const admitRes = await fetch(`http://localhost:3001/v1/admissions/applicants/${applicantId}/direct-admit`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            academicUnitId: placement.unitId,
            admissionType: 'REGULAR',
          }),
        });

        if (!admitRes.ok) {
          const errText = await admitRes.text();
          console.error(`[FAIL] Admit applicant ${firstName} ${lastName}: ${admitRes.status} ${errText}`);
          failedAdmissions++;
          continue;
        }

        const admitData = await admitRes.json();
        successfulAdmissions++;

        if (successfulAdmissions % 10 === 0 || successfulAdmissions === totalToSeed) {
          console.log(
            `[${successfulAdmissions}/${totalToSeed}] Admitted ${firstName} ${middleName} ${lastName} ` +
            `(${admitData.data.studentCode}, ${admitData.data.admissionNo}) into ${placement.className} ${placement.name}`
          );
        }
      } catch (err) {
        console.error(`Exception admitting ${firstName} ${lastName}:`, err);
        failedAdmissions++;
      }
    }
  }

  console.log('\n=========================================');
  console.log(`Seeding Finished!`);
  console.log(`Successfully Admitted: ${successfulAdmissions}`);
  console.log(`Failed: ${failedAdmissions}`);
  console.log('=========================================\n');

  // Verify total counts in DB
  const finalApplicants = await prisma.applicant.count({ where: { branchId } });
  const finalStudents = await prisma.student.count({ where: { branchId } });
  const finalAdmissions = await prisma.admission.count({ where: { branchId } });
  console.log(`Final Database Counts for Branch:`);
  console.log(`- Total Applicants: ${finalApplicants}`);
  console.log(`- Total Students: ${finalStudents}`);
  console.log(`- Total Admissions: ${finalAdmissions}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
