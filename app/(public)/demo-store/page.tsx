"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingBag, Smartphone, Headphones, Cable, CheckCircle2, XCircle, Loader2, Info, Lock } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";

type Product = {
  id: string;
  name: string;
  price: number;
  icon: React.ElementType;
  image: string;
};

const products: Product[] = [
  { id: "p_1", name: "Wireless Earbuds", price: 2500, icon: Headphones, image: "/images/demo-products/earbuds.webp" },
  { id: "p_2", name: "Phone Case", price: 800, icon: Smartphone, image: "/images/demo-products/phone-case.webp" },
  { id: "p_3", name: "USB Cable", price: 350, icon: Cable, image: "/images/demo-products/usb-cable.webp" },
];

export default function DemoStorePage() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const [paymentState, setPaymentState] = useState<"idle" | "initiating" | "polling" | "success" | "failed">("idle");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);

  // Handle initiating checkout
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    setPaymentState("initiating");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/demo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneNumber,
          amount: selectedProduct.price,
          orderReference: `ORD-${selectedProduct.id}`,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate payment");
      }

      setTransactionId(data.data.transactionId);
      setPaymentState("polling");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      setPaymentState("failed");
    }
  };

  // Handle polling for transaction status
  useEffect(() => {
    if (paymentState !== "polling" || !transactionId) return;

    let timeoutId: NodeJS.Timeout;
    const controller = new AbortController();

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/demo/status/${transactionId}`, {
          signal: controller.signal,
        });
        const data = await res.json();

        if (res.ok && data.success) {
          const status = data.data.status;
          if (status === "completed") {
            setReceipt(data.data.mpesaReceipt || "CONFIRMED");
            setPaymentState("success");
            return; // Stop polling
          } else if (status === "failed" || status === "cancelled") {
            setErrorMessage(data.data.resultDesc || "Payment failed or was cancelled by user.");
            setPaymentState("failed");
            return; // Stop polling
          }
        }
        
        // If still pending, poll again after 2s
        timeoutId = setTimeout(pollStatus, 2000);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        // Don't fail immediately on network error during polling, just try again
        timeoutId = setTimeout(pollStatus, 2000);
      }
    };

    pollStatus();

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [paymentState, transactionId]);

  const openCheckout = (product: Product) => {
    setSelectedProduct(product);
    setPaymentState("idle");
    setErrorMessage(null);
    setReceipt(null);
    setPhoneNumber("");
    setIsOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Floating Header Wrapper */}
      <div className="sticky top-0 z-50 w-full pt-floating-header px-floating-header pb-4 bg-background/95 backdrop-blur-sm">
        <header className="w-full border border-primary rounded-floating-header bg-floating-header-bg backdrop-blur-md shadow-floating-header">
          <div className="flex h-16 w-full items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2">
              <ShoppingBag className="size-6 text-primary" />
              <span className="text-xl font-bold tracking-tight">DemoTech Store</span>
            </div>
            <nav className="flex items-center gap-4">
              <ThemeToggle />
              <Link href="/">
                <Button variant="outline" size="sm">
                  Back to PaySwift
                </Button>
              </Link>
            </nav>
          </div>
        </header>
      </div>

      {/* Banner */}
      <div className="bg-primary/10 border-b border-primary/20 text-primary px-4 py-3 text-center text-sm font-medium flex items-center justify-center gap-2">
        <Info className="size-4" />
        This demonstrates the API integration a real Shopify or custom store would use.
      </div>

      {/* How This Demo Works */}
      <div className="container mx-auto px-4 md:px-8 pt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-muted/30 border-none shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">1. Pick a Product</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Choose any item below to simulate a real checkout.</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-none shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">2. Enter Your Number</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Use any valid Kenyan number — this runs on Safaricom&apos;s sandbox, no real money moves.</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-none shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">3. Approve on Your Phone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Watch the Developer Console below to see the exact API events firing in real time.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 md:px-8 py-12">
        <div className="mb-12 text-center max-w-2xl mx-auto">
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">Latest Tech Accessories</h1>
          <p className="text-muted-foreground text-lg">
            Experience our seamless M-Pesa checkout flow exactly as your customers will.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {products.map((product) => {
            return (
              <Card key={product.id} className="group flex flex-col overflow-hidden border border-border bg-background rounded-lg shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-primary hover:shadow-floating-header">
                <div className="h-48 bg-muted/10 relative flex items-center justify-center border-b border-border overflow-hidden">
                  <Image 
                    src={product.image} 
                    alt={product.name}
                    width={400}
                    height={400}
                    className="object-cover w-full h-full mix-blend-multiply dark:mix-blend-normal"
                  />
                </div>
                <CardHeader>
                  <CardTitle>{product.name}</CardTitle>
                  <CardDescription className="text-lg font-semibold text-foreground">
                    KES {product.price.toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto">
                  <Button 
                    className="w-full font-semibold" 
                    onClick={() => openCheckout(product)}
                  >
                    Buy with M-Pesa
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Checkout Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          {paymentState === "idle" || paymentState === "initiating" ? (
            <>
              <DialogHeader>
                <DialogTitle>Secure Checkout</DialogTitle>
                <DialogDescription>
                  Pay KES {selectedProduct?.price.toLocaleString()} for {selectedProduct?.name}.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCheckout} className="space-y-6 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">M-Pesa Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="254700000000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={paymentState === "initiating"}
                    required
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter Safaricom number starting with 254
                  </p>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={paymentState === "initiating"}
                >
                  {paymentState === "initiating" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Initiating Prompt...
                    </>
                  ) : (
                    "Send M-Pesa Prompt"
                  )}
                </Button>
              </form>
              <div className="flex items-center justify-center gap-1.5 pt-3 border-t border-border mt-3">
                <Lock className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Secured by PaySwift</span>
              </div>
            </>
          ) : paymentState === "polling" ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="space-y-2">
                <DialogTitle>Awaiting Payment</DialogTitle>
                <DialogDescription>
                  Please check your phone and enter your M-Pesa PIN to complete the transaction.
                </DialogDescription>
              </div>
            </div>
          ) : paymentState === "success" ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="h-16 w-16 bg-status-completed/10 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 className="h-8 w-8 text-status-completed" />
              </div>
              <DialogTitle className="text-2xl">Payment Successful!</DialogTitle>
              <DialogDescription className="text-base">
                Your order for {selectedProduct?.name} has been confirmed.
              </DialogDescription>
              <div className="bg-muted p-4 rounded-lg w-full mt-4 flex justify-between items-center border border-border">
                <span className="text-sm text-muted-foreground">Receipt No.</span>
                <span className="font-mono font-bold">{receipt}</span>
              </div>
              <Button className="w-full mt-6" variant="outline" onClick={() => setIsOpen(false)}>
                Continue Shopping
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="h-16 w-16 bg-status-failed/10 rounded-full flex items-center justify-center mb-2">
                <XCircle className="h-8 w-8 text-status-failed" />
              </div>
              <DialogTitle className="text-2xl">Payment Failed</DialogTitle>
              <DialogDescription className="text-base text-status-failed">
                {errorMessage}
              </DialogDescription>
              <Button className="w-full mt-6" onClick={() => setPaymentState("idle")}>
                Try Again
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="w-full border-t border-border mt-auto">
        <div className="container mx-auto px-4 md:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <div className="font-bold text-lg tracking-tight mb-1">PaySwift</div>
              <p className="text-sm text-muted-foreground">M-Pesa payment collection for developers.</p>
            </div>
            <nav className="flex flex-wrap gap-4 md:gap-6 text-sm text-muted-foreground">
              <Link href="https://github.com/WinterJackson/mpesa-saas#readme" className="hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">Documentation</Link>
              <Link href="https://github.com/WinterJackson/mpesa-saas#api-reference" className="hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">API Reference</Link>
              <Link href="https://github.com/WinterJackson/mpesa-saas" className="hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">GitHub</Link>
              <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
            </nav>
          </div>
          <div className="text-xs text-muted-foreground/60 text-center md:text-left">
            Built with Next.js, Prisma, and Neon.
          </div>
        </div>
      </footer>
    </div>
  );
}
