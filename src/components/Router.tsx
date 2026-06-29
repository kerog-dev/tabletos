import { createContext, useContext, useState } from "react";

type RouterContextType = {
  page: string;
  navigate: (page: string) => void;
};

const RouterContext = createContext<RouterContextType | null>(null);

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside <RouterProvider>");
  return ctx;
}

export function RouterProvider({ children, initialPage }: { children: React.ReactNode; initialPage: string }) {
  const [page, setPage] = useState(initialPage);
  return (
    <RouterContext.Provider value={{ page, navigate: setPage }}>
      {children}
    </RouterContext.Provider>
  );
}

export function Router({ pages }: { pages: Record<string, React.ReactNode> }) {
  const { page } = useRouter();
  return <>{pages[page] ?? <div>Page not found</div>}</>;
}
