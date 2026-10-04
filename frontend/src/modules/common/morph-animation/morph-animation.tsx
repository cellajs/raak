interface MorphAnimationProps {
  variant?: 'single' | 'colony';
  grid?: number;
  speed?: number;
  overscan?: number;
  stamp?: 'square' | 'plus';
  className?: string;
}

/** Empty shell: raak draws no background animation. The synced auth layout imports this module. */
export function MorphAnimation(_props: MorphAnimationProps) {
  return null;
}
