"use client";

import { UserButton } from "@clerk/nextjs";
import { BookOpen } from "lucide-react";

export function UserMenu() {
  return (
    <div className="shrink-0 rounded-full border-2 border-sidebar dark:border-white p-[3px] flex items-center justify-center transition-transform hover:scale-105 min-w-[62px] min-h-[62px] bg-muted/30 [&:has(button)]:bg-transparent">
      <UserButton 
        appearance={{
          elements: {
            userButtonAvatarBox: "!w-14 !h-14",
            userButtonTrigger: "!rounded-full"
          }
        }}
      >
        <UserButton.MenuItems>
          <UserButton.Link
            label="Documentation"
            labelIcon={<BookOpen className="size-4" />}
            href="/docs"
          />
        </UserButton.MenuItems>
      </UserButton>
    </div>
  );
}
