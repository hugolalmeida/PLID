export type PageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export type CreateFeedbackStatus = "success" | "error" | undefined;

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function readCreateFeedback(
  params: Record<string, string | string[] | undefined>,
) {
  const create = firstValue(params.create);
  const message = firstValue(params.message);

  const status: CreateFeedbackStatus =
    create === "success" || create === "error" ? create : undefined;

  return {
    status,
    message,
  };
}
