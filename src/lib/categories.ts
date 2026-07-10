import type { Category } from "@/types/finance";

export const DEFAULT_EXPENSE_CATEGORY_NAMES = [
  "Comida",
  "Supermercado",
  "Transporte",
  "Gasolina",
  "Casa",
  "Servicios",
  "Salud",
  "Entretenimiento",
  "Viajes",
  "Compras",
  "Suscripciones",
  "Otros",
];

export function normalizeCategoryName(name: string | null | undefined) {
  return name?.trim().toLowerCase() ?? "";
}

export function getCategoryDedupeKey(category: Category) {
  return `${category.user_id}:${category.type}:${normalizeCategoryName(category.name)}`;
}

export function dedupeCategories(categories: Category[]) {
  const seen = new Set<string>();

  return categories.filter((category) => {
    const key = getCategoryDedupeKey(category);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function findCategoryName(categories: Category[], categoryId: string | null) {
  return categories.find((category) => category.id === categoryId)?.name ?? "";
}

export function isSameCategoryName(categories: Category[], leftCategoryId: string | null, rightCategoryId: string | null) {
  if (leftCategoryId && rightCategoryId && leftCategoryId === rightCategoryId) return true;

  const leftName = normalizeCategoryName(findCategoryName(categories, leftCategoryId));
  const rightName = normalizeCategoryName(findCategoryName(categories, rightCategoryId));

  return Boolean(leftName && rightName && leftName === rightName);
}
