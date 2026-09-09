import type { Metadata } from "next";
import StrideApp from "@/components/stride/StrideApp";
import "./stride.css";

export const metadata: Metadata = {
  title: "Stride — A little closer, every run",
  description:
    "Your marathon training companion. A thoughtful plan, meaningful insights, and a coach in your corner.",
};
export default function StridePage() {
  return <StrideApp />;
}
