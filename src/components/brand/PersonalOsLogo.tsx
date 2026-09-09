import Image from "next/image";

type PersonalOsLogoProps = {
  className?: string;
  size?: number;
  title?: string;
};

export function PersonalOsLogo({ className, size = 28, title = "Personal OS" }: PersonalOsLogoProps) {
  return (
    <Image
      alt={title}
      className={className}
      height={size}
      src="/brand/personal-os-logo.png"
      priority={false}
      style={{ borderRadius: Math.round(size * 0.22) }}
      width={size}
    />
  );
}
