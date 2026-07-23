"use client";

import { UserButton } from "@clerk/nextjs";
import { BookOpen } from "lucide-react";

export function UserMenu() {
  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Link
          label="Documentation"
          labelIcon={<BookOpen className="size-4" />}
          href="/docs"
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}
