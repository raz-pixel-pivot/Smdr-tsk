import { Suspense } from "react";
import { Projects } from "@/components/Projects";

export default function Page() {
  return (
    <Suspense>
      <Projects />
    </Suspense>
  );
}
