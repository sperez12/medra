type BrandMarkProps = {
  className?: string;
  variant?: "light" | "dark";
};

export function BrandMark({ className = "h-10 w-10", variant = "light" }: BrandMarkProps) {
  const background = variant === "dark" ? "#0d1b2a" : "#ffffff";

  return (
    <svg
      aria-hidden="true"
      className={className}
      role="img"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill={background} height="64" rx="18" width="64" />
      <path
        d="M15 18C15 14.6863 17.6863 12 21 12H23.8C25.3 12 26.74 12.596 27.8 13.656L45.7 31.556C48.043 33.899 48.043 37.698 45.7 40.041L43.72 42.021C41.377 44.364 37.578 44.364 35.235 42.021L15 21.786V18Z"
        fill="#0D1B2A"
      />
      <path
        d="M49 18C49 14.6863 46.3137 12 43 12H40.2C38.7 12 37.26 12.596 36.2 13.656L18.3 31.556C15.957 33.899 15.957 37.698 18.3 40.041L20.28 42.021C22.623 44.364 26.422 44.364 28.765 42.021L49 21.786V18Z"
        fill="#1F7A6E"
      />
      <path
        d="M22.8 26.1L32 35.3L41.2 26.1L46.6 31.5C48.95 33.85 48.95 37.65 46.6 40L39.95 46.65C37.6 49 33.8 49 31.45 46.65L17.4 32.6L22.8 26.1Z"
        fill="#A7D5C9"
        opacity="0.82"
      />
    </svg>
  );
}
