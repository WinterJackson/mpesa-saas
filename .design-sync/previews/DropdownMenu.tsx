import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Button,
} from "payswift";

// defaultOpen so the open menu renders statically inside the card.
// DropdownMenuLabel is a group part — it must live inside a DropdownMenuGroup.
export const TransactionActions = () => (
  <DropdownMenu defaultOpen>
    <DropdownMenuTrigger render={<Button variant="outline">Actions</Button>} />
    <DropdownMenuContent style={{ minWidth: 200 }}>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Transaction</DropdownMenuLabel>
        <DropdownMenuItem>View receipt</DropdownMenuItem>
        <DropdownMenuItem>Resend webhook</DropdownMenuItem>
        <DropdownMenuItem>Copy reference</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem>Refund payment</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
