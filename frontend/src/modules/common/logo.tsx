import { appConfig } from 'shared';
import { useUIStore } from '~/modules/ui/ui-store';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  iconColor?: string;
  textColor?: string;
  height?: number;
  iconOnly?: boolean;
}

export function Logo({ className, iconColor, textColor, height = 50, iconOnly = false, ...props }: LogoProps) {
  const mode = useUIStore((state) => state.mode);

  const defaultTextColor = mode === 'light' ? '#333' : '#fff';
  const defaultIconColor = appConfig.themeColor;

  if (!textColor) textColor = defaultTextColor;
  if (!iconColor) iconColor = defaultIconColor;

  return (
    <svg
      id="svg-logo"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      className={className}
      width="100%"
      height={height}
      viewBox={`0 -5 ${iconOnly ? 150 : 400} 140`}
    >
      <title>Logo</title>
      <g
        id="svg-logo-icon"
        fill="none"
        fillRule="evenodd"
        style={{ transformBox: 'fill-box' }}
        transform="translate(20 12)"
      >
        <path
          fill="#1DB954"
          d="M88.29 0 62.665 32.567h23.72C94.458 32.567 101 39.11 101 47.18v27.207C101 82.457 94.457 89 86.387 89H14.613C6.543 89 0 82.457 0 74.387V47.18c0-8.07 6.543-14.613 14.613-14.613H38.49L26.549 10.24 49.61 21.163 88.289 0Z"
        />
        <g fill="#FFF" transform="translate(8.791 46.533)">
          <rect width="38.16" height="26.95" rx="7.307" />
          <rect width="38.16" height="26.95" x="46.178" rx="7.307" />
        </g>
        <rect width="12.574" height="18.988" x="29.441" y="50.719" fill="#106930" rx="3.969" />
        <rect width="12.574" height="18.988" x="59.803" y="50.719" fill="#106930" rx="3.969" />
      </g>

      {!iconOnly && (
        <g id="svg-logo-text" fill={textColor} transform="translate(10 15)" fillRule="nonzero">
          <path
            xmlns="http://www.w3.org/2000/svg"
            d="M173.8 60.8v21c0 1.2-.3 2-1 2.8-.7.7-1.5 1-2.6 1a3.7 3.7 0 0 1-3.8-3.7V40.8c0-1.2.4-2.1 1.1-2.7.8-.6 1.7-1 2.7-1a4 4 0 0 1 2.4 1c.8.6 1.2 1.5 1.2 2.7v4a13 13 0 0 1 6.6-6.3c3-1.4 6-2.1 8.7-2.1 1.6 0 3.2.2 4.9.8 1 .3 1.9 1 2.4 1.8.5.9.5 1.9.2 3-.7 2.1-2.2 3-4.4 2.6-2-.6-3.6-.8-5-.8-4.2 0-7.5 1.6-9.9 4.8a20.2 20.2 0 0 0-3.5 12.2ZM225 85.6a22 22 0 0 1-16.7-7 25.2 25.2 0 0 1-6.6-18c0-7 2.2-12.9 6.6-17.4 4.4-4.6 10-6.8 16.7-6.8 7 0 12.7 2.4 17 7.4v-3c0-1.2.4-2.1 1.1-2.7a4 4 0 0 1 2.5-1c1 0 1.8.4 2.6 1s1.2 1.5 1.2 2.7v41a3.7 3.7 0 0 1-3.8 3.8c-1.1 0-2-.3-2.6-1-.7-.7-1-1.6-1-2.7v-4c-2 2.4-4.4 4.3-7.3 5.7-3 1.4-6.1 2-9.7 2Zm0-6.7c5.2 0 9.3-1.5 12.4-4.6 3-3 4.6-7.6 4.6-13.6 0-5.8-1.6-10.2-4.6-13.2a17 17 0 0 0-12.4-4.4c-4.7 0-8.5 1.7-11.4 5a18.6 18.6 0 0 0-4.3 12.6c0 5.1 1.4 9.4 4.3 13 3 3.5 6.7 5.2 11.4 5.2ZM284.2 85.6a22 22 0 0 1-16.8-7 25.2 25.2 0 0 1-6.5-18c0-7 2.2-12.9 6.5-17.4 4.4-4.6 10-6.8 16.8-6.8 7 0 12.6 2.4 17 7.4v-3c0-1.2.3-2.1 1-2.7a4 4 0 0 1 2.5-1c1 0 1.9.4 2.7 1 .7.6 1.1 1.5 1.1 2.7v41a3.7 3.7 0 0 1-3.8 3.8c-1 0-2-.3-2.6-1-.7-.7-1-1.6-1-2.7v-4c-2 2.4-4.4 4.3-7.3 5.7-2.9 1.4-6.1 2-9.6 2Zm0-6.7c5.1 0 9.3-1.5 12.3-4.6 3-3 4.6-7.6 4.6-13.6 0-5.8-1.5-10.2-4.6-13.2a17 17 0 0 0-12.3-4.4c-4.7 0-8.5 1.7-11.4 5a18.6 18.6 0 0 0-4.4 12.6c0 5.1 1.5 9.4 4.4 13 2.9 3.5 6.7 5.2 11.4 5.2ZM326.3 85.6a3.7 3.7 0 0 1-3.8-3.7v-65c0-1.1.4-2 1.1-2.6.8-.6 1.7-1 2.7-1a4 4 0 0 1 2.4 1c.8.6 1.2 1.5 1.2 2.7v33c0 1.9.5 2.8 1.6 2.8.6 0 1.1-.2 1.7-.7l22-15.2c.6-.4 1.3-.5 2-.5 1 0 1.8.3 2.5 1s1 1.6 1 2.7c0 1.4-.6 2.4-2 3.3l-18.5 12.2c-.7.5-1.1 1.1-1.1 1.8 0 .6.4 1.4 1.1 2.1l19.9 19.2c.4.4.7.8.8 1.2l.2 1.3c0 1.1-.4 2-1.2 2.8a4 4 0 0 1-3 1.1c-.6 0-1.3-.2-2-.8L333 62.2c-.8-.8-1.4-1.2-2-1.2-.7 0-1.1 1-1.1 2.8v18c0 1.2-.4 2-1 2.8-.7.7-1.5 1-2.6 1Z"
          />
        </g>
      )}
    </svg>
  );
}
