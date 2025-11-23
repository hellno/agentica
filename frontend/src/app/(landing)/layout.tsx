import { DaimoProviders } from '@/components/providers/daimo-providers';

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DaimoProviders>{children}</DaimoProviders>;
}
