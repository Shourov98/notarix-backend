export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const parsePaginationQuery = (query = {}, defaults = {}) => {
  const page = toPositiveInt(query.page, defaults.page || DEFAULT_PAGE);
  const requestedPageSize = toPositiveInt(
    query.pageSize || query.limit,
    defaults.pageSize || DEFAULT_PAGE_SIZE
  );
  const pageSize = Math.min(requestedPageSize, defaults.maxPageSize || MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    skip,
  };
};

export const buildPaginationMeta = ({
  page,
  pageSize,
  totalItems = 0,
}) => {
  const safeTotal = Math.max(Number(totalItems) || 0, 0);
  const totalPages = safeTotal === 0 ? 1 : Math.ceil(safeTotal / pageSize);

  return {
    page,
    pageSize,
    totalItems: safeTotal,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
};
