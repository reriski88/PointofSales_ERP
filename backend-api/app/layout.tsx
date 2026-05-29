import type { Viewport } from "next";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/frontend/controllers/language-provider";
import { SelectedOutletProvider } from "@/frontend/controllers/selected-outlet-provider";
import { ToastProvider } from "@/frontend/views/admin/_components/toast-provider";
import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";

export const metadata = {
  title: "POS Cemilan API",
  description: "Local-first POS Cemilan backend API",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        <LanguageProvider>
          <SelectedOutletProvider>
            <ToastProvider>{children}</ToastProvider>
          </SelectedOutletProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
