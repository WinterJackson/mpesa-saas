// Design-system barrel entry for /design-sync (off-envelope: this is a Next.js
// app, not a published library, so we hand-author the bundle entry). Re-exports
// the shadcn/ui primitives from components/ui/* so esbuild can bundle them into
// window.PaySwiftUI.*. Every family's sub-exports (CardHeader, DialogContent,
// TableRow, …) come through via `export *` for composition in previews/designs.
export * from "@/components/ui/badge";
export * from "@/components/ui/button";
export * from "@/components/ui/card";
export * from "@/components/ui/dialog";
export * from "@/components/ui/dropdown-menu";
export * from "@/components/ui/input";
export * from "@/components/ui/label";
export * from "@/components/ui/separator";
export * from "@/components/ui/skeleton";
export * from "@/components/ui/sonner";
export * from "@/components/ui/table";
export * from "@/components/ui/tabs";
