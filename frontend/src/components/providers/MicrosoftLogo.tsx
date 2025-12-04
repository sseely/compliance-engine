/**
 * Microsoft Logo Component
 * Official Microsoft brand colors
 */

interface MicrosoftLogoProps {
  size?: number;
  className?: string;
}

export function MicrosoftLogo({ size = 24, className = "" }: MicrosoftLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-label="Microsoft"
    >
      <path d="M11.4 24H0V12.6h11.4V24z" fill="#f25022" />
      <path d="M24 24H12.6V12.6H24V24z" fill="#00a4ef" />
      <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#7fba00" />
      <path d="M24 11.4H12.6V0H24v11.4z" fill="#ffb900" />
    </svg>
  );
}