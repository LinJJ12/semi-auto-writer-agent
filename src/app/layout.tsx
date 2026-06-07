import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Artile Agent Studio",
  description: "半自动公众号智能体工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
