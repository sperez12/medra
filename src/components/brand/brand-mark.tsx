import Image from "next/image";

type BrandMarkProps = {
  className?: string;
  variant?: "light" | "dark";
};

export function BrandMark({ className = "h-10 w-10", variant = "light" }: BrandMarkProps) {
  const surfaceClass =
    variant === "dark"
      ? "bg-finance-ivory shadow-sm ring-1 ring-white/20"
      : "bg-white shadow-sm ring-1 ring-finance-line/70";

  return (
    <span
      aria-hidden="true"
      className={`${className} inline-flex aspect-square items-center justify-center overflow-hidden rounded-[28%] p-[3%] ${surfaceClass}`}
    >
      <Image
        alt=""
        className="block h-full w-full translate-x-[1.5%] translate-y-[1%] scale-[1.12] object-contain"
        height={256}
        priority={false}
        src="/brand/medra-mark.png"
        width={256}
      />
    </span>
  );
}
