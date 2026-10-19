import { benchUuid } from './ids';

const LABEL_ID_VARIANT = 'b010';

export const labelId = (i: number) => benchUuid(LABEL_ID_VARIANT, i);
