import type { StepCategoryId } from "./categories.js";

type CategorizedItem = {
  categoryId: StepCategoryId;
};

export type CategorySection<TItem> = {
  categoryId: StepCategoryId;
  items: TItem[];
};

export function buildCategorySectionsInOrder<TItem extends CategorizedItem>(
  orderedItems: TItem[],
): CategorySection<TItem>[] {
  const sections: CategorySection<TItem>[] = [];

  for (const item of orderedItems) {
    const lastSection = sections[sections.length - 1];
    if (!lastSection || lastSection.categoryId !== item.categoryId) {
      sections.push({
        categoryId: item.categoryId,
        items: [item],
      });
      continue;
    }

    lastSection.items.push(item);
  }

  return sections;
}
