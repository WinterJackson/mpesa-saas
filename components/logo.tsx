import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  inverted?: boolean;
}

export function Logo({ width = 120, height = 40, className, inverted = false }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image
        src="/logo_d2.png"
        alt="PaySwift Logo"
        width={width}
        height={height}
        className={cn(inverted ? "hidden dark:block" : "dark:hidden", "rounded-[10px] w-auto h-auto")}
      />
      <Image
        src="/logo_l2.png"
        alt="PaySwift Logo"
        width={width}
        height={height}
        className={cn(inverted ? "dark:hidden" : "hidden dark:block", "rounded-[10px] w-auto h-auto")}
      />
    </div>
  );
}
