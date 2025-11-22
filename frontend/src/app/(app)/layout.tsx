import { Header } from "@/components/header";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-col size-full shrink-0 relative overflow-hidden">
      <Header />
      <div className="pt-14">
        {children}
      </div>
    </div>
  );
}
