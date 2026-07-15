type BrandMarkProps = {
  className?: string;
  variant?: "light" | "dark";
};

export function BrandMark({ className = "h-10 w-10", variant = "light" }: BrandMarkProps) {
  const background = variant === "dark" ? "#0D1B2A" : "#FFFFFF";
  const border = variant === "dark" ? "rgba(167, 213, 201, 0.18)" : "rgba(13, 27, 42, 0.08)";

  return (
    <svg
      aria-hidden="true"
      className={className}
      role="img"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill={background} height="64" rx="19" width="64" />
      <rect fill="none" height="63" rx="18.5" stroke={border} width="63" x="0.5" y="0.5" />
      <path
        d="M12 19.8C12 13.75 19.36 10.76 23.58 15.08L44.32 36.3C48.22 40.29 45.39 47 39.82 47H37.9C35.73 47 33.65 46.12 32.14 44.56L14.38 26.23C12.86 24.66 12 22.57 12 20.39V19.8Z"
        fill="#0D1B2A"
      />
      <path
        d="M52 19.8C52 13.75 44.64 10.76 40.42 15.08L19.68 36.3C15.78 40.29 18.61 47 24.18 47H26.1C28.27 47 30.35 46.12 31.86 44.56L49.62 26.23C51.14 24.66 52 22.57 52 20.39V19.8Z"
        fill="#1F7A6E"
      />
      <path
        d="M23.08 28.8C25.22 26.66 28.69 26.66 30.83 28.8L32 29.97L33.17 28.8C35.31 26.66 38.78 26.66 40.92 28.8L45.1 32.98L35.58 42.7C33.61 44.71 30.39 44.71 28.42 42.7L18.9 32.98L23.08 28.8Z"
        fill="#A7D5C9"
        opacity="0.86"
      />
      <path
        d="M25.05 17.35L32 24.45L38.95 17.35C41.21 15.04 44.56 14.53 47.25 15.64C45.12 14.12 42.1 14.07 40.02 16.2L32 24.4L23.98 16.2C21.9 14.07 18.88 14.12 16.75 15.64C19.44 14.53 22.79 15.04 25.05 17.35Z"
        fill="#FFFFFF"
        opacity="0.16"
      />
    </svg>
  );
}
