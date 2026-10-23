export const baseUrl = (): string => (typeof import.meta !== 'undefined' ? (import.meta.env.BASE_URL ?? '/') : '/');
