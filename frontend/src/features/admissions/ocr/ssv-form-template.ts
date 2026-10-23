/**
 * Field map of the Shree Siddhi Vinayagar English High School admission form
 * (2 pages) for the offline reader.
 *
 * Fields are anchored to their **printed labels**, never to fixed page
 * coordinates: printed copies, photocopies and the digital form all differ
 * slightly in layout, and a phone photo is never perfectly aligned. A value
 * is read from the area just below (or right of) its label, up to the next
 * label on the same row. To support a new version of the form, adjust the
 * label keys here — nothing else should need to change.
 *
 * Label keys are the label text upper-cased with everything but A–Z and 0–9
 * removed ("MIDDLE / FATHER'S NAME" → "MIDDLEFATHERSNAME"). `maxExtra` is how
 * many more characters a printed label may carry after the key (e.g.
 * "(SCHOOL ALERTS)" on one print, "(FOR SCHOOL SMS/WHATSAPP)" on another).
 */

export interface LabelDef {
  key: string;
  maxExtra?: number;
}

export const LABELS = {
  classAppliedFor: { key: "CLASSAPPLIEDFOR", maxExtra: 40 },
  date: { key: "DATE", maxExtra: 0 },
  firstName: { key: "FIRSTNAME" },
  middleName: { key: "MIDDLEFATHERSNAME" },
  lastName: { key: "LASTNAMESURNAME" },
  dob: { key: "DATEOFBIRTHDDMMYYYY" },
  dobWords: { key: "DATEOFBIRTHINWORDS" },
  gender: { key: "GENDER" },
  birthPlace: { key: "PLACEOFBIRTH", maxExtra: 10 },
  religion: { key: "RELIGION" },
  caste: { key: "CASTESUBCASTE" },
  category: { key: "CATEGORY" },
  motherTongue: { key: "MOTHERTONGUE" },
  bloodGroup: { key: "BLOODGROUP" },
  aadhaarNo: { key: "AADHAARCARDNUMBER12", maxExtra: 8 },
  apaarId: { key: "APAARID", maxExtra: 16 },
  disability: { key: "SPECIALLYABLED", maxExtra: 12 },
  identificationMarks: { key: "IDENTIFICATIONMARKS", maxExtra: 10 },
  primaryMobile: { key: "PRIMARYMOBILENUMBER", maxExtra: 24 },
  alternateMobile: { key: "ALTERNATEMOBILENUMBER" },
  primaryEmail: { key: "PRIMARYEMAILADDRESS" },
  addressLine1: { key: "RESIDENTIALADDRESSLINE1", maxExtra: 40 },
  addressLine2: { key: "ADDRESSLINE2", maxExtra: 20 },
  city: { key: "CITY" },
  state: { key: "STATE" },
  pincode: { key: "PINCODE" },
  fatherColumn: { key: "FATHERSDETAILS" },
  motherColumn: { key: "MOTHERSDETAILS" },
  particulars: { key: "PARTICULARS" },
  fullNameRow: { key: "FULLNAME", maxExtra: 16 },
  qualificationRow: { key: "EDUCATIONALQUALIFICATION" },
  occupationRow: { key: "OCCUPATIONDESIGNATION" },
  workplaceRow: { key: "OFFICEWORKPLACEADDRESS" },
  incomeRow: { key: "ANNUALFAMILYINCOME" },
  mobileRow: { key: "MOBILENUMBER" },
  aadhaarRow: { key: "AADHAARCARDNUMBER" },
  previousSchool: { key: "NAMEOFPREVIOUSSCHOOL", maxExtra: 12 },
  previousBoard: { key: "BOARDAFFILIATION" },
  previousClass: { key: "LASTCLASS" },
  previousPercentage: { key: "MARKSGRADE" },
  tcNumber: { key: "LEAVINGTCNO" },
  programme: { key: "PROGRAMMEAPPLIEDFOR" },
  admissionSource: { key: "ADMISSIONSOURCE" },
  admissionQuota: { key: "ADMISSIONQUOTA" },
  transport: { key: "SCHOOLTRANSPORT", maxExtra: 30 },
  sibling: { key: "SIBLINGSTUDYING", maxExtra: 30 },
} satisfies Record<string, LabelDef>;

export type LabelId = keyof typeof LABELS;

/** Tick-box choices, keyed by the printed option word (normalised). */
export const OPTIONS = {
  gender: [
    { word: "MALE", value: "Male" },
    { word: "FEMALE", value: "Female" },
    { word: "OTHER", value: "Other" },
  ],
  category: [
    { word: "GEN", value: "General" },
    { word: "SC", value: "SC" },
    { word: "ST", value: "ST" },
    { word: "OBC", value: "OBC" },
    { word: "EWSRTE", value: "EWS" },
  ],
  /** Ticks sit left of each option's first word. */
  admissionSource: [
    { word: "DIRECT", value: "Walk-in" },
    { word: "SCHOOL", value: "Website" },
    { word: "PARENT", value: "Parent Reference" },
    { word: "SOCIAL", value: "Social Media" },
  ],
  yesNo: [
    { word: "YES", value: "Yes" },
    { word: "NO", value: "No" },
  ],
} as const;

/** Printed words that are never a handwritten value. */
export const PRINTED_WORDS = new Set([
  "D",
  "M",
  "Y",
  "DD",
  "MM",
  "YYYY",
  "MALE",
  "FEMALE",
  "OTHER",
  "GEN",
  "SC",
  "ST",
  "OBC",
  "EWS",
  "RTE",
  "EWSRTE",
  "NO",
  "YES",
  "IFYESSPECIFY",
  "STOP",
  "RS",
]);

/**
 * Labels that only appear on page 1 / page 2 of the form, used to split a
 * PDF of many filled forms into one form per student: every page 1 starts a
 * new student; the page 2 that follows belongs to them.
 */
export const PAGE_MARKERS = {
  first: [
    "FIRSTNAME",
    "DATEOFBIRTHDDMMYYYY",
    "MOTHERTONGUE",
    "RESIDENTIALADDRESSLINE1",
    "PARTICULARS",
  ],
  second: [
    "NAMEOFPREVIOUSSCHOOL",
    "PROGRAMMEAPPLIEDFOR",
    "ADMISSIONSOURCE",
    "LEAVINGTCNO",
    "SCHOOLTRANSPORT",
  ],
} as const;
