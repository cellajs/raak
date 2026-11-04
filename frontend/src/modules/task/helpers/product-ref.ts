/** `#123` for an assigned number; null while the row waits for the server to assign one. */
export const productRef = (number: number) => (number > 0 ? `#${number}` : null);
