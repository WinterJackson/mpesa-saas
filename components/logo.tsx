import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  inverted?: boolean;
  /** When set, the logo becomes a clickable link (e.g. "/" back to the landing page). */
  href?: string;
}

export function Logo({ width = 120, height = 40, className, inverted = false, href }: LogoProps) {
  const content = (
    <>
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
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label="PaySwift home"
        className={cn("flex items-center gap-2 rounded-[10px] transition-opacity hover:opacity-80", className)}
      >
        {content}
      </Link>
    );
  }

  return <div className={cn("flex items-center gap-2", className)}>{content}</div>;
}
