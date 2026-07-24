import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
} from "payswift";

// defaultOpen so the open state renders statically inside the card.
export const RefundConfirm = () => (
  <Dialog defaultOpen>
    <DialogTrigger render={<Button variant="outline">Refund payment</Button>} />
    <DialogContent style={{ maxWidth: 400 }}>
      <DialogHeader>
        <DialogTitle>Refund KES 2,500?</DialogTitle>
        <DialogDescription>
          This reverses the M-Pesa payment to 2547•••••78. The customer is notified automatically.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter style={{ gap: 8 }}>
        <DialogClose render={<Button variant="ghost">Cancel</Button>} />
        <Button variant="destructive">Confirm refund</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
