type BrandMarkProps = {
  className?: string;
  variant?: "light" | "dark";
};

export function BrandMark({ className = "h-10 w-10", variant = "light" }: BrandMarkProps) {
  const background = variant === "dark" ? "#F2EDE3" : "#FFFFFF";
  const border = variant === "dark" ? "rgba(242, 237, 227, 0.18)" : "rgba(13, 27, 42, 0.08)";

  return (
    <svg
      aria-hidden="true"
      className={className}
      role="img"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill={background} height="64" rx="18" width="64" />
      <rect fill="none" height="63" rx="17.5" stroke={border} width="63" x="0.5" y="0.5" />
      <path
        d="M12 20.4C12 15.2 16.2 11 21.4 11C24.04 11 26.56 12.11 28.34 14.06L43.85 31.03L34.05 40.12L14.42 27.02C12.91 25.41 12 23.15 12 20.76V20.4Z"
        fill="#0D1B2A"
      />
      <path
        d="M52 20.4C52 15.2 47.8 11 42.6 11C39.96 11 37.44 12.11 35.66 14.06L20.15 31.03L29.95 40.12L49.58 27.02C51.09 25.41 52 23.15 52 20.76V20.4Z"
        fill="#1F7A6E"
      />
      <path
        d="M21.18 25.42C23.55 23.05 27.4 23.05 29.77 25.42L46.34 41.99C48.71 44.36 48.71 48.21 46.34 50.58C43.97 52.95 40.12 52.95 37.75 50.58L21.18 34.01C18.81 31.64 18.81 27.79 21.18 25.42Z"
        fill="#A7D5C9"
        opacity="0.94"
      />
      <path
        d="M18.8 13.15C21.86 11.98 25.52 12.72 28.03 15.38L32 19.59L35.97 15.38C38.48 12.72 42.14 11.98 45.2 13.15C43.15 11.75 40.33 11.79 38.36 13.9L32 20.71L25.64 13.9C23.67 11.79 20.85 11.75 18.8 13.15Z"
        fill="#F2EDE3"
        opacity="0.3"
      />
    </svg>
  );
}
