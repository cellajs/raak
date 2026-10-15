import { BENCH_UUID_PREFIX } from 'shared/utils/bench-identity';

const LABEL_ID_VARIANT = 'b010';

export const labelId = (i: number) => `${BENCH_UUID_PREFIX}${LABEL_ID_VARIANT}-${i.toString(16).padStart(12, '0')}`;
