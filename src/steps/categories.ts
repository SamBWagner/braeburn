export type StepCategoryId =
  | "apps-packages"
  | "cli-tools"
  | "runtimes"
  | "shell"
  | "maintenance";

export type StepCategoryDefinition = {
  id: StepCategoryId;
  label: string;
};

const STEP_CATEGORY_DEFINITIONS: StepCategoryDefinition[] = [
  { id: "runtimes", label: "Runtimes" },
  { id: "apps-packages", label: "Apps & Packages" },
  { id: "cli-tools", label: "CLI Tools" },
  { id: "shell", label: "Shell" },
  { id: "maintenance", label: "Maintenance" },
];

const STEP_CATEGORY_DEFINITION_BY_ID = new Map<StepCategoryId, StepCategoryDefinition>(
  STEP_CATEGORY_DEFINITIONS.map((categoryDefinition) => [categoryDefinition.id, categoryDefinition]),
);

export function listStepCategoryDefinitions(): StepCategoryDefinition[] {
  return [...STEP_CATEGORY_DEFINITIONS];
}

export function getStepCategoryLabel(categoryId: StepCategoryId): string {
  const categoryDefinition = STEP_CATEGORY_DEFINITION_BY_ID.get(categoryId);
  if (!categoryDefinition) {
    return categoryId;
  }
  return categoryDefinition.label;
}
