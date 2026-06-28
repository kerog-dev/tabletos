import { createContext, useContext } from "react";

export const WindowContext = createContext<
  {
    move: ({ x, y, absolute }: { x: number; y: number; absolute?: boolean }) => void;
    resize: ({ w, h, absolute }: { w: number; h: number; absolute?: boolean }) => void;
    pos(): [number, number];
    size(): [number, number];
  } | null
>(null);

export const useWindow = () => useContext(WindowContext);
