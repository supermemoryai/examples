import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Code Sandbox with Memory",
  description:
    "Browser-based code editor that runs in a Daytona sandbox with SMFS-mounted persistent memory.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
