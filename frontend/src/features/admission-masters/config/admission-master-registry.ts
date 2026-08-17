import {
  Accessibility,
  Contact,
  Droplet,
  GraduationCap,
  Globe,
  Landmark,
  Layers,
  PieChart,
  Tag,
  User,
  type LucideIcon,
} from "@/assets/icons";

/**
 * The 10 admission master resources — the one place their shape differs.
 *
 * Every entry below was verified directly against
 * `backend/postman/erp.postman_collection.json`'s "Admissions › Masters"
 * folder: `resource` is the exact kebab-case path segment used in every one
 * of that master's five requests (List, Get by ID, Create, Update, Soft
 * delete). Nothing here is guessed.
 *
 * This registry is the *only* generic/config layer in the module — every
 * service, hook and screen downstream takes a `resource` string or an
 * `AdmissionMasterConfig`, not a template. Adding an eleventh master (should
 * the backend ever ship one) means adding one entry here, nothing else.
 */
export type AdmissionMasterType =
  | "admission-sources"
  | "categories"
  | "castes"
  | "religions"
  | "genders"
  | "languages"
  | "blood-groups"
  | "disabilities"
  | "relation-types"
  | "quotas";

export interface AdmissionMasterConfig {
  type: AdmissionMasterType;
  /** The exact kebab-case path segment under `/v1/admissions/masters/`. */
  resource: AdmissionMasterType;
  singularLabel: string;
  pluralLabel: string;
  /** Shown on the overview card and the directory's page header. */
  description: string;
  icon: LucideIcon;
  /** Shown in the directory's empty state when no records exist yet. */
  emptyStateDescription: string;
}

export const ADMISSION_MASTER_TYPES: readonly AdmissionMasterType[] = [
  "admission-sources",
  "categories",
  "castes",
  "religions",
  "genders",
  "languages",
  "blood-groups",
  "disabilities",
  "relation-types",
  "quotas",
];

export const ADMISSION_MASTER_REGISTRY: Record<
  AdmissionMasterType,
  AdmissionMasterConfig
> = {
  "admission-sources": {
    type: "admission-sources",
    resource: "admission-sources",
    singularLabel: "Admission Source",
    pluralLabel: "Admission Sources",
    description: "Where applicants heard about the institution.",
    icon: GraduationCap,
    emptyStateDescription:
      "Add your first admission source to start tracking where applicants discover your institution.",
  },
  categories: {
    type: "categories",
    resource: "categories",
    singularLabel: "Admission Category",
    pluralLabel: "Admission Categories",
    description: "Admission category classifications.",
    icon: Tag,
    emptyStateDescription:
      "Add your first admission category to start classifying applications.",
  },
  castes: {
    type: "castes",
    resource: "castes",
    singularLabel: "Caste",
    pluralLabel: "Admission Castes",
    description: "Caste classifications used on admission records.",
    icon: Layers,
    emptyStateDescription: "Add your first caste to start recording it on applications.",
  },
  religions: {
    type: "religions",
    resource: "religions",
    singularLabel: "Religion",
    pluralLabel: "Religions",
    description: "Religion classifications used on admission records.",
    icon: Landmark,
    emptyStateDescription:
      "Add your first religion to start recording it on applications.",
  },
  genders: {
    type: "genders",
    resource: "genders",
    singularLabel: "Gender",
    pluralLabel: "Genders",
    description: "Gender options offered on admission records.",
    icon: User,
    emptyStateDescription: "Add your first gender option to start offering it on applications.",
  },
  languages: {
    type: "languages",
    resource: "languages",
    singularLabel: "Language",
    pluralLabel: "Languages",
    description: "Language options offered on admission records.",
    icon: Globe,
    emptyStateDescription:
      "Add your first language option to start offering it on applications.",
  },
  "blood-groups": {
    type: "blood-groups",
    resource: "blood-groups",
    singularLabel: "Blood Group",
    pluralLabel: "Blood Groups",
    description: "Blood group options offered on admission records.",
    icon: Droplet,
    emptyStateDescription:
      "Add your first blood group to start offering it on applications.",
  },
  disabilities: {
    type: "disabilities",
    resource: "disabilities",
    singularLabel: "Disability",
    pluralLabel: "Disabilities",
    description: "Disability classifications used on admission records.",
    icon: Accessibility,
    emptyStateDescription:
      "Add your first disability type to start recording it on applications.",
  },
  "relation-types": {
    type: "relation-types",
    resource: "relation-types",
    singularLabel: "Relation Type",
    pluralLabel: "Relation Types",
    description: "Guardian and family relationship types.",
    icon: Contact,
    emptyStateDescription:
      "Add your first relation type to start recording guardians on applications.",
  },
  quotas: {
    type: "quotas",
    resource: "quotas",
    singularLabel: "Admission Quota",
    pluralLabel: "Admission Quotas",
    description: "Admission quota classifications.",
    icon: PieChart,
    emptyStateDescription: "Add your first quota to start classifying applications.",
  },
};

/** Type guard: is this string one of the 10 registered master types? */
export function isAdmissionMasterType(
  value: string,
): value is AdmissionMasterType {
  return Object.hasOwn(ADMISSION_MASTER_REGISTRY, value);
}

export function admissionMasterConfig(
  type: AdmissionMasterType,
): AdmissionMasterConfig {
  return ADMISSION_MASTER_REGISTRY[type];
}
