import { AppLayoutShell } from "../AppLayoutShell";

export default function AppGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppLayoutShell>{children}</AppLayoutShell>;
}
