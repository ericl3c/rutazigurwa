import { api } from '../api';

export async function fetchAllPages(path, filters = {}) {
  const pageSize = 100;
  const params = new URLSearchParams({ ...filters, page: '1', limit: String(pageSize) });
  const first = await api.get(`${path}?${params}`);
  const records = [...first.data];
  const pages = Math.ceil(first.total / pageSize);

  for (let page = 2; page <= pages; page += 1) {
    const nextParams = new URLSearchParams({ ...filters, page: String(page), limit: String(pageSize) });
    const next = await api.get(`${path}?${nextParams}`);
    records.push(...next.data);
  }
  return records;
}
