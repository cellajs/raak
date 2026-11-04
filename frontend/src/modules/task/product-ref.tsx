import { productRef } from '~/modules/task/helpers/product-ref';
import { cn } from '~/utils/cn';

interface ProductRefProps {
  number: number;
  className?: string;
}

/** `#123` in muted text; nothing while the row waits for the server to assign its number. */
export function ProductRef({ number, className }: ProductRefProps) {
  const ref = productRef(number);
  if (!ref) return null;
  return <span className={cn('text-muted-foreground shrink-0 text-xs tabular-nums', className)}>{ref}</span>;
}
