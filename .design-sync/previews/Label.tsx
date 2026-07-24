import { Label, Input } from "payswift";

export const Default = () => <Label>Business name</Label>;

export const WithField = () => (
  <div style={{ display: "grid", gap: 6, maxWidth: 320 }}>
    <Label htmlFor="biz">Business name</Label>
    <Input id="biz" placeholder="Acme Stores Ltd" />
  </div>
);
