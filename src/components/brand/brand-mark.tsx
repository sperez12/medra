import Image from "next/image";

type BrandMarkProps = {
  className?: string;
  variant?: "light" | "dark";
};

export function BrandMark({ className = "h-10 w-10", variant = "light" }: BrandMarkProps) {
  const imageClass =
    variant === "dark"
      ? "drop-shadow-[0_10px_24px_rgba(167,213,201,0.22)]"
      : "drop-shadow-[0_6px_14px_rgba(13,27,42,0.12)]";

  return (
    <span
      aria-hidden="true"
      className={`${className} inline-flex aspect-square items-center justify-center overflow-visible`}
    >
      <Image
        alt=""
        className={`block h-full w-full object-contain ${imageClass}`}
        height={256}
        priority={false}
        src="/brand/medra-mark.png"
        width={256}
      />
    </span>
  );
}
