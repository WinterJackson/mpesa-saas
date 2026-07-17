import { SignIn } from '@clerk/nextjs';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Page() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <SignIn 
          appearance={{
            elements: {
              card: "bg-background border border-border shadow-sm",
              headerTitle: "text-foreground",
              headerSubtitle: "text-muted-foreground",
              socialButtonsBlockButton: "border-border text-foreground hover:bg-muted/50",
              socialButtonsBlockButtonText: "text-foreground font-medium",
              dividerLine: "bg-border",
              dividerText: "text-muted-foreground",
              formFieldLabel: "text-foreground",
              formFieldInput: "bg-background border-border text-foreground focus:ring-primary",
              formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
              footerActionText: "text-muted-foreground",
              footerActionLink: "text-primary hover:text-primary/90",
            }
          }}
        />
      </div>
    </div>
  );
}
