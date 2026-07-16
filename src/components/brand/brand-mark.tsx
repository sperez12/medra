import Image from "next/image";

type BrandMarkProps = {
  className?: string;
  eager?: boolean;
  variant?: "light" | "dark";
};

export function BrandMark({ className = "h-10 w-10", eager = false }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-flex aspect-square items-center justify-center overflow-visible`}
    >
      <Image
        alt=""
        className="block h-full w-full object-contain"
        height={256}
        loading={eager ? "eager" : "lazy"}
        src="/brand/medra-mark.png"
        width={256}
      />
    </span>
  );
}
