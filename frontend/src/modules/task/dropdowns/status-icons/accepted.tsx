import type { SVGProps } from 'react';

export const AcceptedIcon = ({ ...props }: SVGProps<SVGSVGElement>) => (
  <svg width="1em" height="1em" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-label="Accepted" {...props}>
    <title>Accepted</title>
    <rect x="0.7" y="0.7" width="14.6" height="14.6" rx="4.8" fill="#16A34A" />
    <path
      d="M4.9 8.2 7 10.3 11.2 5.6"
      fill="none"
      stroke="#fff"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
