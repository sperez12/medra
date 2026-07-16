import Image from "next/image";

type BrandMarkProps = {
  className?: string;
  variant?: "light" | "dark";
};

export function BrandMark({ className = "h-10 w-10", variant = "light" }: BrandMarkProps) {
  const backgroundClass = variant === "dark" ? "bg-[#F2EDE3]" : "bg-white";

  return (
    <span
      aria-hidden="true"
      className={`${className} inline-flex items-center justify-center overflow-hidden rounded-[30%] ${backgroundClass}`}
    >
      <Image
        alt=""
        className="h-full w-full object-contain"
        height={256}
        priority={false}
        src="/brand/medra-mark.png"
        width={256}
      />
    </span>
  );
}
