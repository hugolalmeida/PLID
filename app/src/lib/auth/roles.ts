export const roles = [
  "presidencia",
  "secretaria",
  "lider",
  "visualizador",
] as const;

export type UserRole = (typeof roles)[number];
