
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.AcademicUnitScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  programId: 'programId',
  academicYearId: 'academicYearId',
  parentId: 'parentId',
  name: 'name',
  code: 'code',
  unitType: 'unitType',
  level: 'level',
  displayOrder: 'displayOrder',
  isActive: 'isActive',
  isDeleted: 'isDeleted',
  metadata: 'metadata',
  createdBy: 'createdBy',
  updatedBy: 'updatedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AcademicYearScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  name: 'name',
  startDate: 'startDate',
  endDate: 'endDate',
  isActive: 'isActive',
  isSelected: 'isSelected',
  isLocked: 'isLocked',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
  updatedBy: 'updatedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProgramScalarFieldEnum = {
  id: 'id',
  branchId: 'branchId',
  name: 'name',
  level: 'level',
  medium: 'medium',
  stream: 'stream',
  parentId: 'parentId',
  isActive: 'isActive',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
  updatedBy: 'updatedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ApplicantScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  branchId: 'branchId',
  academicYearId: 'academicYearId',
  admissionFormNo: 'admissionFormNo',
  applicationNo: 'applicationNo',
  firstName: 'firstName',
  middleName: 'middleName',
  lastName: 'lastName',
  displayName: 'displayName',
  dob: 'dob',
  genderId: 'genderId',
  birthPlace: 'birthPlace',
  photoFileId: 'photoFileId',
  religionId: 'religionId',
  casteId: 'casteId',
  categoryId: 'categoryId',
  motherTongueId: 'motherTongueId',
  bloodGroupId: 'bloodGroupId',
  disabilityStatus: 'disabilityStatus',
  disabilityTypeId: 'disabilityTypeId',
  disabilityNotes: 'disabilityNotes',
  aadhaarNo: 'aadhaarNo',
  penNo: 'penNo',
  apaarId: 'apaarId',
  primaryMobile: 'primaryMobile',
  alternateMobile: 'alternateMobile',
  primaryEmail: 'primaryEmail',
  currentAddressLine1: 'currentAddressLine1',
  currentAddressLine2: 'currentAddressLine2',
  city: 'city',
  district: 'district',
  state: 'state',
  country: 'country',
  pincode: 'pincode',
  previousSchoolName: 'previousSchoolName',
  previousBoard: 'previousBoard',
  previousClass: 'previousClass',
  previousPercentage: 'previousPercentage',
  tcNumber: 'tcNumber',
  admissionSourceId: 'admissionSourceId',
  quotaId: 'quotaId',
  admissionStatus: 'admissionStatus',
  internalRemarks: 'internalRemarks',
  counsellorRemarks: 'counsellorRemarks',
  assignedCounsellorId: 'assignedCounsellorId',
  transportRequired: 'transportRequired',
  hostelRequired: 'hostelRequired',
  submittedAt: 'submittedAt',
  approvedAt: 'approvedAt',
  rejectedAt: 'rejectedAt',
  cancelledAt: 'cancelledAt',
  customFieldData: 'customFieldData',
  checklistStatus: 'checklistStatus',
  tags: 'tags',
  formTemplateVersion: 'formTemplateVersion',
  createdBy: 'createdBy',
  updatedBy: 'updatedBy',
  approvedBy: 'approvedBy',
  rejectedBy: 'rejectedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.EnrollmentScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  branchId: 'branchId',
  academicYearId: 'academicYearId',
  programId: 'programId',
  academicUnitId: 'academicUnitId',
  applicantId: 'applicantId',
  futureStudentId: 'futureStudentId',
  rollNumber: 'rollNumber',
  enrollmentStatus: 'enrollmentStatus',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.GuardianScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  branchId: 'branchId',
  firstName: 'firstName',
  middleName: 'middleName',
  lastName: 'lastName',
  mobilePrimary: 'mobilePrimary',
  mobileSecondary: 'mobileSecondary',
  email: 'email',
  occupation: 'occupation',
  income: 'income',
  aadhaarNo: 'aadhaarNo',
  addressLine1: 'addressLine1',
  addressLine2: 'addressLine2',
  city: 'city',
  state: 'state',
  country: 'country',
  pincode: 'pincode',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.ApplicantGuardianMappingScalarFieldEnum = {
  id: 'id',
  applicantId: 'applicantId',
  guardianId: 'guardianId',
  relationTypeId: 'relationTypeId',
  isPrimary: 'isPrimary',
  isEmergencyContact: 'isEmergencyContact',
  isFinancialGuardian: 'isFinancialGuardian',
  pickupAllowed: 'pickupAllowed',
  priority: 'priority',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ReligionScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  branchId: 'branchId',
  code: 'code',
  name: 'name',
  description: 'description',
  displayOrder: 'displayOrder',
  isActive: 'isActive',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.CasteScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  branchId: 'branchId',
  code: 'code',
  name: 'name',
  description: 'description',
  displayOrder: 'displayOrder',
  isActive: 'isActive',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.CategoryScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  branchId: 'branchId',
  code: 'code',
  name: 'name',
  description: 'description',
  displayOrder: 'displayOrder',
  isActive: 'isActive',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.GenderScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  branchId: 'branchId',
  code: 'code',
  name: 'name',
  description: 'description',
  displayOrder: 'displayOrder',
  isActive: 'isActive',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.BloodGroupScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  branchId: 'branchId',
  code: 'code',
  name: 'name',
  description: 'description',
  displayOrder: 'displayOrder',
  isActive: 'isActive',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.LanguageScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  branchId: 'branchId',
  code: 'code',
  name: 'name',
  description: 'description',
  displayOrder: 'displayOrder',
  isActive: 'isActive',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.DisabilityScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  branchId: 'branchId',
  code: 'code',
  name: 'name',
  description: 'description',
  displayOrder: 'displayOrder',
  isActive: 'isActive',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.RelationTypeScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  branchId: 'branchId',
  code: 'code',
  name: 'name',
  description: 'description',
  displayOrder: 'displayOrder',
  isActive: 'isActive',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.QuotaScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  branchId: 'branchId',
  code: 'code',
  name: 'name',
  description: 'description',
  displayOrder: 'displayOrder',
  isActive: 'isActive',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.AdmissionSourceScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  branchId: 'branchId',
  code: 'code',
  name: 'name',
  description: 'description',
  displayOrder: 'displayOrder',
  isActive: 'isActive',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.NumberSequenceConfigScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  branchId: 'branchId',
  purpose: 'purpose',
  prefix: 'prefix',
  suffix: 'suffix',
  includeBranchCode: 'includeBranchCode',
  includeAcademicYear: 'includeAcademicYear',
  sequencePadding: 'sequencePadding',
  format: 'format',
  resetStrategy: 'resetStrategy',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt'
};

exports.Prisma.NumberSequenceCounterScalarFieldEnum = {
  id: 'id',
  configId: 'configId',
  academicYearId: 'academicYearId',
  currentValue: 'currentValue',
  updatedAt: 'updatedAt'
};

exports.Prisma.WorkflowHistoryScalarFieldEnum = {
  id: 'id',
  applicantId: 'applicantId',
  oldStatus: 'oldStatus',
  newStatus: 'newStatus',
  actionType: 'actionType',
  remarks: 'remarks',
  actionBy: 'actionBy',
  timestamp: 'timestamp'
};

exports.Prisma.RefreshTokenScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  token: 'token',
  tokenHash: 'tokenHash',
  device: 'device',
  ipAddress: 'ipAddress',
  userAgent: 'userAgent',
  isRevoked: 'isRevoked',
  revokedAt: 'revokedAt',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  fullName: 'fullName',
  username: 'username',
  email: 'email',
  phone: 'phone',
  passwordHash: 'passwordHash',
  role: 'role',
  organizationId: 'organizationId',
  branchId: 'branchId',
  status: 'status',
  failedLoginAttempts: 'failedLoginAttempts',
  lockUntil: 'lockUntil',
  isTwoFactorEnabled: 'isTwoFactorEnabled',
  twoFactorSecret: 'twoFactorSecret',
  lastLoginAt: 'lastLoginAt',
  createdBy: 'createdBy',
  updatedBy: 'updatedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BranchScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  name: 'name',
  code: 'code',
  registrationNumber: 'registrationNumber',
  institutionType: 'institutionType',
  affiliationType: 'affiliationType',
  affiliationName: 'affiliationName',
  logoUrl: 'logoUrl',
  contactEmail: 'contactEmail',
  contactPhone: 'contactPhone',
  addressLine1: 'addressLine1',
  addressLine2: 'addressLine2',
  city: 'city',
  state: 'state',
  country: 'country',
  pincode: 'pincode',
  structureMode: 'structureMode',
  isActive: 'isActive',
  isDeleted: 'isDeleted',
  createdBy: 'createdBy',
  updatedBy: 'updatedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrganizationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  logoUrl: 'logoUrl',
  contactEmail: 'contactEmail',
  contactPhone: 'contactPhone',
  addressLine1: 'addressLine1',
  addressLine2: 'addressLine2',
  city: 'city',
  state: 'state',
  country: 'country',
  pincode: 'pincode',
  masterExpiryDate: 'masterExpiryDate',
  status: 'status',
  timezone: 'timezone',
  currency: 'currency',
  createdBy: 'createdBy',
  updatedBy: 'updatedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SystemSettingScalarFieldEnum = {
  id: 'id',
  productName: 'productName',
  productCode: 'productCode',
  version: 'version',
  environment: 'environment',
  maintenanceMode: 'maintenanceMode',
  maintenanceMessage: 'maintenanceMessage',
  defaultTimezone: 'defaultTimezone',
  defaultCurrency: 'defaultCurrency',
  defaultLanguage: 'defaultLanguage',
  supportEmail: 'supportEmail',
  supportPhone: 'supportPhone',
  isActive: 'isActive',
  createdBy: 'createdBy',
  updatedBy: 'updatedBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.AcademicUnitType = exports.$Enums.AcademicUnitType = {
  SECTION: 'SECTION',
  CLASS: 'CLASS',
  DIVISION: 'DIVISION',
  STREAM: 'STREAM',
  DEPARTMENT: 'DEPARTMENT',
  YEAR: 'YEAR',
  SEMESTER: 'SEMESTER',
  BATCH: 'BATCH',
  CUSTOM: 'CUSTOM'
};

exports.ProgramLevel = exports.$Enums.ProgramLevel = {
  SCHOOL: 'SCHOOL',
  COLLEGE: 'COLLEGE',
  DEGREE: 'DEGREE'
};

exports.RoleType = exports.$Enums.RoleType = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  BRANCH_ADMIN: 'BRANCH_ADMIN',
  STAFF: 'STAFF',
  STUDENT: 'STUDENT',
  PARENT: 'PARENT'
};

exports.UserStatus = exports.$Enums.UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'INACTIVE'
};

exports.InstitutionType = exports.$Enums.InstitutionType = {
  SCHOOL: 'SCHOOL',
  JUNIOR_COLLEGE: 'JUNIOR_COLLEGE',
  DEGREE_COLLEGE: 'DEGREE_COLLEGE',
  UNIVERSITY: 'UNIVERSITY',
  ENGINEERING: 'ENGINEERING',
  MEDICAL: 'MEDICAL',
  OTHER: 'OTHER'
};

exports.AffiliationType = exports.$Enums.AffiliationType = {
  BOARD: 'BOARD',
  UNIVERSITY: 'UNIVERSITY',
  OTHER: 'OTHER'
};

exports.StructureMode = exports.$Enums.StructureMode = {
  DEFAULT: 'DEFAULT',
  CUSTOM: 'CUSTOM'
};

exports.OrganizationStatus = exports.$Enums.OrganizationStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED'
};

exports.Environment = exports.$Enums.Environment = {
  DEV: 'DEV',
  STAGING: 'STAGING',
  PROD: 'PROD'
};

exports.Prisma.ModelName = {
  AcademicUnit: 'AcademicUnit',
  AcademicYear: 'AcademicYear',
  Program: 'Program',
  Applicant: 'Applicant',
  Enrollment: 'Enrollment',
  Guardian: 'Guardian',
  ApplicantGuardianMapping: 'ApplicantGuardianMapping',
  Religion: 'Religion',
  Caste: 'Caste',
  Category: 'Category',
  Gender: 'Gender',
  BloodGroup: 'BloodGroup',
  Language: 'Language',
  Disability: 'Disability',
  RelationType: 'RelationType',
  Quota: 'Quota',
  AdmissionSource: 'AdmissionSource',
  NumberSequenceConfig: 'NumberSequenceConfig',
  NumberSequenceCounter: 'NumberSequenceCounter',
  WorkflowHistory: 'WorkflowHistory',
  RefreshToken: 'RefreshToken',
  User: 'User',
  Branch: 'Branch',
  Organization: 'Organization',
  SystemSetting: 'SystemSetting'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
