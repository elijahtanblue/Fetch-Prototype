import Navbar from "@/components/Navbar";
import { auth } from "@/lib/auth";

export default async function RoutesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user as unknown as Record<string, unknown> | undefined;
  const isAdmin = user?.role === "admin";

  return (
    <>
      <Navbar isAdmin={isAdmin} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </>
  );
}
