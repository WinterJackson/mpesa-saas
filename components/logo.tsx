import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function Logo({ width = 120, height = 40, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/logo_d2.png"
        alt="PaySwift Logo"
        width={width}
        height={height}
        className="dark:hidden rounded-[10px]"
      />
      <Image
        src="/logo_l2.png"
        alt="PaySwift Logo"
        width={width}
        height={height}
        className="hidden dark:block rounded-[10px]"
      />
    </div>
  );
}
